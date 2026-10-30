import test from 'node:test';
import assert from 'node:assert/strict';
import {io} from 'socket.io-client';
import {createClassroomServer} from '../server/app.js';
import {ensureVitals} from '../server/vitals.js';
import {monstersOf} from '../server/monsters.js';
import {chargeHuntingStation} from '../server/hunting-time.js';
import {toRecord} from '../server/persistent-rooms.js';

test('real E alternates authoritative stance, broadcasts slam and delayed reward, runtime state not persisted',async t=>{
 const key='hercules-toggle-test',game=createClassroomServer({teacherKey:key,studentHours:false,dataDir:null}),{port}=await game.listen(),sockets=[];
 t.after(async()=>{sockets.forEach(s=>s.disconnect());await game.close();});
 const connect=async()=>{const s=io(`http://127.0.0.1:${port}`,{transports:['websocket'],reconnection:false,autoConnect:false});sockets.push(s);await new Promise((r,j)=>{s.once('connect',r);s.once('connect_error',j);s.connect();});return s;};
 const until=async predicate=>{const end=Date.now()+3000;while(!predicate()&&Date.now()<end)await new Promise(r=>setTimeout(r,20));assert.ok(predicate());};
 const call=(s,e,d={})=>s.timeout(3000).emitWithAck(e,d),teacher=await connect(),a=await connect();
 const made=await call(teacher,'room:create',{teacherKey:key,allowedNames:['곤봉검사']}),joined=await call(a,'room:join',{code:made.room.code,nickname:'곤봉검사'});
 const room=game.store.rooms.get(made.room.code),p=room.players.get(joined.selfId);
 chargeHuntingStation(p,'math',Date.now());Object.assign(p,{x:600,y:600,mapId:'star-origin-1',facing:{x:1,y:0}});Object.assign(p.avatar,{level:4,constellationId:'hercules'});
 const initialMp=ensureVitals(p).mp;room.monsters=new Map();let next,slam,drops=0;
 a.on('room:state',s=>{next=s.players.find(v=>v.id===p.id)?.herculesNextStance;});a.on('combat:hit',h=>{if(h.kind==='hercules-slam')slam=h;});a.on('energy:drops',()=>drops++);
 const first=await call(a,'combat:skill',{mode:'attack',power:99999});assert.equal(first.ok,true);assert.ok(p.herculesShield);await until(()=>next==='attack');
 assert.equal((await call(a,'combat:skill')).ok,false);assert.equal(p.herculesNextStance,'attack');
 // The unit test covers the full cooldown boundary; release only this fixture's server timer.
 p.herculesCooldownUntil=0;p.herculesShield=null;
 const monster=monstersOf({players:room.players,planets:new Map()},Date.now()).get('star-crab');Object.assign(monster,{x:850,y:600,hp:1,maxHp:1,sleepUntil:Date.now()+60000});room.monsters.set(monster.id,monster);
 const second=await call(a,'combat:skill',{mode:'shield',power:99999});assert.equal(second.ok,true);await until(()=>slam&&next==='shield');
 assert.equal(slam.impactMs,450);assert.equal(monster.hp,1);assert.equal(ensureVitals(p).mp,initialMp-10);
 await until(()=>monster.hp===0&&drops>0);
 const saved=JSON.stringify(toRecord(room));for(const key of ['herculesNextStance','herculesSlam','herculesCooldownUntil'])assert.ok(!saved.includes(key));
 p.herculesCooldownUntil=0;assert.equal((await call(a,'combat:skill')).ok,true);await until(()=>next==='attack');assert.ok(p.herculesShield);
});
