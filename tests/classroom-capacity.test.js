import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {io} from 'socket.io-client';
import {RoomStore} from '../server/rooms.js';
import {PersistentRoomStore,fromRecord} from '../server/persistent-rooms.js';
import {createClassroomServer} from '../server/app.js';
import {saveNotice,markAssignmentDone,recordReward,validateTemple} from '../server/temple.js';
import {validateJoinRequests} from '../server/planet-membership.js';
import {createMission,acceptMission,completeMission,claimMission} from '../server/missions.js';

const names=count=>Array.from({length:count},(_,i)=>`학생${i+1}`);
const accounts=count=>names(count).map(nickname=>({nickname,pin:'1234'}));

test('every student count from 1 through 35 creates a classroom; 0 and 36 fail atomically',()=>{
  for(let count=1;count<=35;count++){
    const store=new RoomStore(),{room}=store.create({allowedNames:names(count)},'teacher');
    assert.equal(room.allowedNames.size,count);assert.equal(store.snapshot(room).maxPlayers,36);
  }
  const store=new RoomStore();
  for(const count of [0,36])assert.throws(()=>store.create({allowedNames:names(count)},'teacher'));
  assert.equal(store.rooms.size,0);
});

for(const count of [1,8,10,29,35])test(`managed classroom with ${count} students reopens with the same accounts and unchanged saved file`,async t=>{
  const dir=await mkdtemp(join(tmpdir(),'class-capacity-'));
  let store=new PersistentRoomStore(dir,{teacherManagedAccounts:true});
  t.after(async()=>{store.close();await rm(dir,{recursive:true,force:true});});
  const {room}=store.transact(()=>store.create({studentAccounts:accounts(count)},'teacher'));
  const ids=[...room.players.values()].filter(p=>p.role==='student').map(p=>p.id);
  const path=join(dir,room.code+'.json'),before=await readFile(path,'utf8');
  store.close();store=new PersistentRoomStore(dir,{teacherManagedAccounts:true});
  const reopened=store.open({code:room.code},'new-teacher').room;
  assert.deepEqual([...reopened.allowedNames],names(count));
  assert.deepEqual([...reopened.players.values()].filter(p=>p.role==='student').map(p=>p.id),ids);
  assert.equal(await readFile(path,'utf8'),before,'opening an existing classroom must not rewrite its file');
  const record=JSON.parse(before);
  assert.throws(()=>fromRecord({...record,allowedNames:names(36)}));
  assert.throws(()=>fromRecord({...record,students:Array(36).fill(record.students[0])}));
});

test('35th account can be added later; full class rewards, assignments, missions and join requests survive restart',async t=>{
  const dir=await mkdtemp(join(tmpdir(),'full-class-capacity-')),sockets=[];
  const teacherKey='capacity-test-key';let game,address;
  const start=async()=>{game=createClassroomServer({teacherKey,dataDir:dir,studentHours:false});address=await game.listen();};
  await start();
  t.after(async()=>{sockets.forEach(s=>s.disconnect());await game.close();await rm(dir,{recursive:true,force:true});});
  const connect=async()=>{
    const socket=io(`http://127.0.0.1:${address.port}`,{transports:['websocket'],reconnection:false,forceNew:true});sockets.push(socket);
    await new Promise((resolve,reject)=>{socket.once('connect',resolve);socket.once('connect_error',reject);});return socket;
  };
  const call=(socket,event,data={})=>socket.timeout(10000).emitWithAck(event,data);
  const teacher=await connect();
  const invalid=await call(teacher,'room:create',{teacherKey,studentAccounts:accounts(36)});
  assert.equal(invalid.ok,false);assert.equal(game.store.records.size,0);assert.equal(game.store.rooms.size,0);
  const created=await call(teacher,'room:create',{teacherKey,studentAccounts:accounts(34),seedPlanets:true});
  assert.ok(created.ok,created.error);const code=created.room.code;
  assert.ok((await call(teacher,'student:create',{nickname:'학생35',pin:'1234'})).ok);
  const before=await readFile(join(dir,code+'.json'),'utf8');
  const rejected=await call(teacher,'student:create',{nickname:'학생36',pin:'1234'});
  assert.equal(rejected.ok,false);assert.match(rejected.error,/35/);
  assert.equal(await readFile(join(dir,code+'.json'),'utf8'),before);
  const room=game.store.rooms.get(code),students=[...room.players.values()].filter(p=>p.role==='student');
  assert.equal(students.length,35);const ids=students.map(p=>p.id);
  const now=Date.parse('2026-10-26T03:00:00Z');
  game.store.transact(()=>{
    saveNotice(room,'모두의 과제',[0],now);
    const mission=createMission(room,{title:'모두의 미션',description:'과제 완료',rewardShards:1,distribution:'board',maxRecipients:35},now);
    assert.throws(()=>createMission(room,{title:'초과 미션',description:'과제 완료',rewardShards:1,distribution:'board',maxRecipients:36},now));
    for(const student of students){
      student.starShards=7;
      markAssignmentDone(room,room.temple.assignments[0].id,student.id);
      recordReward(room,student.id,2,now);
      acceptMission(room,student,mission.id,now);completeMission(room,student.id,mission.id,now);claimMission(room,student,mission.id,now);
    }
    const planet=[...room.planets.values()][0];
    students[0].avatar.departmentId=planet.id;
    planet.joinRequests=students.slice(1).map(p=>({playerId:p.id,at:now}));
  });
  assert.equal(validateTemple(room.temple).assignments[0].completedIds.length,35);
  assert.throws(()=>recordReward(room,'overflow-student',1,now));
  assert.equal(validateJoinRequests(students.map(p=>({playerId:p.id,at:now}))).length,35);
  assert.throws(()=>validateJoinRequests([...students.map(p=>({playerId:p.id,at:now})),{playerId:'overflow',at:now}]));
  await game.close();await start();
  const reopened=await call(await connect(),'room:open',{teacherKey,code});assert.ok(reopened.ok,reopened.error);
  const restored=game.store.rooms.get(code),restoredStudents=[...restored.players.values()].filter(p=>p.role==='student');
  assert.deepEqual(restoredStudents.map(p=>p.id),ids);
  assert.equal(restored.temple.assignments[0].completedIds.length,35);
  assert.equal(restored.temple.weeks.find(w=>w.week==='2026-10-26').totals.length,35);
  assert.equal(restored.missions[0].claimedIds.length,35);
  assert.equal([...restored.planets.values()][0].joinRequests.length,34);
  const clients=[];
  for(const student of restoredStudents){
    const socket=await connect();clients.push(socket);
    const reply=await call(socket,'room:join',{code,nickname:student.nickname,pin:'1234'});
    assert.ok(reply.ok,reply.error);assert.equal(reply.selfId,student.id);
    assert.equal(student.starShards,7);
  }
  assert.equal([...restored.players.values()].filter(p=>p.connected).length,36);
  await call(clients[34],'room:leave');
  const back=await call(await connect(),'room:join',{code,nickname:'학생35',pin:'1234'});
  assert.ok(back.ok,back.error);assert.equal(back.selfId,ids[34]);
  assert.equal([...restored.players.values()].filter(p=>p.connected).length,36);
});
