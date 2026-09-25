import test from 'node:test';
import assert from 'node:assert/strict';
import {io} from 'socket.io-client';
import {CONSTELLATIONS} from '../shared/constellations.js';
import {SKILL_EFFECTS,skillEffectOf,skillEffectById} from '../shared/skill-effects.js';
import {createClassroomServer} from '../server/app.js';
import {monstersOf} from '../server/monsters.js';

test('스킬 효과 카탈로그는 16종×LV2~5가 유일하고 단계별 크기·입자·레이어·시간이 증가한다',()=>{
 assert.equal(SKILL_EFFECTS.length,64);
 assert.equal(new Set(SKILL_EFFECTS.map(effect=>effect.id)).size,64);
 for(const constellation of CONSTELLATIONS){
  const stages=[2,3,4,5].map(level=>skillEffectOf(constellation.id,level));
  assert.ok(stages.every(Boolean));
  assert.deepEqual(stages.map(effect=>effect.constellationId),Array(4).fill(constellation.id));
  assert.deepEqual(stages.map(effect=>effect.level),[2,3,4,5]);
  for(let i=1;i<stages.length;i++){
   for(const key of ['extent','particleCount','layers','durationMs'])assert.ok(stages[i][key]>stages[i-1][key],`${constellation.id} ${key}`);
  }
  for(const effect of stages)assert.strictEqual(skillEffectById(effect.id),effect);
 }
});

test('스킬 효과 조회는 잘못된 별자리·단계·ID에 null을 반환한다',()=>{
 for(const args of [['missing',2],['gemini',1],['gemini',6],['gemini',2.5],['gemini','2'],[null,2],[undefined,2]])assert.equal(skillEffectOf(...args),null);
 for(const id of [null,undefined,'','gemini-lv1','gemini-lv6',{},42])assert.equal(skillEffectById(id),null);
});

test('실제 소켓 스킬은 16종×4단계에서 서버 효과·방향만 반환하고 위조 입력·전투 상태·방 누출을 무시한다',async t=>{
 let now=100000;
 const game=createClassroomServer({teacherKey:'skill-effects-test-private-key',studentHours:false,clock:()=>now});
 const {port}=await game.listen();
 const sockets=[];
 t.after(async()=>{for(const socket of sockets)socket.disconnect();await game.close();});
 const connect=async()=>{
  const socket=io(`http://127.0.0.1:${port}`,{transports:['websocket'],reconnection:false});sockets.push(socket);
  await new Promise((resolve,reject)=>{socket.once('connect',resolve);socket.once('connect_error',reject);});
  return socket;
 };
 const call=(socket,event,data={})=>socket.timeout(3000).emitWithAck(event,data);
 const teacher=await connect();
 const created=await call(teacher,'room:create',{teacherKey:'skill-effects-test-private-key',allowedNames:['1','2']});
 assert.equal(created.ok,true,created.error);
 const student=await connect(),peer=await connect();
 const joined=await call(student,'room:join',{code:created.room.code,nickname:'1'});
 const joinedPeer=await call(peer,'room:join',{code:created.room.code,nickname:'2'});
 const room=game.store.rooms.get(created.room.code);
 const player=room.players.get(joined.selfId),peerPlayer=room.players.get(joinedPeer.selfId);
 const monster=monstersOf(room).get('star-crab');
 Object.assign(player,{mapId:monster.mapId,x:monster.x-62,y:monster.y,facing:{x:0,y:-1}});
 Object.assign(peerPlayer,{mapId:'star-origin-2',x:monster.x+300,y:monster.y});
 const teacherPlayer=[...room.players.values()].find(candidate=>candidate.role==='teacher');
 Object.assign(teacherPlayer,{mapId:monster.mapId,x:monster.x+300,y:monster.y});
 const otherTeacher=await connect();
 const otherCreated=await call(otherTeacher,'room:create',{teacherKey:'skill-effects-test-private-key',allowedNames:['1']});
 const otherRoomSocket=await connect();
 await call(otherRoomSocket,'room:join',{code:otherCreated.room.code,nickname:'1'});
 const before={hp:player.hp,mp:player.mp,xp:player.avatar.xp,inventory:structuredClone(player.inventory),shards:player.starShards,targetId:monster.targetId,monsterHp:monster.hp};
 for(const constellation of CONSTELLATIONS)for(const level of [2,3,4,5]){
  player.avatar.constellationId=constellation.id;player.avatar.level=level;
  now+=500;
  const effect=skillEffectOf(constellation.id,level);
  const peerHit=new Promise(resolve=>teacher.once('combat:hit',resolve));
  let otherMapHits=0,otherRoomHits=0;
  const mapListener=()=>otherMapHits++;const roomListener=()=>otherRoomHits++;
  peer.on('combat:hit',mapListener);otherRoomSocket.on('combat:hit',roomListener);
  const result=await call(student,'combat:skill',{dx:1,dy:1,effectId:'gemini-lv5',level:99,power:999});
  assert.deepEqual(result,{ok:true,ready:false,direction:{x:0,y:-1},effectId:effect.id});
  const hit=await peerHit;
  assert.deepEqual({kind:hit.kind,effectId:hit.effectId,durationMs:hit.durationMs,dx:hit.dx,dy:hit.dy},{kind:'skill',effectId:effect.id,durationMs:effect.durationMs,dx:0,dy:-1});
  await new Promise(resolve=>setTimeout(resolve,10));
  peer.off('combat:hit',mapListener);otherRoomSocket.off('combat:hit',roomListener);
  assert.equal(otherMapHits,0);assert.equal(otherRoomHits,0);
  assert.equal(player.hp,before.hp);assert.equal(player.mp,before.mp);assert.equal(player.avatar.xp,before.xp);assert.deepEqual(player.inventory,before.inventory);assert.equal(player.starShards,before.shards);assert.equal(monster.targetId,before.targetId);assert.equal(monster.hp,before.monsterHp);
 }
});
