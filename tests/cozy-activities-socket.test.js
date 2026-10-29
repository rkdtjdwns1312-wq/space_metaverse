import test from 'node:test';
import assert from 'node:assert/strict';
import {STREET} from '../shared/config.js';
import {cozyPreset} from '../shared/cozy-activities.js';
import {validateCozyActivities} from '../server/cozy-activities.js';
import {toRecord,fromRecord} from '../server/persistent-rooms.js';
import {readingFixture,call,ok} from './helpers/reading-fixture.js';
const at=(f,kind,p=f.p)=>{const obj=STREET.objects.find(o=>o.kind===`cozy-${kind}`);assert(obj,`missing cozy-${kind} prop`);Object.assign(p,{mapId:STREET.id,x:obj.x,y:obj.y+100,input:{x:0,y:0,at:0}});};
const act=async(f,kind,action,data={})=>ok(await call(f.student,'cozy:act',{kind,action,...data}));
test('cozy socket validates proximity, map, live ownership, away and alive on reads and writes',async t=>{
 const f=await readingFixture(t),guest=await f.connect();
 for(const event of ['cozy:read','cozy:act'])assert.equal((await call(guest,event,{kind:'pet',action:'adopt',species:'moon'})).ok,false);
 at(f,'pet');ok(await call(f.student,'cozy:read',{kind:'pet'}));assert.equal(f.p.cozyActivities,undefined);
 await act(f,'pet','adopt',{species:'moon'});const before=structuredClone(f.p.cozyActivities);
 for(const change of [p=>{p.mapId='plaza';},p=>{p.x=0;p.y=0;},p=>{p.away=true;},p=>{p.socketId='stale';},p=>{p.battleVitals={level:p.avatar.level,role:p.role,hp:0,mp:0,defeatedAt:f.now};}]){
  const saved={mapId:f.p.mapId,x:f.p.x,y:f.p.y,away:f.p.away,socketId:f.p.socketId,battleVitals:f.p.battleVitals&&structuredClone(f.p.battleVitals)};change(f.p);
  for(const event of ['cozy:read','cozy:act'])assert.equal((await call(f.student,event,{kind:'pet',action:'care',care:'feed'})).ok,false);Object.assign(f.p,saved);
 }
 assert.deepEqual(f.p.cozyActivities,before);at(f,'room');assert.equal((await call(f.student,'cozy:read',{kind:'pet'})).ok,false);
});
test('cozy socket state persists, stays private, and failure rolls back energy plus quotas; retries reward once',async t=>{
 const f=await readingFixture(t);at(f,'pet');await act(f,'pet','adopt',{species:'flower',name:'내 별'});
 const before=structuredClone(f.p.cozyActivities),energy=f.p.cosmicEnergy;
 await f.fail(async()=>assert.equal((await call(f.student,'cozy:act',{kind:'pet',action:'care',care:'feed'})).ok,false));
 assert.deepEqual(f.p.cozyActivities,before);assert.equal(f.p.cosmicEnergy,energy);
 const results=await Promise.all(Array.from({length:5},()=>call(f.student,'cozy:act',{kind:'pet',action:'care',care:'feed',amount:99999,playerId:f.q.id})));results.forEach(ok);assert.equal(results.filter(r=>r.amount>0).length,1);assert.equal(f.q.cozyActivities,undefined);
 at(f,'room');const beforeRoom=structuredClone(f.p.cozyActivities),roomEnergy=f.p.cosmicEnergy;
 await f.fail(async()=>assert.equal((await call(f.student,'cozy:act',{kind:'room',action:'save',theme:'study',layout:cozyPreset('study')})).ok,false));
 assert.deepEqual(f.p.cozyActivities,beforeRoom);assert.equal(f.p.cosmicEnergy,roomEnergy);
 await act(f,'room','save',{theme:'study',layout:cozyPreset('study')});at(f,'garden');await act(f,'garden','plant',{pot:1,seed:'moonbell'});
 const saved=structuredClone(f.p.cozyActivities);for(const viewer of [f.q,f.teacherPlayer])assert.equal(f.game.store.snapshot(f.room,viewer,f.now).players.find(p=>p.id===f.p.id).cozyActivities,undefined);
 await f.restart();at(f,'garden');assert.deepEqual(f.p.cozyActivities,saved);f.advance(600000);assert.equal(ok(await call(f.student,'cozy:read',{kind:'garden'})).state.pots[1].ready,true);
 await f.fail(async()=>assert.equal((await call(f.student,'cozy:act',{kind:'garden',action:'harvest',pot:1})).ok,false));assert.deepEqual(f.p.cozyActivities,saved);
 assert((await act(f,'garden','harvest',{pot:1})).amount>0);
 const record=toRecord(f.room),student=record.students.find(p=>p.id===f.p.id);delete student.cozyActivities;assert.deepEqual(fromRecord(record).players.get(f.p.id).cozyActivities,validateCozyActivities());
 student.cozyActivities={};assert.throws(()=>fromRecord(record));
});
