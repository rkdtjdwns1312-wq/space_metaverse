import test from 'node:test';
import assert from 'node:assert/strict';
import {HISTORY_LESSONS,HISTORY_CHAPTERS} from '../shared/history-lessons.js';
import {CULTURE_STORIES} from '../shared/culture-stories.js';
import {validateHistoryReading} from '../server/culture-library.js';
import {toRecord,fromRecord} from '../server/persistent-rooms.js';
import {readingFixture,call,ok} from './helpers/reading-fixture.js';
const ids=HISTORY_LESSONS.map(s=>s.id),cultureIds=CULTURE_STORIES.map(s=>s.id);
const open=async(f,storyId=ids[0])=>ok(await call(f.student,'history:open',{storyId}));
const claim=async(f,storyId=ids[0])=>ok(await call(f.student,'history:claim',{storyId}));
const status=async f=>ok(await call(f.student,'history:status'));

test('history catalog and save validation use only history IDs and accept legacy absence',()=>{
 assert(ids.length>=11);assert.equal(new Set(ids).size,ids.length);assert(HISTORY_LESSONS.every(s=>HISTORY_CHAPTERS.some(c=>c.id===s.chapterId)));
 assert.deepEqual(validateHistoryReading(undefined),{day:null,claimedIds:[]});
 assert.deepEqual(validateHistoryReading({day:'2026-10-13',claimedIds:ids.slice(0,10)}),{day:'2026-10-13',claimedIds:ids.slice(0,10)});
 for(const raw of [null,{}, {day:'2026-02-30',claimedIds:[]},{day:null,claimedIds:[ids[0]]},{day:'2026-10-13',claimedIds:[cultureIds[0]]},
  {day:'2026-10-13',claimedIds:[ids[0],ids[0]]},{day:'2026-10-13',claimedIds:ids.slice(0,11)}])assert.throws(()=>validateHistoryReading(raw));
});

test('history and culture selections and daily ten-book limits are independent, with exact Lv5 rewards and KST reset',async t=>{
 const f=await readingFixture(t);f.mutate(p=>{p.avatar.level=5;});
 f.at('culture');ok(await call(f.student,'culture:open',{storyId:cultureIds[0]}));
 f.at('history');await open(f);assert.equal((await claim(f)).amount,100);
 f.at('culture');assert.equal(ok(await call(f.student,'culture:claim',{storyId:cultureIds[0]})).amount,100);
 for(const [namespace,books] of [['history',ids],['culture',cultureIds]]){
  f.at(namespace);for(const storyId of books.slice(1,10)){ok(await call(f.student,namespace+':open',{storyId}));assert.equal(ok(await call(f.student,namespace+':claim',{storyId})).amount,100);}
  ok(await call(f.student,namespace+':open',{storyId:books[10]}));const capped=ok(await call(f.student,namespace+':claim',{storyId:books[10]}));assert.equal(capped.awarded,false);assert.equal(capped.count,10);
 }
 assert.equal(f.p.cosmicEnergy,2000);f.at('history');assert.equal((await status(f)).count,10);f.advance(1000);assert.equal((await status(f)).count,0);
 await open(f);assert.equal((await claim(f)).amount,100);assert.equal(f.p.cultureReading.claimedIds.length,10);assert.equal(f.p.historyReading.claimedIds.length,1);
 f.at('culture');assert.equal(ok(await call(f.student,'culture:status')).count,0);
});

test('history namespace enforces its own station/catalog/selection/connection and teachers do not get rewards',async t=>{
 const f=await readingFixture(t),guest=await f.connect();
 for(const event of ['history:status','history:open','history:claim'])assert.equal((await call(guest,event,{storyId:ids[0]})).ok,false);
 f.at('culture');assert.equal((await call(f.student,'history:open',{storyId:ids[0]})).ok,false);f.at('history');
 assert.equal((await call(f.student,'history:open',{storyId:cultureIds[0]})).ok,false);assert.equal((await call(f.student,'history:claim',{storyId:ids[0]})).ok,false);
 await open(f);await open(f,ids[1]);assert.equal((await call(f.student,'history:claim',{storyId:ids[0]})).ok,false);
 f.at('history',f.q);assert.equal((await call(f.other,'history:claim',{storyId:ids[1],playerId:f.p.id})).ok,false);
 const paid=await Promise.all(Array.from({length:6},()=>call(f.student,'history:claim',{storyId:ids[1]})));paid.forEach(ok);assert.equal(paid.filter(r=>r.awarded).length,1);assert.equal(f.p.cosmicEnergy,1);
 await open(f,ids[2]);await f.reconnect();assert.equal((await call(f.student,'history:claim',{storyId:ids[2]})).ok,false);
 f.at('history',f.teacherPlayer);ok(await call(f.teacher,'history:open',{storyId:ids[0]}));const teacher=ok(await call(f.teacher,'history:claim',{storyId:ids[0]}));assert.equal(teacher.amount,0);assert.equal(teacher.awarded,false);assert.match(teacher.message,/선생님/);
});

test('history persistence rollback, restart, privacy and legacy restore do not alter culture claims',async t=>{
 const f=await readingFixture(t);f.at('culture');ok(await call(f.student,'culture:open',{storyId:cultureIds[0]}));ok(await call(f.student,'culture:claim',{storyId:cultureIds[0]}));
 f.at('history');await open(f);const culture=structuredClone(f.p.cultureReading),before=structuredClone(f.game.store.records.get(f.room.code));
 await f.fail(async()=>assert.equal((await call(f.student,'history:claim',{storyId:ids[0]})).ok,false));assert.equal(f.p.cosmicEnergy,1);assert.deepEqual(f.p.cultureReading,culture);assert.deepEqual(f.game.store.records.get(f.room.code),before);
 assert.equal((await claim(f)).awarded,true);await f.restart();f.at('history');assert.equal((await status(f)).count,1);assert.deepEqual(f.p.cultureReading,culture);assert.equal(f.p.cosmicEnergy,2);
 assert.equal((await call(f.student,'history:claim',{storyId:ids[0]})).ok,false);await open(f);assert.equal((await claim(f)).awarded,false);
 for(const viewer of [f.q,f.teacherPlayer]){const visible=f.game.store.snapshot(f.room,viewer,f.now).players.find(p=>p.id===f.p.id);assert.equal(visible.historyReading,undefined);assert.equal(visible.cultureReading,undefined);}
 const saved=toRecord(f.room),p=saved.students.find(p=>p.id===f.p.id);delete p.historyReading;assert.deepEqual(fromRecord(saved).players.get(f.p.id).historyReading,{day:null,claimedIds:[]});
 p.historyReading={day:'2026-10-13',claimedIds:[cultureIds[0]]};assert.throws(()=>fromRecord(saved));
});
