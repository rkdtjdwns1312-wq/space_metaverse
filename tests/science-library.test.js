import test from 'node:test';
import assert from 'node:assert/strict';
import {SCIENCE_FACTS} from '../shared/science-facts.js';
import {validateScienceReading} from '../server/science-library.js';
import {toRecord,fromRecord} from '../server/persistent-rooms.js';
import {readingFixture,call,ok} from './helpers/reading-fixture.js';
const ids=SCIENCE_FACTS.map(f=>f.id),wait=ms=>new Promise(r=>setTimeout(r,ms));
const open=async f=>ok(await call(f.student,'science:open'));
const claim=async(f,factId)=>ok(await call(f.student,'science:claim',{factId}));
const status=async f=>ok(await call(f.student,'science:status'));

test('science schema preserves legacy absence and rejects inconsistent cycle/daily/active records',()=>{
 assert.equal(ids.length,100);assert.equal(new Set(ids).size,100);
 const empty={day:null,seenIds:[],openedIds:[],claimedIds:[],activeId:null,cyclesCompleted:0};assert.deepEqual(validateScienceReading(undefined),empty);
 const valid={day:'2026-10-13',seenIds:ids.slice(0,2),openedIds:ids.slice(0,2),claimedIds:[ids[0]],activeId:ids[1]};
 assert.deepEqual(validateScienceReading(valid),{...valid,cyclesCompleted:0});
 for(const raw of [null,{}, {...valid,day:'2026-02-30'},{...valid,day:null},{...valid,seenIds:[ids[0],ids[0]]},
  {...valid,openedIds:ids.slice(0,3)},{...valid,claimedIds:ids.slice(0,2)},{...valid,activeId:ids[0]},
  {...valid,activeId:null},{...valid,seenIds:['unknown']},{...valid,claimedIds:[ids[2]]}])assert.throws(()=>validateScienceReading(raw));
});

test('science open is server-selected and atomic: repeated opens resume, only two new facts/day, duplicate claims pay once',async t=>{
 const f=await readingFixture(t);f.at('science');f.mutate(p=>{p.avatar.level=3;});
 const first=await Promise.all(Array.from({length:6},()=>call(f.student,'science:open',{factId:'forged'})));first.forEach(ok);
 assert.equal(new Set(first.map(r=>r.factId)).size,1);assert.equal(first[0].count,1);assert.equal(first[0].remaining,99);
 const factId=first[0].factId;assert(ids.includes(factId));
 const paid=await Promise.all(Array.from({length:6},()=>call(f.student,'science:claim',{factId,amount:999})));
 paid.forEach(ok);assert.equal(paid.filter(r=>r.awarded).length,1);assert.equal(f.p.cosmicEnergy,5);assert.equal(paid[0].activeId,null);
 const second=await open(f);assert.notEqual(second.factId,factId);assert.equal(second.count,2);assert.equal(second.canOpen,true);
 assert.equal((await open(f)).factId,second.factId);assert.equal((await status(f)).count,2);
 f.mutate(p=>{p.avatar.level=5;});const last=await claim(f,second.factId);assert.equal(last.amount,100);assert.equal(last.canOpen,false);assert.equal(last.activeId,null);
 assert.equal((await call(f.student,'science:open')).ok,false);assert.equal(f.p.cosmicEnergy,105);
 assert.deepEqual((await status(f)).remaining,98);
});

test('science rejects guest, far/wrong-station, away, stale connection, other player and unselected claims; teacher completion advances without reward',async t=>{
 const f=await readingFixture(t),guest=await f.connect();f.at('science');
 for(const event of ['science:status','science:open','science:claim'])assert.equal((await call(guest,event,{factId:ids[0]})).ok,false);
 assert.equal((await call(f.student,'science:claim',{factId:ids[0]})).ok,false);
 const book=await open(f);f.at('culture');
 for(const event of ['science:status','science:open','science:claim'])assert.equal((await call(f.student,event,{factId:book.factId})).ok,false);
 f.at('science');f.p.away=true;assert.equal((await call(f.student,'science:open')).ok,false);f.p.away=false;
 const socketId=f.p.socketId;f.p.socketId='old';assert.equal((await call(f.student,'science:claim',{factId:book.factId})).ok,false);f.p.socketId=socketId;
 f.at('science',f.q);assert.equal((await call(f.other,'science:claim',{factId:book.factId,playerId:f.p.id})).ok,false);
 assert.equal((await call(f.student,'science:claim',{factId:ids.find(id=>id!==book.factId)})).ok,false);
 const concurrent=await f.connect();assert.equal((await call(concurrent,'session:resume',{token:f.token})).ok,false);
 await f.reconnect();assert.equal((await call(f.student,'science:claim',{factId:book.factId})).ok,false);assert.equal((await open(f)).factId,book.factId);
 f.at('science',f.teacherPlayer);const before=f.teacherPlayer.cosmicEnergy,teacherBook=ok(await call(f.teacher,'science:open'));
 const done=ok(await call(f.teacher,'science:claim',{factId:teacherBook.factId}));assert.equal(done.awarded,false);assert.equal(done.amount,0);assert.equal(done.activeId,null);assert.equal(done.canOpen,true);assert.match(done.message,/선생님/);
 assert.equal(f.teacherPlayer.cosmicEnergy,before);assert.notEqual(ok(await call(f.teacher,'science:open')).factId,teacherBook.factId);
});

