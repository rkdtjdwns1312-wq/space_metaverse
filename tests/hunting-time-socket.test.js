import {freshConstellationAbilityState} from '../server/constellation-weekly-abilities.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import {readingFixture,call,ok} from './helpers/reading-fixture.js';
import {chargeHuntingStation,huntingTimeView,validateHuntingTime} from '../server/hunting-time.js';
import {HUNTING_STATION_MS} from '../shared/hunting-time.js';
import {toRecord,fromRecord} from '../server/persistent-rooms.js';
const wait=ms=>new Promise(r=>setTimeout(r,ms));
const credit=f=>f.mutate(p=>chargeHuntingStation(p,'math',f.now));
test('entrygate and fasttravel deny zero; actualclock runs in hunts, pauses safe, expires to shelter',async t=>{
 const f=await readingFixture(t);f.mutate(p=>{p.avatar.level=5;});
 assert.equal((await call(f.student,'map:fast-travel',{to:'moon-garden',remainingMs:999999})).ok,false);
 credit(f);ok(await call(f.student,'map:fast-travel',{to:'moon-garden'}));assert.equal(f.p.mapId,'moon-garden');
 f.advance(5000);await wait(200);assert.equal(huntingTimeView(f.p,f.now).remainingMs,HUNTING_STATION_MS-5000);
 ok(await call(f.student,'map:fast-travel',{to:'star-street'}));const paused=huntingTimeView(f.p,f.now).remainingMs;f.advance(5000);await wait(200);assert.equal(huntingTimeView(f.p,f.now).remainingMs,paused);
 ok(await call(f.student,'map:fast-travel',{to:'sleeping-stars-1'}));f.advance(paused);assert.equal((await call(f.student,'combat:attack',{})).ok,false);await wait(250);assert.equal(f.p.mapId,'star-street');assert.equal(huntingTimeView(f.p,f.now).remainingMs,0);
 assert.equal((await call(f.student,'map:fast-travel',{to:'star-origin-1'})).ok,false);
});
test('qualifiedscience claim charges once transactionally, private snapshot, offline/restart retain remaining',async t=>{
 const f=await readingFixture(t);f.at('science');const opened=ok(await call(f.student,'science:open'));assert.equal(huntingTimeView(f.p,f.now).remainingMs,0);
 const before=huntingTimeView(f.p,f.now);await f.fail(async()=>assert.equal((await call(f.student,'science:claim',{factId:opened.factId})).ok,false));assert.equal(huntingTimeView(f.p,f.now).remainingMs,before.remainingMs);
 ok(await call(f.student,'science:claim',{factId:opened.factId}));assert.equal(huntingTimeView(f.p,f.now).remainingMs,HUNTING_STATION_MS);
 ok(await call(f.student,'science:claim',{factId:opened.factId}));assert.equal(huntingTimeView(f.p,f.now).remainingMs,HUNTING_STATION_MS);
 for(const viewer of [f.q,f.teacherPlayer])assert.equal(f.game.store.snapshot(f.room,viewer,f.now).players.find(p=>p.id===f.p.id).huntingTime,undefined);
 assert.equal(f.game.store.snapshot(f.room,f.p,f.now).players.find(p=>p.id===f.p.id).huntingTime.remainingMs,HUNTING_STATION_MS);
 f.mutate(p=>{p.avatar.level=5;});ok(await call(f.student,'map:fast-travel',{to:'moon-garden'}));f.advance(4000);await wait(150);
 await f.restart();assert.equal(huntingTimeView(f.p,f.now).remainingMs,HUNTING_STATION_MS-4000);f.advance(60000);assert.equal(huntingTimeView(f.p,f.now).remainingMs,HUNTING_STATION_MS-4000);
 const record=toRecord(f.room),saved=record.students.find(p=>p.id===f.p.id);assert.equal(saved.huntingTimer,undefined);assert.deepEqual(fromRecord(record).players.get(f.p.id).huntingTime,f.p.huntingTime);delete saved.huntingTime;assert.deepEqual(fromRecord(record).players.get(f.p.id).huntingTime,validateHuntingTime());
});
test('summon acceptance cannot bypass zero budget, and22KST resets balance andstationcredits durably',async t=>{
 const f=await readingFixture(t);ok(await call(f.teacher,'map:fast-travel',{to:'moon-garden'}));
 const request=ok(await call(f.teacher,'social:summon',{targetId:f.p.id}));const pending=[...f.room.summons.values()][0];assert(pending);
 assert.equal((await call(f.student,'social:respond',{requestId:pending.id,accept:true})).ok,false);assert.notEqual(f.p.mapId,'moon-garden');
 credit(f);ok(await call(f.student,'social:respond',{requestId:pending.id,accept:true}));assert.equal(f.p.mapId,'moon-garden');
 f.advance(22*3600000+1000);await wait(250);assert.equal(f.p.mapId,'star-street');assert.equal(huntingTimeView(f.p,f.now).remainingMs,0);assert.deepEqual(huntingTimeView(f.p,f.now).chargedStations,[]);
 await f.restart();assert.equal(huntingTimeView(f.p,f.now).remainingMs,0);
});

test('whale escape cannot return a zero-budget student to their previous hunting map',async t=>{
 const f=await readingFixture(t);f.mutate(p=>{p.avatar.constellationId='cetus';p.avatar.level=4;p.constellationAbilityState=freshConstellationAbilityState();f.q.avatar.level=2;chargeHuntingStation(f.q,'math',f.now);f.q.mapId='moon-garden';});
 const invite=ok(await call(f.student,'constellation-ability:use',{targetId:f.q.id})).invitation;
 ok(await call(f.other,'cetus:respond',{requestId:invite.id,accept:true}));
 f.mutate(()=>{f.q.huntingTime.remainingMs=0;});ok(await call(f.other,'cetus:escape'));
 assert.equal(f.q.mapId,'star-street');assert.equal(huntingTimeView(f.q,f.now).remainingMs,0);
});
