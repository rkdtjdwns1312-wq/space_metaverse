import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {io} from 'socket.io-client';
import {createClassroomServer} from '../server/app.js';
import {toRecord,fromRecord} from '../server/persistent-rooms.js';
import {validateMissions,missionViews} from '../server/missions.js';
import {SHARDS} from '../shared/config.js';

const KEY='mission-history-test',call=(socket,event,data={})=>socket.timeout(4000).emitWithAck(event,data);
const ok=result=>{assert.equal(result.ok,true,result.error);return result;};
async function fixture(t){
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'mission-history-')),sockets=[];
  let game,url,teacher,student,other,code,id,otherId,now=Date.now(),closed=true;
  async function start(){game=createClassroomServer({teacherKey:KEY,dataDir:dir,studentHours:false,teacherManagedAccounts:false,unattended:false,clock:()=>now});url=`http://127.0.0.1:${(await game.listen()).port}`;closed=false;}
  async function connect(){const socket=io(url,{transports:['websocket'],reconnection:false,forceNew:true});sockets.push(socket);await new Promise((resolve,reject)=>{socket.once('connect',resolve);socket.once('connect_error',reject);});return socket;}
  t.after(async()=>{sockets.forEach(s=>s.disconnect());if(!closed)await game.close();assert(path.resolve(dir).startsWith(path.resolve(os.tmpdir())+path.sep)&&path.basename(dir).startsWith('mission-history-'));fs.rmSync(dir,{recursive:true,force:true});});
  await start();teacher=await connect();code=ok(await call(teacher,'room:create',{teacherKey:KEY,title:'미션 기록 검사',allowedNames:['하나','둘']})).room.code;
  student=await connect();id=ok(await call(student,'room:join',{code,nickname:'하나',pin:'1234'})).selfId;
  other=await connect();otherId=ok(await call(other,'room:join',{code,nickname:'둘',pin:'1234'})).selfId;
  const f={get game(){return game;},get room(){return game.store.rooms.get(code);},get p(){return f.room.players.get(id);},get q(){return f.room.players.get(otherId);},
    get student(){return student;},get teacher(){return teacher;},get other(){return other;},get now(){return now;},advance(){now+=5000;},
    view(){return game.store.snapshot(f.room,f.p);},mutate(fn){game.store.transact(()=>fn(f.room,f.p));},
    async create(){return ok(await call(teacher,'mission:create',{title:'친구 돕기',description:'친구를 한 번 도와주기',rewardShards:2,distribution:'all'})).missionId;},
    async fail(work){const save=game.store.files.save.bind(game.store.files);game.store.files.save=()=>{throw Error('mission history disk failure');};try{await work();}finally{game.store.files.save=save;}},
    async restart(){sockets.forEach(s=>s.disconnect());await game.close();closed=true;await start();teacher=await connect();ok(await call(teacher,'room:open',{teacherKey:KEY,code}));student=await connect();ok(await call(student,'room:join',{code,nickname:'하나',pin:'1234'}));other=await connect();ok(await call(other,'room:join',{code,nickname:'둘',pin:'1234'}));}
  };return f;
}

test('mission claim uses the server clock, isolates student dates, rejects duplicates and survives cold restart',async t=>{
  const f=await fixture(t),id=await f.create();
  assert.equal(f.view().missions.find(m=>m.id===id).status,'active');
  assert.equal((await call(f.student,'mission:claim',{missionId:id,claimedAt:123})).ok,false);
  ok(await call(f.teacher,'mission:confirm',{missionId:id,studentId:f.p.id}));
  assert.equal(f.view().missions.find(m=>m.id===id).claimedAt,null);
  f.advance();const now=f.now;
  const results=await Promise.all([call(f.student,'mission:claim',{missionId:id,claimedAt:123}),call(f.student,'mission:claim',{missionId:id,claimedAt:456})]);
  assert.equal(results.filter(r=>r.ok).length,1);assert.equal(results.find(r=>r.ok).claimedAt,now);
  assert.equal(f.p.starShards,2);assert.equal(f.room.missions[0].claimedAt[f.p.id],now);
  assert.equal(f.view().missions.find(m=>m.id===id).claimedAt,now);
  const otherView=f.game.store.snapshot(f.room,f.q);assert.equal(otherView.missions.find(m=>m.id===id).claimedAt,null);
  assert.equal(JSON.stringify(otherView.missions).includes(f.p.id),false);
  assert.equal((await call(f.other,'mission:claim',{missionId:id,playerId:f.p.id})).ok,false);
  assert.equal((await call(f.teacher,'mission:claim',{missionId:id})).ok,false);
  await f.restart();assert.equal(f.view().missions.find(m=>m.id===id).claimedAt,now);assert.equal(f.p.starShards,2);
  f.advance();assert.equal((await call(f.student,'mission:claim',{missionId:id})).ok,false);assert.equal(f.room.missions[0].claimedAt[f.p.id],now);
});

