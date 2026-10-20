import test from 'node:test';
import assert from 'node:assert/strict';
import {io} from 'socket.io-client';
import {createClassroomServer} from '../server/app.js';
import {ensureVitals} from '../server/vitals.js';
import {avatarSizeOf} from '../shared/avatar-size.js';

test('실제 소켓: 천칭 E 후 아군 피격은 반사하고 영역 이탈/만료 후 피해 재개',async t=>{
  // The room timer uses wall time for animation expiry, so keep this fixture on the same epoch.
  let now=Date.now();
  const key='libra-isolated-test-key',game=createClassroomServer({teacherKey:key,studentHours:false,clock:()=>now,dataDir:null});
  const {port}=await game.listen(),sockets=[];
  t.after(async()=>{sockets.forEach(s=>s.disconnect());await game.close();});
  const connect=async()=>{
    const socket=io(`http://127.0.0.1:${port}`,{transports:['websocket'],reconnection:false,autoConnect:false});
    sockets.push(socket);
    await new Promise((resolve,reject)=>{socket.once('connect',resolve);socket.once('connect_error',reject);socket.connect();});
    return socket;
  };
  const call=(s,event,data={})=>s.timeout(3000).emitWithAck(event,data),teacher=await connect();
  const created=await call(teacher,'room:create',{teacherKey:key,allowedNames:['caster','ally','attacker']});
  assert.equal(created.ok,true);
  const room=game.store.rooms.get(created.room.code),players=[],clients=[];
  for(const name of ['caster','ally','attacker']){
    const socket=await connect(),joined=await call(socket,'room:join',{code:created.room.code,nickname:name});
    assert.equal(joined.ok,true);clients.push(socket);players.push(room.players.get(joined.selfId));
  }
  const [caster,ally,attacker]=players;
  players.forEach(p=>{Object.assign(p,{mapId:'star-origin-1',x:500,y:450});Object.assign(p.avatar,{level:4,blackStar:false});});
  caster.avatar.constellationId='libra';ally.avatar.constellationId='sagittarius';attacker.avatar.constellationId='hercules';
  attacker.x=850;attacker.facing={x:-1,y:0};ally.x=attacker.x-avatarSizeOf(attacker)*.75;
  room.monsters=new Map();
  const cast=await call(clients[0],'combat:skill',{slot:0});assert.equal(cast.ok,true);
  const hp=ensureVitals(ally).hp,attackerHp=ensureVitals(attacker).hp;
  const attack=async()=>{
    const result=await call(clients[2],'combat:attack');assert.equal(result.ok,true);
    const hit=result.playerTargets.find(h=>h.targetId===ally.id);assert.ok(hit);return hit;
  };
  const protectedHit=await attack();assert.equal(protectedHit.damage,0);assert.ok(protectedHit.reflectedDamage>0);
  assert.equal(ensureVitals(ally).hp,hp);assert.ok(ensureVitals(attacker).hp<attackerHp);
  caster.x+=2000;now+=1000;
  assert.ok((await attack()).damage>0);
  caster.x-=2000;now+=1000;
  assert.equal((await attack()).damage,0);
  now=caster.libraAura.endsAt;
  assert.ok((await attack()).damage>0);
});
