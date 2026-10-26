import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {io} from 'socket.io-client';
import {RoomStore} from '../server/rooms.js';
import {PersistentRoomStore,toRecord,fromRecord} from '../server/persistent-rooms.js';
import {deleteStudentAccounts} from '../server/account-deletion.js';
import {createClassroomServer} from '../server/app.js';
import {createMission} from '../server/missions.js';
import {ensureDailyMissions} from '../server/daily-missions.js';
import {freshConstellationAbilityState,validateConstellationAbilityState} from '../server/constellation-weekly-abilities.js';
import {constellationWeekStart} from '../shared/constellation-weekly-abilities.js';
import {CULTURE_STORIES} from '../shared/culture-stories.js';
import {RULES} from '../shared/config.js';
const now=Date.parse('2026-10-26T10:00:00+09:00'),week=constellationWeekStart(now);
const key='account-delete-test-private-key';
const call=(s,event,data={})=>s.timeout(5000).emitWithAck(event,data);

async function fixture(t,names=['별이','달이']){
  const dir=await mkdtemp(join(tmpdir(),'delete-accounts-'));
  const store=new PersistentRoomStore(dir,{clock:()=>now,teacherManagedAccounts:true});
  t.after(async()=>{store.close();await rm(dir,{recursive:true,force:true});});
  const {room,player:teacher}=store.transact(()=>store.create({title:'가상삭제교실',studentAccounts:names.map(nickname=>({nickname,pin:'1234'}))},'teacher'));
  const students=[...room.players.values()].filter(p=>p.role==='student');
  return {store,room,teacher,students};
}

test('account deletion validates teacher ownership and entire batch before mutating',()=>{
  const store=new RoomStore(),{room,player:teacher}=store.create({title:'가상교실',allowedNames:['별이']},'teacher');
  const student=store.join({code:room.code,nickname:'별이',pin:'1234'},'student').player;
  const other=store.create({title:'다른가상교실',allowedNames:['달이']},'other');
  const foreign=store.join({code:other.room.code,nickname:'달이',pin:'1234'},'foreign').player;
  for(const [actor,ids] of [[student,[student.id]],[other.player,[student.id]],[teacher,[]],[teacher,[student.id,teacher.id]],[teacher,[student.id,foreign.id]],[teacher,[student.id,student.id]],[teacher,['missing']]]){
    assert.throws(()=>deleteStudentAccounts(store,room,actor,ids,now));
    assert.equal(room.players.get(student.id),student);assert.equal(room.allowedNames.has(student.nickname),true);
    assert.equal(store.sessions.has(student.token),true);
  }
  student.accountKind='master';
  assert.deepEqual(deleteStudentAccounts(store,room,teacher,[student.id],now),{deletedIds:[student.id]});
  assert.equal(room.players.has(teacher.id),true);assert.equal(other.room.players.has(foreign.id),true);
});

test('deletion cleans mission, assignment, recommendation and pair references and survives restart with zero students',async t=>{
  const {store,room,teacher,students:[p,q]}=await fixture(t);
  const story=CULTURE_STORIES[0].id;
  store.transact(()=>{
    p.cultureRecommendationVotes=[story];q.cultureRecommendationVotes=[story];room.cultureRecommendations={[story]:2};
    const pair={sourceId:p.id,level:2,startsAt:now,endsAt:now+86400000};
    p.piscesPair={...pair,partnerId:q.id};q.piscesPair={...pair,partnerId:p.id};
    createMission(room,{title:'자동',description:'별길 걷기',distribution:'all',objective:'map-travel',goal:1,rewardShards:1},now);
    ensureDailyMissions(room,now);
    const m=room.missions[0];m.completedIds=[p.id];m.claimedIds=[p.id];m.progress[p.id]=1;m.claimedAt={[p.id]:now};
  });
  store.transact(()=>deleteStudentAccounts(store,room,teacher,[p.id],now));
  assert.equal(q.piscesPair,null);assert.deepEqual(room.cultureRecommendations,{[story]:1});
  for(const m of [...room.missions,...room.dailyMissions.instances]){
    assert.equal(m.acceptedIds.includes(p.id),false);assert.equal(m.claimedIds.includes(p.id),false);assert.equal(p.id in (m.progress||{}),false);
  }
  const loaded=fromRecord(toRecord(room),now);assert.equal(loaded.players.size,1);
  store.transact(()=>deleteStudentAccounts(store,room,teacher,[q.id],now));
  assert.equal(fromRecord(store.records.get(room.code),now).players.size,0);
});

