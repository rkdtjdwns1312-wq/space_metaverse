import test from 'node:test';
import assert from 'node:assert/strict';
import {io} from 'socket.io-client';
import {createClassroomServer} from '../server/app.js';
import {ensureVitals} from '../server/vitals.js';
import {toRecord} from '../server/persistent-rooms.js';

test('물병 소켓: 위조 수치 무시, 같은맵 상태·회복, 쿨타임, 저장 제외',async t=>{
  let now=1000000;const key='aquarius-isolated-test',game=createClassroomServer({teacherKey:key,studentHours:false,clock:()=>now}),{port}=await game.listen(),sockets=[];
  t.after(async()=>{sockets.forEach(s=>s.disconnect());await game.close();});
  const connect=async()=>{const s=io(`http://127.0.0.1:${port}`,{transports:['websocket'],reconnection:false,autoConnect:false});sockets.push(s);await new Promise((r,j)=>{s.once('connect',r);s.once('connect_error',j);s.connect();});return s;};
  const call=(s,e,d={})=>s.timeout(3000).emitWithAck(e,d),teacher=await connect(),a=await connect(),b=await connect(),other=await connect();
  const made=await call(teacher,'room:create',{teacherKey:key,allowedNames:['물병검사','회복검사']});
  const joined=await call(a,'room:join',{code:made.room.code,nickname:'물병검사'}),peer=await call(b,'room:join',{code:made.room.code,nickname:'회복검사'});
  await call(other,'room:create',{teacherKey:key,allowedNames:['다른교실']});
  const room=game.store.rooms.get(made.room.code),p=room.players.get(joined.selfId),friend=room.players.get(peer.selfId);
  Object.assign(p,{x:1800,y:1320,facing:{x:1,y:0}});Object.assign(p.avatar,{level:4,constellationId:'aquarius'});
  Object.assign(friend,{x:2117.4,y:1320});Object.assign(friend.avatar,{level:4,constellationId:'leo'});ensureVitals(friend).hp=1;
  let outsideViews=0,heals=0,view=null;other.on('world:positions',d=>outsideViews+=(d.aquarius?.length||0));
  a.on('world:positions',d=>{if(d.aquarius?.length)view=d.aquarius[0];});b.on('combat:vitals',d=>{if(d.playerId===friend.id)heals++;});
  const r=await call(a,'combat:skill',{mana:0,power:99999,x:0,durationMs:999999});assert.equal(r.ok,true);assert.equal(r.vitals.mp.current,40);assert.equal(r.cooldowns[0],now+20000);
  await new Promise(r=>setTimeout(r,160));assert.ok(view);assert.equal(view.x,2117.4);assert.equal(view.durationMs,5000);assert.equal(view.rx/view.ry,2);
  assert.equal((await call(a,'combat:skill')).ok,false);assert.equal(ensureVitals(p).mp,40);
  for(const slot of [1,2,3])assert.equal((await call(a,'combat:skill',{slot})).ok,false);
  now+=5000;await new Promise(r=>setTimeout(r,160));assert.equal(ensureVitals(friend).hp,31);assert.ok(heals>0);assert.equal(outsideViews,0);assert.equal(room.aquariusCasts.size,0);
  const saved=JSON.stringify(toRecord(room));for(const name of ['aquariusCasts','aquariusCooldownUntil','healBudgets'])assert.ok(!saved.includes(name));
  const q=await call(a,'combat:attack');assert.equal(q.ok,true);assert.equal(q.hit.kind,'aquarius-attack');assert.equal((await call(a,'combat:attack')).ok,false);
});