test('unclaimed science fact survives restart and crossing midnight consumes exactly one new-day slot',async t=>{
 const f=await readingFixture(t);f.at('science');const first=await open(f);await claim(f,first.factId);const pending=await open(f);
 await f.restart();f.at('science');assert.equal((await status(f)).activeId,pending.factId);assert.equal((await open(f)).factId,pending.factId);
 f.advance(1000);const carried=await claim(f,pending.factId);assert.equal(carried.day,'2026-10-14');assert.equal(carried.count,1);assert.equal(carried.amount,1);assert.equal(carried.activeId,null);
 const second=await open(f);assert(![first.factId,pending.factId].includes(second.factId));assert.equal(second.count,2);await claim(f,second.factId);
 assert.equal((await call(f.student,'science:open')).ok,false);await f.restart();f.at('science');assert.equal((await status(f)).count,2);assert.equal(f.p.cosmicEnergy,3);
 f.advance();const active=await open(f);f.advance();const resumed=await open(f);assert.equal(resumed.factId,active.factId);assert.equal(resumed.count,1);assert.equal(resumed.remaining,96);
 await claim(f,active.factId);assert.equal((await status(f)).count,1);
 const record=toRecord(f.room),saved=record.students.find(p=>p.id===f.p.id);delete saved.scienceReading;
 assert.deepEqual(fromRecord(record).players.get(f.p.id).scienceReading,validateScienceReading(undefined));
});

test('science write failures roll back first draw, midnight carry, energy and completion while allowing retry',async t=>{
 const f=await readingFixture(t);f.at('science');const before=structuredClone(f.game.store.records.get(f.room.code));
 await f.fail(async()=>assert.equal((await call(f.student,'science:open')).ok,false));assert.equal(f.p.scienceReading,undefined);assert.deepEqual(f.game.store.records.get(f.room.code),before);
 const book=await open(f),saved=structuredClone(f.p.scienceReading);f.advance(1000);
 await f.fail(async()=>assert.equal((await call(f.student,'science:open')).ok,false));assert.deepEqual(f.p.scienceReading,saved);
 await f.fail(async()=>assert.equal((await call(f.student,'science:claim',{factId:book.factId})).ok,false));assert.deepEqual(f.p.scienceReading,saved);assert.equal(f.p.cosmicEnergy,0);
 const result=await claim(f,book.factId);assert.equal(result.count,1);assert.equal(result.amount,1);
 await f.restart();f.at('science');assert.equal(f.p.cosmicEnergy,1);assert.equal((await status(f)).activeId,null);assert.equal((await status(f)).remaining,99);
 for(const viewer of [f.q,f.teacherPlayer])assert.equal(f.game.store.snapshot(f.room,viewer,f.now).players.find(p=>p.id===f.p.id).scienceReading,undefined);
});


test('all 100 facts are unique per cycle; completion resets history without resetting daily quota or duplicating rewards',async t=>{
 const f=await readingFixture(t);f.at('science');const seen=new Set();let lastId;
 for(let i=0;i<ids.length;i++){
  if(i&&i%2===0)f.advance();const book=await open(f);assert(!seen.has(book.factId));seen.add(book.factId);
  assert.equal(book.remaining,ids.length-1-i);assert.equal(book.canOpen,true);
  // Windows에서 직전 원자 저장의 파일 핸들이 해제될 시간을 줍니다. 검증 횟수/내용은 동일합니다.
  if(process.platform==='win32')await wait(100);
  const done=await claim(f,book.factId);assert.equal(done.amount,1);lastId=book.factId;
  if(i===ids.length-1){assert.equal(done.exhausted,false);assert.equal(done.remaining,100);assert.equal(done.cyclesCompleted,1);assert.equal(done.canOpen,false);assert.match(done.message,/초기화/);}
  await wait(process.platform==='win32'?200:35);
 }
 assert.equal(seen.size,100);assert.equal((await claim(f,lastId)).awarded,false);assert.equal(f.p.cosmicEnergy,100);
 assert.equal((await call(f.student,'science:open')).ok,false);await f.restart();f.at('science');assert.equal((await status(f)).count,2);assert.equal((await status(f)).cyclesCompleted,1);
 f.advance();const next=await open(f);assert(seen.has(next.factId));assert.equal(next.remaining,99);assert.equal(next.count,1);
 await claim(f,next.factId);assert.equal(f.p.cosmicEnergy,101);
});

test('cycle renewal is transactional and old 50-story records continue with the additional 50',async t=>{
 const f=await readingFixture(t);f.at('science');const day=(await status(f)).day;
 f.mutate(p=>{p.scienceReading={day,seenIds:ids.slice(0,50),openedIds:[],claimedIds:[],activeId:null};});
 const added=await open(f);assert(ids.slice(50).includes(added.factId));await claim(f,added.factId);
 f.advance();const nextDay=(await status(f)).day;
 f.mutate(p=>{p.scienceReading={day:nextDay,seenIds:ids.slice(0,-1),openedIds:[],claimedIds:[],activeId:null};});
 const last=await open(f);assert.equal(last.factId,ids.at(-1));const before=structuredClone(f.p.scienceReading),energy=f.p.cosmicEnergy;
 await f.fail(async()=>assert.equal((await call(f.student,'science:claim',{factId:last.factId})).ok,false));
 assert.deepEqual(f.p.scienceReading,before);assert.equal(f.p.cosmicEnergy,energy);
 const done=await claim(f,last.factId);assert.equal(done.remaining,100);assert.equal(done.count,1);assert.equal(done.canOpen,true);
 assert.equal((await claim(f,last.factId)).awarded,false);const second=await open(f);assert.notEqual(second.factId,last.factId);
 await claim(f,second.factId);assert.equal((await status(f)).count,2);assert.equal((await call(f.student,'science:open')).ok,false);
 await f.restart();f.at('science');assert.equal((await status(f)).cyclesCompleted,1);assert.equal((await status(f)).remaining,99);
});