test('deletion cancels live trades, department distributions, invites and combat refs without taking surviving assets',()=>{
  const store=new RoomStore(),{room,player:teacher}=store.create({title:'가상교실',allowedNames:['별이','달이']},'teacher');
  const p=store.join({code:room.code,nickname:'별이',pin:'1234'},'p').player,q=store.join({code:room.code,nickname:'달이',pin:'1234'},'q').player;
  q.starShards=7;
  const planet={id:'dept',joinRequests:[{playerId:p.id,at:now}],rename:{proposedBy:p.id,votes:new Map([[p.id,true]])},
    work:{report:{text:'',status:'draft',version:0,submittedAt:null},balance:5,distribution:{id:'distribution',confirmedIds:[],allocations:[{playerId:p.id,quantity:5}]},history:[]}};
  room.planets.set(planet.id,planet);
  p.avatar.departmentId=planet.id;q.avatar.departmentId=planet.id;
  for(const field of ['trades','summons','partyInvites','piscesInvites','ariesInvites','cancerInvites','cetusInvites'])room[field]=new Map([['invite',{fromId:p.id,toId:q.id}]]);
  room.parties=new Map([['pair',{id:'pair',leaderId:p.id,memberIds:[p.id,q.id]}]]);
  room.proposals.set('proposal',{playerId:p.id});
  room.temple={assignments:[{completedIds:[p.id,q.id]}],weeks:[{totals:[{playerId:p.id,total:4},{playerId:q.id,total:3}]}]};
  room.projectiles=[{playerId:p.id},{playerId:q.id}];room.starCards=[{userId:p.id},{userId:q.id}];
  room.energyDrops=new Map([['drop',{shares:new Map([[p.id,1],[q.id,1]]),partyRollEligible:[p.id,q.id],rollState:{participantIds:[p.id,q.id]}}]]);
  room.monsters=new Map([['monster',{targetId:p.id,attackers:new Map([[p.id,1]]),contributors:new Map([[p.id,5]])}]]);
  deleteStudentAccounts(store,room,teacher,[p.id],now);
  assert.equal(q.starShards,7);assert.equal(planet.work.distribution,null);assert.equal(planet.rename,null);assert.deepEqual(planet.joinRequests,[]);
  for(const field of ['trades','summons','partyInvites','piscesInvites','ariesInvites','cancerInvites','cetusInvites','parties','proposals'])assert.equal(room[field].size,0,field);
  assert.deepEqual(room.temple.assignments[0].completedIds,[q.id]);assert.deepEqual(room.temple.weeks[0].totals,[{playerId:q.id,total:3}]);
  assert.deepEqual(room.projectiles,[{playerId:q.id}]);assert.deepEqual(room.starCards,[{userId:q.id}]);
  assert.deepEqual([...room.energyDrops.get('drop').shares],[[q.id,1]]);assert.equal(room.monsters.get('monster').targetId,null);
});

test('weekly deletion clears source-dependent constraints but preserves copied ability and used/reward ledgers',async t=>{
  const {store,room,teacher,students:[p,q]}=await fixture(t);
  q.constellationAbilityState={...freshConstellationAbilityState(),usedWeek:week,
    lastResult:{constellationId:'cetus',level:5,roll:null,reward:0,targetId:p.id,uses:1},cetus:{week,targetIds:[p.id]},
    ophiuchus:{week,usedLevels:[4],bonusUsedLevels:[],copied:{fromId:p.id,constellationId:'cetus',level:5,used:true,useCount:1,usedLevels:[],endsAt:now+7*86400000,state:{...freshConstellationAbilityState(),cetusUnclaimed:4}}},
    paralysis:{sourceId:p.id,level:4,startsAt:now,endsAt:now+86400000},abilitySeal:{sourceId:p.id,endsAt:now+7*86400000},
    leoChallenges:[{sourceId:p.id,level:2,startsAt:now,endsAt:now+86400000,rewarded:false}],leoUnclaimed:2,
    ariesSleep:{sourceId:p.id,startsAt:now,endsAt:now+86400000,reward:1,wakeCost:0}};
  store.transact(()=>deleteStudentAccounts(store,room,teacher,[p.id],now));
  const state=q.constellationAbilityState;
  assert.equal(state.paralysis,null);assert.equal(state.abilitySeal,null);assert.deepEqual(state.leoChallenges,[]);
  assert.equal(state.usedWeek,week);assert.equal(state.ophiuchus.copied.fromId,p.id);assert.equal(state.ophiuchus.copied.state.cetusUnclaimed,4);
  assert.equal(state.leoUnclaimed,2);assert.equal(state.ariesSleep.reward,1);validateConstellationAbilityState(state);
  assert.equal(fromRecord(toRecord(room),now).players.get(q.id).constellationAbilityState.usedWeek,week);
});

