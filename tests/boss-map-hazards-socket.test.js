import test from 'node:test';
import assert from 'node:assert/strict';
import {io} from 'socket.io-client';
import {createClassroomServer} from '../server/app.js';
import {monstersOf} from '../server/monsters.js';
import {chargeHuntingStation} from '../server/hunting-time.js';
import {ensureVitals} from '../server/vitals.js';
import {toRecord} from '../server/persistent-rooms.js';
const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function until(check){for(let i=0;i<100;i++){if(check())return;await pause(20);}assert.ok(check(),'server event timeout');}

test('real hazard tick emits live status/vitals, travel resets deadline, runtime hazard is not persisted',async t=>{
  let now=Date.now();const key='hazard-socket-test',sockets=[];
  const game=createClassroomServer({teacherKey:key,studentHours:false,dataDir:null,clock:()=>now});
  const {port}=await game.listen();t.after(async()=>{sockets.forEach(s=>s.disconnect());await game.close();});
  async function connect(){const s=io(`http://127.0.0.1:${port}`,{transports:['websocket'],reconnection:false,autoConnect:false});sockets.push(s);
    await new Promise((resolve,reject)=>{s.once('connect',resolve);s.once('connect_error',reject);s.connect();});return s;}
  const call=(s,event,data={})=>s.timeout(3000).emitWithAck(event,data),teacher=await connect();
  const created=await call(teacher,'room:create',{teacherKey:key,allowedNames:['hazard']});assert.equal(created.ok,true);
  const student=await connect(),joined=await call(student,'room:join',{code:created.room.code,nickname:'hazard'});assert.equal(joined.ok,true);
  const room=game.store.rooms.get(created.room.code),p=room.players.get(joined.selfId),vitals=[];let snapshot;
  student.on('room:state',value=>snapshot=value);student.on('combat:vitals',value=>vitals.push(value));
  Object.assign(p.avatar,{level:4,constellationId:'hercules'});chargeHuntingStation(p,'math',now);
  ensureVitals(p).nextPassiveRecoveryAt=now+100000; // Isolate hazard damage from ordinary ten-second healing.
  const boss=monstersOf(room,now).get('leoon-boss');room.monsters=new Map([[boss.id,boss]]);
  boss.sleepUntil=now+100000; // Keep ordinary boss attacks out of this environmental hazard test.
  assert.equal((await call(student,'map:fast-travel',{to:'sun-paradise-3'})).ok,true);
  await until(()=>room.bossMapHazards?.has(p.id)&&snapshot?.players.find(v=>v.id===p.id)?.effects.some(e=>e.statusId==='burn'));
  const hp=ensureVitals(p).hp,deadline=room.bossMapHazards.get(p.id).nextTickAt;
  now=deadline-1;await pause(160);assert.equal(ensureVitals(p).hp,hp);
  now=deadline;await until(()=>vitals.some(v=>v.playerId===p.id&&v.vitals.hp.current===hp-2));
  assert.equal(ensureVitals(p).hp,hp-2);
  const saved=JSON.stringify(toRecord(room));assert.equal(saved.includes('bossMapHazards'),false);
  assert.equal(saved.includes('nextTickAt'),false);assert.equal(saved.includes('"statusId":"burn"'),false);
  assert.equal(JSON.parse(saved).bossMapHazards,undefined);
  assert.equal((await call(student,'map:fast-travel',{to:'star-street'})).ok,true);
  assert.equal(room.bossMapHazards.has(p.id),false);
  await until(()=>snapshot?.players.find(v=>v.id===p.id)?.mapId==='star-street');
  assert.equal(snapshot.players.find(v=>v.id===p.id).effects.some(e=>e.statusId==='burn'),false);
  now+=20000;await pause(160);assert.equal(ensureVitals(p).hp,hp-2);
  assert.equal((await call(student,'map:fast-travel',{to:'sun-paradise-3'})).ok,true);
  await until(()=>room.bossMapHazards.has(p.id));const returnedAt=now;
  assert.equal(room.bossMapHazards.get(p.id).nextTickAt,returnedAt+5000);
  now=returnedAt+4999;await pause(160);assert.equal(ensureVitals(p).hp,hp-2);
  now=returnedAt+5000;await until(()=>vitals.some(v=>v.playerId===p.id&&v.vitals.hp.current===hp-4));
  boss.hp=0;boss.respawnAt=now+86400000;
  await until(()=>!room.bossMapHazards.has(p.id)&&!snapshot.players.find(v=>v.id===p.id).effects.some(e=>e.statusId==='burn'));
});
