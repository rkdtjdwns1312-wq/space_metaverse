import {ensureVitals} from '../server/vitals.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import {readingFixture,call,ok} from './helpers/reading-fixture.js';
import {studentReminders,reminderTarget} from '../server/student-reminders.js';
import {saveNotice,markAssignmentDone} from '../server/temple.js';
import {STUDENT_REMINDERS} from '../shared/student-reminders.js';
import {mapOf,WHALE_STOMACH_ID} from '../shared/config.js';
import {isNear,isFree} from '../server/world.js';
test('reminders use own assignments, KST purchase day, active own missions and hide teachers',async t=>{
 const f=await readingFixture(t),now=f.now;
 assert(!studentReminders(f.room,f.p,now).includes('stats'));f.p.avatar.level=2;
 assert(studentReminders(f.room,f.p,now).includes('stats'));
 f.p.statGrowth={bonuses:{hp:0,mp:0,attack:0,defense:0},lastPurchaseDay:'2026-10-13'};
 assert(!studentReminders(f.room,f.p,now).includes('stats'));assert(studentReminders(f.room,f.p,now+1000).includes('stats'));
 const n=saveNotice(f.room,'과제 검사',[0],now);assert(studentReminders(f.room,f.p,now).includes('assignments'));
 f.p.tasks=[{assignmentId:n.taskLines[0].assignmentId,status:'submitted'}];assert(!studentReminders(f.room,f.p,now).includes('assignments'));f.p.tasks[0].status='working';assert(studentReminders(f.room,f.p,now+28*86400000).includes('assignments'));f.p.tasks=[];
 markAssignmentDone(f.room,n.taskLines[0].assignmentId,f.p.id);
 assert(!studentReminders(f.room,f.p,now).includes('assignments'));assert(studentReminders(f.room,f.q,now).includes('assignments'));
 assert.deepEqual(studentReminders(f.room,f.teacherPlayer,now),[]);assert.deepEqual(studentReminders(f.room,null,now),[]);
 assert.equal(reminderTarget(f.room,f.p,'assignments',now),null);assert.equal(reminderTarget(f.room,f.p,'__proto__',now),null);
 assert.deepEqual(studentReminders(f.room,f.p,now,[]),[]);
 assert(studentReminders(f.room,f.p,now,[{status:'active'}]).includes('missions'));
 assert(!studentReminders(f.room,f.p,now,[{status:'ready'},{status:'claimed'},{status:'expired'}]).includes('missions'));
 assert.deepEqual(f.game.store.snapshot(f.room,f.teacherPlayer,now).studentReminders,[]);
});
test('reminder fast travel resolves safe facility server side and rejects stale, forged, black-star and whale requests',async t=>{
 const f=await readingFixture(t);f.mutate(p=>{p.avatar.level=2;});saveNotice(f.room,'과제 검사',[0],f.now);
 for(const id of ['stats','assignments','missions']){
  if(!studentReminders(f.room,f.p,f.now).includes(id))continue;
  ok(await call(f.student,'map:fast-travel',{reminder:id,to:'star-origin-4',x:0,y:0}));const target=STUDENT_REMINDERS[id],object=mapOf(target.mapId).objects.find(o=>o.id===target.objectId);
  assert.equal(f.p.mapId,target.mapId);assert(isNear(f.p,object));assert(isFree(f.room,f.p.x,f.p.y,f.p.id,f.p.mapId,true,f.p));
 }
 for(const reminder of ['bad','__proto__'])assert.equal((await call(f.student,'map:fast-travel',{reminder})).ok,false);
 assert.equal((await call(f.teacher,'map:fast-travel',{reminder:'stats'})).ok,false);
 ensureVitals(f.p).hp=0;assert.equal((await call(f.student,'map:fast-travel',{reminder:'stats'})).ok,false);ensureVitals(f.p).hp=10;
 f.mutate(p=>{p.constellationAbilityState.ariesSleep={sourceId:f.q.id,startsAt:f.now,endsAt:f.now+60000,reward:1,wakeCost:0};});assert.equal((await call(f.student,'map:fast-travel',{reminder:'stats'})).ok,false);f.mutate(p=>{p.constellationAbilityState.ariesSleep=null;});
 f.mutate(p=>{p.avatar.blackStar=true;});assert.equal((await call(f.student,'map:fast-travel',{reminder:'stats'})).ok,false);
 f.mutate(p=>{p.avatar.blackStar=false;p.mapId=WHALE_STOMACH_ID;p.constellationAbilityState??={};p.constellationAbilityState.cetusStomach={sourceId:f.q.id,level:4,startsAt:f.now,endsAt:f.now+86400000,returnMapId:'space-plaza',returnX:1800,returnY:1800};});
 assert.equal((await call(f.student,'map:fast-travel',{reminder:'stats'})).ok,false);
});
