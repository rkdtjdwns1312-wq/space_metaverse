import test from 'node:test';
import assert from 'node:assert/strict';
import {abilityCancellationEntries,cancelAbilityEffect} from '../server/ability-cancellation.js';
import {templeItemRows} from '../server/temple-items.js';
import {freshAbilityState} from '../server/constellation-abilities.js';
import {freshConstellationAbilityState} from '../server/constellation-weekly-abilities.js';
import {weeklyAbilityFor} from '../shared/constellation-weekly-abilities.js';
import {readingFixture,call,ok} from './helpers/reading-fixture.js';
import {MAP,PLAZA_ID,WHALE_STOMACH_ID} from '../shared/config.js';
const now=Date.parse('2026-11-06T01:00:00Z');
const setup=()=>{
 const teacher={id:'t',role:'teacher'},p={id:'p',role:'student',nickname:'별이',avatar:{level:2,xp:0},starShards:10,
  effects:[],cardMarkers:[],abilityState:freshAbilityState(),constellationAbilityState:freshConstellationAbilityState()};
 return {teacher,p,room:{players:new Map([['t',teacher],['p',p]]),parties:new Map()}};
};
test('teacher cancellation covers timed abilities and manual records without refunds, rewards, or week resets',()=>{
 const {teacher,p,room}=setup();p.abilityState.usedWeek='2026-11-02';p.abilityState.usedCount=1;
 p.constellationAbilityState.usedWeek='2026-11-02';
 const state=p.constellationAbilityState;
 for(const field of ['ariesSleep','paralysis','abilitySeal','cetusPraise','cetusAfterglow'])state[field]={sourceId:'t',startsAt:now,endsAt:now+60000,level:4,reward:3};
 p.abilityState.markers=[{id:'libra',constellationId:'libra',level:2,at:now,note:'',targetName:''}];
 p.abilityState.blocks=[{id:'block',sourceId:'aries',fromId:'t',fromNickname:'교사',until:now+50000,reward:2}];
 const studentRows=templeItemRows(room,p,now);assert(studentRows.every(r=>!r.abilityCancelKey&&!r.abilityMarkerId));
 const teacherRows=templeItemRows(room,teacher,now).filter(r=>r.category==='ability');assert(teacherRows.every(r=>r.abilityCancelKey));
 for(const type of ['marker','block','ariesSleep','cetusPraise','cetusAfterglow','paralysis']){
  const entry=abilityCancellationEntries(p,now).find(e=>e.type===type);
  assert.throws(()=>cancelAbilityEffect(room,p,p.id,entry.key,now),/선생님/);
  cancelAbilityEffect(room,teacher,p.id,entry.key,now);
  assert.throws(()=>cancelAbilityEffect(room,teacher,p.id,entry.key,now),/끝났거나/);
 }
 assert.equal(state.abilitySeal,null);assert.equal(p.starShards,10);assert.equal(p.avatar.xp,0);
 assert.equal(state.usedWeek,'2026-11-02');assert.equal(p.abilityState.usedCount,1);
});
test('stale keys cannot remove replacement effects and simultaneous challenge sources remain separate',()=>{
 const {teacher,p,room}=setup();room.players.set('s',{id:'s',nickname:'달이'});
 p.constellationAbilityState.leoChallenges=['t','s'].map(sourceId=>({sourceId,level:3,startsAt:now,endsAt:now+60000,rewarded:false}));
 const rows=templeItemRows(room,teacher,now).filter(r=>r.statusId==='challenge-mid');assert.equal(new Set(rows.map(r=>r.abilityCancelKey)).size,2);
 const key=rows.find(r=>r.fromNickname==='달이').abilityCancelKey;cancelAbilityEffect(room,teacher,p.id,key,now);
 assert.deepEqual(p.constellationAbilityState.leoChallenges.map(r=>r.sourceId),['t']);
 const remaining=abilityCancellationEntries(p,now)[0];p.constellationAbilityState.leoChallenges[0].endsAt++;
 assert.throws(()=>cancelAbilityEffect(room,teacher,p.id,remaining.key,now),/끝났거나/);
 assert.equal(abilityCancellationEntries(p,now+70000).length,0);
});
test('socket enforces teacher, pillar, classroom, stale request and atomic save; cancellation persists after restart',async t=>{
 const f=await readingFixture(t),pillar=MAP.objects.find(o=>o.service==='effects');
 const approach=p=>Object.assign(p,{mapId:PLAZA_ID,x:pillar.x,y:pillar.y+60});
 f.mutate(p=>{p.constellationAbilityState.ariesSleep={sourceId:p.id,startsAt:f.now,endsAt:f.now+60000,reward:1,wakeCost:0};p.abilityState.usedWeek='2026-10-12';p.abilityState.usedCount=1;});
 approach(f.teacherPlayer);approach(f.p);
 const row=ok(await call(f.teacher,'temple:read',{objectId:pillar.id})).rows.find(r=>r.statusId==='sleep');
 const payload={objectId:pillar.id,targetId:f.p.id,abilityCancelKey:row.abilityCancelKey};
 assert.equal((await call(f.student,'ability:cancel',payload)).ok,false);
 assert.equal((await call(f.teacher,'ability:cancel',{...payload,targetId:f.q.id})).ok,false);
 assert.equal((await call(f.teacher,'ability:cancel',{...payload,objectId:'pillar-notice'})).ok,false);
 Object.assign(f.teacherPlayer,{x:0,y:0});assert.equal((await call(f.teacher,'ability:cancel',payload)).ok,false);approach(f.teacherPlayer);
 await f.fail(async()=>assert.equal((await call(f.teacher,'ability:cancel',payload)).ok,false));
 assert(f.p.constellationAbilityState.ariesSleep);approach(f.teacherPlayer);
 ok(await call(f.teacher,'ability:cancel',payload));assert.equal(f.p.constellationAbilityState.ariesSleep,null);
 assert.equal((await call(f.teacher,'ability:cancel',payload)).ok,false);
 await f.restart();assert.equal(f.p.constellationAbilityState.ariesSleep,null);assert.equal(f.p.starShards,0);assert.equal(f.p.abilityState.usedCount,1);
});
test('teacher ends both sides of a Pisces pair and safely releases a whale occupant without an after-reward',async t=>{
 const f=await readingFixture(t),pillar=MAP.objects.find(o=>o.service==='effects');
 const approach=()=>Object.assign(f.teacherPlayer,{mapId:PLAZA_ID,x:pillar.x,y:pillar.y+60});
 f.mutate((p,room)=>{
  const pair={sourceId:p.id,level:2,startsAt:f.now,endsAt:f.now+weeklyAbilityFor('pisces',2).days*86400000};
  p.piscesPair={...pair,partnerId:f.q.id};f.q.piscesPair={...pair,partnerId:p.id};
  room.parties.set('pair-test',{id:'pair-test',leaderId:p.id,memberIds:[p.id,f.q.id],piscesPair:true,endsAt:pair.endsAt});
 });approach();
 const cancel=async status=>{const rows=ok(await call(f.teacher,'temple:read',{objectId:pillar.id})).rows;const r=rows.find(r=>r.targetId===f.p.id&&r.statusId===status);assert(r?.abilityCancelKey);ok(await call(f.teacher,'ability:cancel',{objectId:pillar.id,targetId:f.p.id,abilityCancelKey:r.abilityCancelKey}));};
 await cancel('pair');assert.equal(f.p.piscesPair,null);assert.equal(f.q.piscesPair,null);assert.equal(f.room.parties.size,0);
 f.mutate(p=>{p.constellationAbilityState.cetusStomach={sourceId:f.q.id,level:5,startsAt:f.now,endsAt:f.now+86400000,returnMapId:PLAZA_ID,returnX:1000,returnY:1000};p.mapId=WHALE_STOMACH_ID;});approach();
 await cancel('cetus-stomach');assert.equal(f.p.constellationAbilityState.cetusStomach,null);assert.equal(f.p.mapId,PLAZA_ID);assert.equal(f.p.constellationAbilityState.cetusAfterglow,null);assert.equal(f.p.starShards,0);
});