test('mission and tutorial dates/rewards roll back together without publishing failed snapshots',async t=>{
  const f=await fixture(t),id=await f.create();ok(await call(f.teacher,'mission:confirm',{missionId:id,studentId:f.p.id}));
  const published=[];f.student.on('room:state',state=>published.push(state));
  await f.fail(async()=>assert.equal((await call(f.student,'mission:claim',{missionId:id})).ok,false));
  assert.equal(f.p.starShards,0);assert.equal(f.view().missions.find(m=>m.id===id).status,'ready');assert.equal(f.room.missions[0].claimedAt,undefined);
  assert.equal(published.some(s=>s.missions.find(m=>m.id===id)?.status==='claimed'),false);
  await f.fail(async()=>assert.equal((await call(f.student,'tutorial:complete',{completedAt:1})).ok,false));
  assert.equal(f.p.tutorialCompleted,false);assert.equal(f.p.tutorialCompletedAt,null);
  f.advance();ok(await call(f.student,'tutorial:complete',{completedAt:1}));const completedAt=f.now;
  assert.equal(f.p.tutorialCompletedAt,completedAt);f.advance();ok(await call(f.student,'tutorial:complete'));assert.equal(f.p.tutorialCompletedAt,completedAt);
  await f.fail(async()=>assert.equal((await call(f.student,'mission:claim',{missionId:'first-journey'})).ok,false));
  assert.equal(f.p.tutorialRewardClaimed,false);assert.equal(f.p.tutorialRewardClaimedAt,null);assert.equal(f.p.starShards,0);
  assert.equal(published.some(s=>s.missions.find(m=>m.id==='first-journey')?.status==='claimed'),false);
  const claimedAt=f.now;ok(await call(f.student,'mission:claim',{missionId:'first-journey',claimedAt:1}));
  assert.equal(f.p.tutorialRewardClaimedAt,claimedAt);assert.notEqual(claimedAt,completedAt);
  assert.equal(f.view().missions.find(m=>m.id==='first-journey').claimedAt,claimedAt);
  assert.equal(f.game.store.snapshot(f.room,f.q).players.find(p=>p.id===f.p.id).tutorialRewardClaimedAt,undefined);
  f.advance();assert.equal((await call(f.student,'mission:claim',{missionId:'first-journey'})).ok,false);assert.equal(f.p.tutorialRewardClaimedAt,claimedAt);
  await f.restart();assert.equal(f.p.tutorialCompletedAt,completedAt);assert.equal(f.p.tutorialRewardClaimedAt,claimedAt);assert.equal(f.p.starShards,1);
  ok(await call(f.student,'mission:claim',{missionId:id}));assert.equal(f.p.starShards,3);
});

test('full shard bag leaves both mission types ready with no claim date',async t=>{
  const f=await fixture(t),id=await f.create();ok(await call(f.teacher,'mission:confirm',{missionId:id,studentId:f.p.id}));ok(await call(f.student,'tutorial:complete'));
  f.mutate((room,p)=>{p.starShards=SHARDS.max;});
  for(const missionId of [id,'first-journey']){assert.equal((await call(f.student,'mission:claim',{missionId})).ok,false);const view=f.view().missions.find(m=>m.id===missionId);assert.equal(view.status,'ready');assert.equal(view.claimedAt,null);}
  assert.equal(f.p.starShards,SHARDS.max);
});

test('legacy completion has no invented date and invalid saved dates are rejected',async t=>{
  const f=await fixture(t),id=await f.create();ok(await call(f.teacher,'mission:confirm',{missionId:id,studentId:f.p.id}));ok(await call(f.student,'mission:claim',{missionId:id}));ok(await call(f.student,'tutorial:complete'));ok(await call(f.student,'mission:claim',{missionId:'first-journey'}));
  const saved=toRecord(f.room);delete saved.missions[0].claimedAt;
  const p=saved.students.find(p=>p.id===f.p.id);delete p.tutorialRewardClaimed;delete p.tutorialCompletedAt;delete p.tutorialRewardClaimedAt;
  const restored=fromRecord(saved),player=restored.players.get(p.id),views=missionViews(restored,player);
  for(const missionId of [id,'first-journey']){const m=views.find(m=>m.id===missionId);assert.equal(m.status,'claimed');assert.equal(m.claimedAt,null);}
  assert.equal(player.tutorialCompletedAt,null);assert.equal(player.tutorialRewardClaimedAt,null);
  for(const invalid of [-1,1.5,'2026-10-13',8640000000000001]){
    const bad=structuredClone(saved);bad.missions[0].claimedAt={[p.id]:invalid};assert.throws(()=>fromRecord(bad));
    for(const field of ['tutorialCompletedAt','tutorialRewardClaimedAt']){const bad=structuredClone(saved);bad.students.find(s=>s.id===p.id)[field]=invalid;assert.throws(()=>fromRecord(bad));}
  }
  for(const value of [null,[],{[f.q.id]:123}]){const bad=structuredClone(saved.missions);bad[0].claimedAt=value;assert.throws(()=>validateMissions(bad));}
  f.mutate((room,p)=>{p.tutorialCompleted=true;p.tutorialRewardClaimed=true;p.tutorialCompletedAt=null;p.tutorialRewardClaimedAt=null;delete room.missions[0].claimedAt;});
  ok(await call(f.student,'tutorial:complete'));assert.equal(f.p.tutorialCompletedAt,null);assert.equal(f.p.tutorialRewardClaimedAt,null);
});
