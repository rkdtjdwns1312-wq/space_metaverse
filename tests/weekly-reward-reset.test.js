import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {io} from 'socket.io-client';
import {recordReward,weeklyRewards,resetWeeklyRewards,validateTemple,weekStart} from '../server/temple.js';
import {PersistentRoomStore} from '../server/persistent-rooms.js';
import {createClassroomServer} from '../server/app.js';
import {MAP,PLAZA_ID} from '../shared/config.js';

const now=Date.parse('2026-10-01T12:00:00+09:00');
function fixture(){
  const teacher={id:'teacher',role:'teacher'},student={id:'student',role:'student',nickname:'학생',starShards:42};
  return {teacher,student,room:{players:new Map([[teacher.id,teacher],[student.id,student]]),planets:new Map([['p',{work:{balance:100}}]]),itemLog:[{id:'existing'}],tradeLog:[{id:'trade'}]}};
}
test('이번 주 집계 기준만 초기화하며 누적 지급·다른 주·잔액·부서 재화·로그는 보존한다',()=>{
  const {room,teacher,student}=fixture();recordReward(room,student.id,4,now-7*86400000);recordReward(room,student.id,7,now);
  const preserved=structuredClone({planets:room.planets,itemLog:room.itemLog,tradeLog:room.tradeLog}),past=structuredClone(room.temple.weeks[1]);
  assert.throws(()=>resetWeeklyRewards(room,student,now));assert.throws(()=>resetWeeklyRewards(room,{...teacher},now));
  assert.equal(resetWeeklyRewards(room,teacher,now).rows[0].total,0);assert.equal(student.starShards,42);
  assert.deepEqual({planets:room.planets,itemLog:room.itemLog,tradeLog:room.tradeLog},preserved);assert.deepEqual(room.temple.weeks[1],past);
  assert.deepEqual(room.temple.weeks[0].totals[0],{playerId:student.id,total:7,resetTotal:7});
  recordReward(room,student.id,3,now);recordReward(room,student.id,-2,now);assert.equal(weeklyRewards(room,now).rows[0].total,3);
  resetWeeklyRewards(room,teacher,now);recordReward(room,student.id,2,now);assert.equal(weeklyRewards(room,now).rows[0].total,2);
  assert.equal(room.temple.weeks[0].totals[0].total,12);assert.equal(room.temple.weeks[0].totals[0].resetTotal,10);
  const next=now+7*86400000;assert.equal(weeklyRewards(room,next).rows[0].total,0);recordReward(room,student.id,5,next);assert.equal(weeklyRewards(room,next).rows[0].total,5);
});
test('집계 기준 저장 형식은 구버전 호환·상한·정수·음수·잘못된 타입을 검증한다',()=>{
  const {room,student,teacher}=fixture();recordReward(room,student.id,7,now);const old=structuredClone(room.temple);
  assert.deepEqual(validateTemple(old),old);resetWeeklyRewards(room,teacher,now);assert.deepEqual(validateTemple(room.temple),room.temple);
  for(const value of [-1,1.5,8,'7',null,Infinity,Number.MAX_SAFE_INTEGER+1]){
    const bad=structuredClone(room.temple);bad.weeks[0].totals[0].resetTotal=value;assert.throws(()=>validateTemple(bad),/resetTotal/);
  }
  const empty=fixture();assert.equal(resetWeeklyRewards(empty.room,empty.teacher,now).rows[0].total,0);assert.equal(empty.room.temple.weeks.length,0);
});
test('집계 초기화 저장 실패 복구·재시작 보존·이후 지급 재집계',()=>{
  const dir=mkdtempSync(join(tmpdir(),'weekly-reset-store-'));let store;
  try{
    store=new PersistentRoomStore(dir,{teacherManagedAccounts:true});let {room,player}=store.transact(()=>store.create({allowedNames:['1']},'teacher'));
    const code=room.code,id=player.id,student=[...room.players.values()].find(p=>p.role==='student');
    store.transact(()=>{recordReward(room,student.id,7,now);student.starShards=42;});const save=store.files.save.bind(store.files);
    store.files.save=()=>{throw Error('disk full');};assert.throws(()=>store.transact(()=>resetWeeklyRewards(room,player,now)),/disk full/);
    room=store.rooms.get(code);player=room.players.get(id);assert.equal(weeklyRewards(room,now).rows[0].total,7);store.files.save=save;
    store.transact(()=>resetWeeklyRewards(room,player,now));store.close();store=new PersistentRoomStore(dir);
    ({room,player}=store.transact(()=>store.open({code},'teacher2')));assert.equal(weeklyRewards(room,now).rows[0].total,0);assert.equal(room.players.get(student.id).starShards,42);
    store.transact(()=>recordReward(room,student.id,3,now));assert.equal(weeklyRewards(room,now).rows[0].total,3);
    store.close();store=new PersistentRoomStore(dir);({room}=store.transact(()=>store.open({code},'teacher3')));assert.equal(weeklyRewards(room,now).rows[0].total,3);
  }finally{store?.close();rmSync(dir,{recursive:true,force:true});}
});
test('실제 소켓: 교사만·해당 기둥 근접·교실 격리·실패 복구·지급 후 재집계',async t=>{
  const dir=mkdtempSync(join(tmpdir(),'weekly-reset-socket-')),key='weekly-reset-test-private',sockets=[];
  const game=createClassroomServer({teacherKey:key,dataDir:dir,studentHours:false}),address=await game.listen();
  t.after(async()=>{sockets.forEach(s=>s.disconnect());await game.close();rmSync(dir,{recursive:true,force:true});});
  const connect=async()=>{const s=io('http://127.0.0.1:'+address.port,{transports:['websocket'],reconnection:false});sockets.push(s);await new Promise(r=>s.once('connect',r));return s;};
  const call=(s,event,data={})=>s.timeout(3000).emitWithAck(event,data),teacher=await connect(),student=await connect(),other=await connect();
  assert.equal((await call(student,'temple:weekly:reset',{objectId:'pillar-weekly'})).ok,false);
  const created=await call(teacher,'room:create',{teacherKey:key,studentAccounts:[{nickname:'1',pin:'1234'}]}),joined=await call(student,'room:join',{code:created.room.code,nickname:'1',pin:'1234'});
  assert.equal(joined.ok,true);const otherCreated=await call(other,'room:create',{teacherKey:key,studentAccounts:[{nickname:'2',pin:'1234'}]});
  const room=()=>game.store.rooms.get(created.room.code),approach=(id,objectId)=>{const p=room().players.get(id),pillar=MAP.objects.find(o=>o.id===objectId);Object.assign(p,{mapId:PLAZA_ID,x:pillar.x+65,y:pillar.y});};
  assert.equal((await call(teacher,'shards:give',{playerId:joined.selfId,amount:7})).ok,true);
  assert.equal((await call(teacher,'temple:weekly:reset',{objectId:'pillar-weekly'})).ok,false);
  approach(created.selfId,'pillar-notice');assert.equal((await call(teacher,'temple:weekly:reset',{objectId:'pillar-notice'})).ok,false);
  approach(created.selfId,'pillar-weekly');approach(joined.selfId,'pillar-weekly');
  assert.equal((await call(student,'temple:read',{objectId:'pillar-weekly'})).canReset,false);
  assert.equal((await call(student,'temple:weekly:reset',{objectId:'pillar-weekly',role:'teacher',playerId:created.selfId,teacherKey:key})).ok,false);
  assert.equal(weeklyRewards(room()).rows[0].total,7);
  const preserved=structuredClone({planets:room().planets,itemLog:room().itemLog,tradeLog:room().tradeLog});
  const save=game.store.files.save.bind(game.store.files);game.store.files.save=()=>{throw Error('simulated disk full');};
  assert.equal((await call(teacher,'temple:weekly:reset',{objectId:'pillar-weekly'})).ok,false);assert.equal(weeklyRewards(room()).rows[0].total,7);game.store.files.save=save;
  assert.equal((await call(teacher,'temple:weekly:reset',{objectId:'pillar-weekly',code:otherCreated.room.code,week:'2000-01-03'})).rows[0].total,0);
  assert.equal(room().players.get(joined.selfId).starShards,7);assert.deepEqual({planets:room().planets,itemLog:room().itemLog,tradeLog:room().tradeLog},preserved);
  assert.equal(game.store.records.get(created.room.code).temple.weeks.find(w=>w.week===weekStart()).totals[0].resetTotal,7);
  assert.equal(game.store.rooms.get(otherCreated.room.code).temple?.weeks?.length||0,0);
  assert.equal((await call(teacher,'shards:give',{playerId:joined.selfId,amount:3})).ok,true);
  const read=await call(student,'temple:read',{objectId:'pillar-weekly'});assert.equal(read.rows[0].total,3);assert.equal(read.canReset,false);
});
