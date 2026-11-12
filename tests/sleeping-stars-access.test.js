import test from 'node:test';
import assert from 'node:assert/strict';
import {readingFixture,call,ok} from './helpers/reading-fixture.js';
import {SLEEPING_STARS_MAPS,STAR_STATION,PLAZA_ID,mapOf} from '../shared/config.js';
import {SLEEPING_STARS_ENTRY_MESSAGE} from '../shared/sleeping-stars.js';
import {TRUTH_CREATOR_REQUIRED_BOSSES} from '../shared/truth-creator.js';
import {chargeHuntingStation,requireHuntingEntry} from '../server/hunting-time.js';
import {studentReturnPosition} from '../server/last-location.js';
import {spawnInside} from '../server/world.js';
import {freshConstellationAbilityState} from '../server/constellation-weekly-abilities.js';

const placeGate=(p,from,to)=>{const gate=mapOf(from).objects.find(o=>o.target===to);assert(gate);Object.assign(p,{mapId:from,x:gate.x,y:gate.y,input:{x:0,y:0,at:0}});};
test('all four sleeping maps enforce level 3/4, retain teacher/master exemption and hunting budget',()=>{
 const now=Date.now();
 for(const map of SLEEPING_STARS_MAPS){
  const p={role:'student',avatar:{level:3}};chargeHuntingStation(p,'math',now);
  assert.throws(()=>requireHuntingEntry(p,map.id,now),{message:SLEEPING_STARS_ENTRY_MESSAGE});
  p.avatar.level=4;assert.doesNotThrow(()=>requireHuntingEntry(p,map.id,now));
  p.huntingTime.remainingMs=0;assert.throws(()=>requireHuntingEntry(p,map.id,now),/사냥 시간이/);
  for(const bypass of [{role:'teacher'},{role:'student',accountKind:'master'}])assert.doesNotThrow(()=>requireHuntingEntry({...bypass,avatar:{level:1}},map.id,now));
 }
});
test('socket gates and fast travel reject level forgery; level 4 needs fourth-map boss records and its gate',async t=>{
 const f=await readingFixture(t);chargeHuntingStation(f.p,'math',f.now);
 for(const [index,map] of SLEEPING_STARS_MAPS.entries()){
  const from=index?SLEEPING_STARS_MAPS[index-1].id:STAR_STATION.id;
  f.p.serenaProgress={highestLevel:4,bossKills:[...TRUTH_CREATOR_REQUIRED_BOSSES]};f.p.avatar.level=3;placeGate(f.p,from,map.id);
  const denied=await call(f.student,'map:travel',{to:map.id,avatar:{level:4},level:4});assert.equal(denied.error,SLEEPING_STARS_ENTRY_MESSAGE);assert.equal(f.p.mapId,from);
  if(index<3)assert.equal((await call(f.student,'map:fast-travel',{to:map.id,level:4})).error,SLEEPING_STARS_ENTRY_MESSAGE);
  f.p.avatar.level=4;
  if(index===3){f.p.serenaProgress.bossKills=[];assert.match((await call(f.student,'map:travel',{to:map.id})).error,/보스 처치/);f.p.serenaProgress={highestLevel:4,bossKills:[...TRUTH_CREATOR_REQUIRED_BOSSES]};}
  ok(await call(f.student,'map:travel',{to:map.id}));assert.equal(f.p.mapId,map.id);
  const fast=await call(f.student,'map:fast-travel',{to:map.id});if(index<3)ok(fast);else assert.match(fast.error,/3의 문/);
 }
});
test('summon request and acceptance both recheck level; teacher/master keep access',async t=>{
 const f=await readingFixture(t);chargeHuntingStation(f.p,'math',f.now);
 ok(await call(f.teacher,'map:fast-travel',{to:'sleeping-stars-2'}));f.p.avatar.level=3;
 assert.equal((await call(f.teacher,'social:summon',{targetId:f.p.id})).error,SLEEPING_STARS_ENTRY_MESSAGE);
 f.p.avatar.level=4;ok(await call(f.teacher,'social:summon',{targetId:f.p.id}));const pending=[...f.room.summons.values()][0];
 f.p.avatar.level=3;assert.equal((await call(f.student,'social:respond',{requestId:pending.id,accept:true})).error,SLEEPING_STARS_ENTRY_MESSAGE);
 f.p.avatar.level=4;ok(await call(f.student,'social:respond',{requestId:pending.id,accept:true}));assert.equal(f.p.mapId,'sleeping-stars-2');
 f.p.avatar.level=1;f.p.accountKind='master';ok(await call(f.student,'map:fast-travel',{to:'sleeping-stars-3'}));
});
test('saved locations and token resume recheck all sleeping stages without losing level-4 locations',async t=>{
 const f=await readingFixture(t);chargeHuntingStation(f.p,'math',f.now);f.p.serenaProgress={highestLevel:4,bossKills:[...TRUTH_CREATOR_REQUIRED_BOSSES]};
 for(const map of SLEEPING_STARS_MAPS){
  const saved={...spawnInside(f.room,map.id,f.p),mapId:map.id};
  f.p.avatar.level=3;assert.equal(studentReturnPosition(f.room,f.p,f.now,saved).mapId,PLAZA_ID);
  f.p.avatar.level=4;assert.equal(studentReturnPosition(f.room,f.p,f.now,saved).mapId,map.id);
 }
 f.p.avatar.level=3;Object.assign(f.p,spawnInside(f.room,'sleeping-stars-1',f.p),{mapId:'sleeping-stars-1'});await f.reconnect();assert.equal(f.p.mapId,PLAZA_ID);
 f.p.avatar.level=4;ok(await call(f.student,'map:fast-travel',{to:'sleeping-stars-1'}));await f.reconnect();assert.equal(f.p.mapId,'sleeping-stars-1');
});
test('whale escape rechecks the return destination level',async t=>{
 const f=await readingFixture(t);f.p.avatar.constellationId='cetus';f.p.avatar.level=4;f.p.constellationAbilityState=freshConstellationAbilityState();f.q.avatar.level=4;chargeHuntingStation(f.q,'math',f.now);
 ok(await call(f.other,'map:fast-travel',{to:'sleeping-stars-1'}));
 const invitation=ok(await call(f.student,'constellation-ability:use',{targetId:f.q.id})).invitation;
 ok(await call(f.other,'cetus:respond',{requestId:invitation.id,accept:true}));f.q.avatar.level=3;
 ok(await call(f.other,'cetus:escape'));assert.equal(f.q.mapId,PLAZA_ID);
});
