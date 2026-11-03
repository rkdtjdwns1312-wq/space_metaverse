import test from 'node:test';
import assert from 'node:assert/strict';
import {io} from 'socket.io-client';
import {RoomStore} from '../server/rooms.js';
import {worldBroadcastFrame} from '../server/world-broadcast.js';
import {monsterViews} from '../server/monsters.js';
import {createClassroomServer} from '../server/app.js';
import {chargeHuntingStation} from '../server/hunting-time.js';
import {PLAZA_ID} from '../shared/config.js';

test('one frame shares each map effect/monster view and keeps cooldowns private; the next frame fully replaces it',()=>{
  const store=new RoomStore(),{room,player:teacher}=store.create({allowedNames:['1','2']},'t');
  const a=store.join({code:room.code,nickname:'1'},'a').player,b=store.join({code:room.code,nickname:'2'},'b').player;
  const now=Date.now();a.mapId=b.mapId='star-origin-1';
  a.avatar.constellationId=b.avatar.constellationId='aquarius';
  a.aquariusCooldownUntil=now+3000;b.aquariusCooldownUntil=now+7000;
  room.aquariusCasts=new Map([['cast',{id:'cast',playerId:a.id,mapId:a.mapId,kind:'aquarius-fountain',at:now-100,durationMs:5000}]]);
  const frame=worldBroadcastFrame(room,now),av=frame(a,[]),bv=frame(b,[]),tv=frame(teacher,[]);
  assert.ok(av.monsters.length);assert.ok(av.monsters.every(m=>m.mapId===a.mapId));
  assert.strictEqual(av.monsters,bv.monsters);assert.strictEqual(av.aquarius,bv.aquarius);
  assert.equal(av.aquarius[0].elapsedMs,100);assert.equal(av.sagittarius.serverNow,now);
  assert.deepEqual(av.sagittarius.cooldowns,{0:now+3000});assert.deepEqual(bv.sagittarius.cooldowns,{0:now+7000});
  assert.notStrictEqual(av.sagittarius.cooldowns,bv.sagittarius.cooldowns);
  assert.deepEqual(tv.monsters,[]);assert.deepEqual(tv.aquarius,[]);assert.deepEqual(tv.serena,av.serena);
  const latest=worldBroadcastFrame(room,now+5100)(a,[]);
  assert.deepEqual(latest.aquarius,[]);assert.notStrictEqual(latest.monsters,av.monsters);
  a.mapId=PLAZA_ID;assert.deepEqual(worldBroadcastFrame(room,now+5200)(a,[]).monsters,[]);
});

const call=(socket,event,data={})=>socket.timeout(4000).emitWithAck(event,data);
const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function packet(socket,accept){
  return new Promise((resolve,reject)=>{
    const timer=setTimeout(()=>{socket.off('world:positions',receive);reject(new Error('world snapshot timeout'));},4000);
    function receive(value){if(accept(value)){clearTimeout(timer);socket.off('world:positions',receive);resolve(value);}}
    socket.on('world:positions',receive);
  });
}

test('real sockets isolate monster maps, send complete post-travel frames, clear empty maps and recover after resume',async t=>{
  const key='world-broadcast-test-key',sockets=[];
  const game=createClassroomServer({teacherKey:key,studentHours:false}),address=await game.listen();
  t.after(async()=>{for(const socket of sockets)socket.disconnect();await game.close();});
  const connect=async()=>{
    const socket=io(`http://127.0.0.1:${address.port}`,{transports:['websocket'],reconnection:false,forceNew:true});
    sockets.push(socket);await new Promise((resolve,reject)=>{socket.once('connect',resolve);socket.once('connect_error',reject);});return socket;
  };
  const teacher=await connect(),created=await call(teacher,'room:create',{teacherKey:key,allowedNames:['1','2']});
  assert.ok(created.ok,created.error);
  const a=await connect(),ja=await call(a,'room:join',{code:created.room.code,nickname:'1'});
  const b=await connect(),jb=await call(b,'room:join',{code:created.room.code,nickname:'2'});
  assert.ok(ja.ok,ja.error);assert.ok(jb.ok,jb.error);
  const room=game.store.rooms.get(created.room.code),pa=room.players.get(ja.selfId),pb=room.players.get(jb.selfId);
  chargeHuntingStation(pa,'math');chargeHuntingStation(pb,'math');
  for(const [socket,to] of [[a,'star-origin-1'],[b,'moon-paradise-3']]){
    const result=await call(socket,'map:fast-travel',{to});assert.ok(result.ok,result.error);
  }
  const [av,bv]=await Promise.all([packet(a,v=>v.mapId===pa.mapId),packet(b,v=>v.mapId===pb.mapId)]);
  assert.ok(av.monsters.length);assert.ok(av.monsters.every(m=>m.mapId==='star-origin-1'));
  assert.ok(bv.monsters.some(m=>m.typeId==='noksera'));assert.ok(bv.monsters.every(m=>m.mapId===pb.mapId));
  const oldIds=new Set(av.monsters.map(m=>m.id));
  assert.ok((await call(a,'map:fast-travel',{to:'moon-paradise-3'})).ok);
  const switched=await packet(a,v=>v.mapId==='moon-paradise-3');
  assert.ok(switched.monsters.some(m=>m.typeId==='noksera'));assert.ok(switched.monsters.every(m=>!oldIds.has(m.id)));
  // Ignore one volatile frame: the next one must still contain the complete map.
  const recovered=await packet(a,v=>v.mapId==='moon-paradise-3');
  assert.deepEqual(recovered.monsters.map(m=>m.id),switched.monsters.map(m=>m.id));
  a.disconnect();for(let i=0;i<100&&pa.connected;i++)await pause(10);assert.equal(pa.connected,false);
  const resumed=await connect(),resume=await call(resumed,'session:resume',{token:ja.token});
  assert.ok(resume.ok,resume.error);assert.equal(resume.selfId,ja.selfId);
  const restored=await packet(resumed,v=>v.mapId==='moon-paradise-3');
  assert.deepEqual(restored.monsters.map(m=>m.id),monsterViews(room).filter(m=>m.mapId===pa.mapId).map(m=>m.id));
  assert.ok((await call(resumed,'map:fast-travel',{to:PLAZA_ID})).ok);
  const empty=await packet(resumed,v=>v.mapId===PLAZA_ID);
  assert.deepEqual(empty.monsters,[]);assert.ok(empty.serena&&empty.darkStar&&empty.starRecord&&empty.truthCreator);
});