test('failed deletion restores references/sessions and successful full-capacity deletion makes one new slot',async t=>{
  const {store,room,teacher,students}=await fixture(t,Array.from({length:RULES.maxStudents},(_,i)=>'가상'+(i+1)));
  const p=students[0],session=store.join({code:room.code,nickname:p.nickname,pin:'1234'},'student');
  const token=p.token,before=structuredClone(store.records.get(room.code)),save=store.files.save;
  store.files.save=()=>{throw Error('fixture write failure');};
  assert.throws(()=>store.transact(()=>deleteStudentAccounts(store,room,teacher,[p.id],now)),/fixture write failure/);
  store.files.save=save;
  const restored=store.rooms.get(room.code),restoredTeacher=restored.players.get(teacher.id);
  assert.equal(restored.players.get(p.id),p);assert.equal(store.sessions.get(token).player,p);assert.equal(store.sessions.get(token).room,restored);
  assert.deepEqual(store.records.get(room.code),before);assert.equal(restored.allowedNames.has(p.nickname),true);
  assert.throws(()=>store.transact(()=>store.createStudent(restored,{nickname:'새가상',pin:'1234'})));
  const current=store.rooms.get(room.code);
  store.transact(()=>deleteStudentAccounts(store,current,current.players.get(restoredTeacher.id),[p.id],now));
  assert.equal(store.sessions.has(token),false);
  assert.throws(()=>store.join({code:room.code,nickname:p.nickname,pin:'1234'},'new-socket'));
  const replacement=store.transact(()=>store.createStudent(current,{nickname:p.nickname,pin:'4321'}));
  assert.notEqual(replacement.id,p.id);assert.equal(replacement.starShards,0);assert.equal(current.allowedNames.size,RULES.maxStudents);
  assert.equal(session.player.id,p.id);
});

test('socket deletion closes only selected account after commit, denies old login/token, and rollback keeps it usable',async t=>{
  const dir=await mkdtemp(join(tmpdir(),'delete-socket-')),sockets=[];
  let game=createClassroomServer({teacherKey:key,dataDir:dir,studentHours:false,clock:()=>now}),address=await game.listen();
  t.after(async()=>{for(const s of sockets)s.disconnect();await game.close();await rm(dir,{recursive:true,force:true});});
  async function connect(){const s=io('http://127.0.0.1:'+address.port,{transports:['websocket'],reconnection:false});sockets.push(s);await new Promise((resolve,reject)=>{s.once('connect',resolve);s.once('connect_error',reject);});return s;}
  const teacher=await connect(),created=await call(teacher,'room:create',{teacherKey:key,title:'가상교실',studentAccounts:[{nickname:'별이',pin:'1234'}]});assert.ok(created.ok,created.error);
  const student=await connect(),login=await call(student,'room:join',{code:created.room.code,nickname:'별이',pin:'1234'});assert.ok(login.ok,login.error);
  let closed=0;student.on('room:closed',()=>closed++);
  assert.equal((await call(student,'student:delete',{playerIds:[login.selfId]})).ok,false);
  assert.equal((await call(teacher,'student:delete',{playerIds:[login.selfId,created.selfId]})).ok,false);
  const save=game.store.files.save;game.store.files.save=()=>{throw Error('fixture write failure');};
  const failed=await call(teacher,'student:delete',{playerIds:[login.selfId]});game.store.files.save=save;
  assert.equal(failed.ok,false);assert.equal(closed,0);assert.equal(game.store.sessions.has(login.token),true);
  assert.ok((await call(student,'constellation-ability:status')).ok);
  const removed=await call(teacher,'student:delete',{playerIds:[login.selfId]});assert.ok(removed.ok,removed.error);assert.deepEqual(removed.deletedIds,[login.selfId]);
  await new Promise(resolve=>setTimeout(resolve,30));assert.equal(closed,1);
  assert.equal((await call(student,'constellation-ability:status')).ok,false);
  assert.equal((await call(student,'session:resume',{token:login.token})).ok,false);
  assert.equal((await call(student,'room:join',{code:created.room.code,nickname:'별이',pin:'1234'})).ok,false);
  await game.close();game=createClassroomServer({teacherKey:key,dataDir:dir,studentHours:false,clock:()=>now});address=await game.listen();
  const reopened=await call(await connect(),'room:open',{teacherKey:key,code:created.room.code});assert.ok(reopened.ok,reopened.error);
  assert.equal(reopened.room.players.filter(p=>p.role==='student').length,0);
});
