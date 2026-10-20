import test from 'node:test';
import assert from 'node:assert/strict';
import {readingFixture,call,ok} from './helpers/reading-fixture.js';
import {activeAriesSleep,ariesSleepDue,settleAriesSleep,nextAriesMorning,useAriesSleep} from '../server/aries-weekly.js';
import {freshConstellationAbilityState} from '../server/constellation-weekly-abilities.js';

const DAY=86400000;
const makeAries=(f,level)=>f.mutate(p=>{
  p.avatar.constellationId='aries';p.avatar.level=level;p.starShards=5;
  p.constellationAbilityState=freshConstellationAbilityState();
});

test('Lv2 invitation needs consent and pays both at next KST 08:00 after restart',async t=>{
  const f=await readingFixture(t);makeAries(f,2);
  assert.equal((await call(f.student,'constellation-ability:use',{targetId:'bad'})).ok,false);
  const first=ok(await call(f.student,'constellation-ability:use',{targetId:f.q.id}));
  assert.equal(f.p.constellationAbilityState.usedWeek,null);
  ok(await call(f.other,'aries-sleep:respond',{requestId:first.invitation.id,accept:false}));
  assert.equal(f.p.constellationAbilityState.usedWeek,null);
  const second=ok(await call(f.student,'constellation-ability:use',{targetId:f.q.id}));
  assert.equal((await call(f.student,'aries-sleep:respond',{requestId:second.invitation.id,accept:true})).ok,false);
  ok(await call(f.other,'aries-sleep:respond',{requestId:second.invitation.id,accept:true}));
  assert.equal(f.p.starShards,5);assert.equal(f.q.starShards,0);
  assert.equal(f.p.constellationAbilityState.ariesSleep.endsAt,nextAriesMorning(f.now));
  assert.equal((await call(f.student,'combat:attack',{})).ok,false);
  assert.equal((await call(f.other,'chat:send',{text:'hi'})).ok,false);
  await f.restart();
  assert(activeAriesSleep(f.p,f.now));assert(activeAriesSleep(f.q,f.now));
  f.advance(nextAriesMorning(f.now)-f.now-1);assert.equal(ariesSleepDue(f.room,f.now),false);
  f.advance(1);assert.equal(ariesSleepDue(f.room,f.now),true);
  f.mutate((_p,room)=>assert.equal(settleAriesSleep(room,f.now),true));
  assert.equal(f.p.starShards,6);assert.equal(f.q.starShards,1);
  assert.equal(f.p.constellationAbilityState.ariesSleep,null);
  assert.equal(f.q.constellationAbilityState.ariesSleep,null);
  f.mutate((_p,room)=>assert.equal(settleAriesSleep(room,f.now),false));
});

test('Lv3 duration 1-3 days pays on waking and blocks repeated use',async t=>{
  const f=await readingFixture(t);makeAries(f,3);
  assert.equal((await call(f.student,'constellation-ability:use',{days:0})).ok,false);
  ok(await call(f.student,'constellation-ability:use',{days:3}));
  assert.equal((await call(f.student,'constellation-ability:use',{days:1})).ok,false);
  assert.equal((await call(f.student,'aries-sleep:wake',{})).ok,false);
  f.advance(3*DAY);f.mutate((_p,room)=>settleAriesSleep(room,f.now));
  assert.equal(f.p.starShards,8);
});

test('Lv4 random target excludes caster, can include offline students, and wake costs one shard',async t=>{
  const f=await readingFixture(t);makeAries(f,4);
  f.mutate((_p,room)=>{const q=room.players.get(f.q.id);q.connected=false;q.starShards=2;});
  const result=useAriesSleep(f.room,f.p,{},f.now,()=>0);
  assert.deepEqual(result.targetIds,[f.q.id]);
  assert.equal(activeAriesSleep(f.p,f.now),null);
  assert(activeAriesSleep(f.q,f.now));
  assert.equal(f.q.starShards,2);
  f.mutate((_p,room)=>room.players.get(f.q.id).connected=true);
  ok(await call(f.other,'aries-sleep:wake',{}));
  assert.equal(f.q.starShards,1);assert.equal(activeAriesSleep(f.q,f.now),null);
  assert.equal((await call(f.other,'aries-sleep:wake',{})).ok,false);
});

test('expired sleep reward is paid before a new random sleep replaces it',async t=>{
  const f=await readingFixture(t);makeAries(f,4);
  f.mutate((_p,room)=>{
    const target=room.players.get(f.q.id);
    target.starShards=2;
    target.constellationAbilityState={...freshConstellationAbilityState(),ariesSleep:{sourceId:'old',startsAt:f.now-2*DAY,endsAt:f.now-1000,reward:1,wakeCost:0}};
  });
  useAriesSleep(f.room,f.p,{},f.now,()=>0);
  assert.equal(f.q.starShards,3);
  assert.equal(f.q.constellationAbilityState.ariesSleep.reward,0);
});

test('failed save does not consume the weekly use or leave a student asleep',async t=>{
  const f=await readingFixture(t);makeAries(f,3);
  await f.fail(async()=>assert.equal((await call(f.student,'constellation-ability:use',{days:2})).ok,false));
  assert.equal(f.p.constellationAbilityState.usedWeek,null);
  assert.equal(f.p.constellationAbilityState.ariesSleep,null);
  ok(await call(f.student,'constellation-ability:use',{days:2}));
  assert(activeAriesSleep(f.p,f.now));
});
