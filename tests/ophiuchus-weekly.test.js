import test from 'node:test';
import assert from 'node:assert/strict';
import {readingFixture,call,ok} from './helpers/reading-fixture.js';
import {freshConstellationAbilityState,validateConstellationAbilityState,completeSwanCompliment} from '../server/constellation-weekly-abilities.js';
import {activeOphiuchusParalysis,settleOphiuchusTransfers,useOphiuchus,borrowedOphiuchusActor,promoteBorrowedOphiuchusCopy} from '../server/ophiuchus-weekly.js';
import {settleCorona} from '../server/corona-weekly.js';
import {crownPriorities} from '../server/corona-weekly.js';
import {applyHerculesWeekly} from '../server/constellation-weekly-abilities.js';
import {settleSwanDaily} from '../server/swan-weekly.js';
import {addPlanet} from '../server/world.js';
import {departmentSlots} from '../shared/plaza-layout.js';
import {SHARDS} from '../shared/config.js';
import {issueWarning,warningCount} from '../server/warnings.js';

const DAY=86400000;
const makeSerpent=(fixture,level)=>fixture.mutate(player=>{
  player.avatar.constellationId='ophiuchus';player.avatar.level=level;player.starShards=10;
  player.constellationAbilityState=freshConstellationAbilityState();
});

test('Lv3 follows registered order, catches up after downtime, and stops at the last name',()=>{
  const now=Date.parse('2026-10-13T14:00:00Z'),names=['하나','둘','셋','넷'];
  const players=names.map((nickname,index)=>({id:String(index),nickname,role:'student',connected:true,away:false,
    avatar:{constellationId:index?'aquarius':'ophiuchus',level:index?2:3},starShards:10,constellationAbilityState:freshConstellationAbilityState()}));
  const room={allowedNames:new Set(names),players:new Map(players.map(player=>[player.id,player]))};
  useOphiuchus(room,players[0],{level:3},now,()=>0);
  assert(activeOphiuchusParalysis(players[1],now));
  assert.equal(settleOphiuchusTransfers(room,now+2*DAY),true);
  assert.equal(activeOphiuchusParalysis(players[1],now+2*DAY),null);
  assert(activeOphiuchusParalysis(players[3],now+2*DAY));
  assert.equal(settleOphiuchusTransfers(room,now+3*DAY),true);
  assert.equal(activeOphiuchusParalysis(players[3],now+3*DAY),null);
  assert.equal(settleOphiuchusTransfers(room,now+4*DAY),false);
});

test('copying Ophiuchus can chain once more without recursive stored state or extending the original expiry',()=>{
  const now=Date.parse('2026-10-13T14:00:00Z'),names=['시전자','뱀친구','물병친구'];
  const players=names.map((nickname,index)=>({id:String(index),nickname,role:'student',connected:true,away:false,
    avatar:{constellationId:index===2?'aquarius':'ophiuchus',level:index===2?2:4},starShards:10,constellationAbilityState:freshConstellationAbilityState()}));
  const room={allowedNames:new Set(names),players:new Map(players.map(player=>[player.id,player]))};
  useOphiuchus(room,players[0],{level:4},now,()=>0);
  const originalExpiry=players[0].constellationAbilityState.ophiuchus.copied.endsAt;
  const borrowed=borrowedOphiuchusActor(players[0],now);
  assert.equal(borrowed.copied.constellationId,'ophiuchus');
  useOphiuchus(room,borrowed.actor,{level:4},now+1000,()=>0);
  assert.equal(promoteBorrowedOphiuchusCopy(borrowed),true);
  assert.equal(players[0].constellationAbilityState.ophiuchus.copied.constellationId,'aquarius');
  assert.equal(players[0].constellationAbilityState.ophiuchus.copied.endsAt,originalExpiry);
  assert.deepEqual(validateConstellationAbilityState(players[0].constellationAbilityState),players[0].constellationAbilityState);
});

for(const copiedLevel of [2,3,5])test(`copied Ophiuchus Lv${copiedLevel} keeps used slots in valid persisted state`,()=>{
  const now=Date.parse('2026-10-13T14:00:00Z'),names=['시전자','뱀친구','물병친구'];
  const players=names.map((nickname,index)=>({id:String(index),nickname,role:'student',connected:true,away:false,
    avatar:{constellationId:index===2?'aquarius':'ophiuchus',level:index===0?4:index===1?copiedLevel:2},
    starShards:10,constellationAbilityState:freshConstellationAbilityState()}));
  const room={allowedNames:new Set(names),players:new Map(players.map(player=>[player.id,player]))};
  useOphiuchus(room,players[0],{level:4},now,()=>0);
  const borrowed=borrowedOphiuchusActor(players[0],now);
  const slot=copiedLevel===5?2:copiedLevel;
  useOphiuchus(room,borrowed.actor,{level:slot,...(slot===2?{targetId:players[2].id}:{})},now+1,()=>0);
  borrowed.save();
  assert.deepEqual(validateConstellationAbilityState(players[0].constellationAbilityState),players[0].constellationAbilityState);
  if(copiedLevel===5){
    players[2].constellationAbilityState.paralysis=null;
    useOphiuchus(room,borrowed.actor,{level:3},now+2,()=>0);
    borrowed.save();
    assert.deepEqual(players[0].constellationAbilityState.ophiuchus.copied.state.ophiuchus.usedLevels,[2,3]);
  }
});

test('Saturday Lv4 copy survives Sunday Lv2 use until its actual seven-day expiry',()=>{
  const saturday=Date.parse('2026-10-17T10:00:00Z'),players=[
    {id:'caster',nickname:'시전자',role:'student',connected:true,away:false,avatar:{constellationId:'ophiuchus',level:5},starShards:10,constellationAbilityState:freshConstellationAbilityState()},
    {id:'friend',nickname:'친구',role:'student',connected:true,away:false,avatar:{constellationId:'aquarius',level:2},starShards:10,constellationAbilityState:freshConstellationAbilityState()}
  ],room={allowedNames:new Set(players.map(player=>player.nickname)),players:new Map(players.map(player=>[player.id,player]))};
  useOphiuchus(room,players[0],{level:4},saturday,()=>0);
  const copied=players[0].constellationAbilityState.ophiuchus.copied;
  useOphiuchus(room,players[0],{level:2,targetId:players[1].id},saturday+86400000+1);
  assert.equal(players[0].constellationAbilityState.ophiuchus.copied.fromId,copied.fromId);
  assert.equal(players[0].constellationAbilityState.ophiuchus.copied.endsAt,copied.endsAt);
});

test('a copied Swan Lv2 first compliment remains valid at shard cap',()=>{
  const now=Date.parse('2026-10-13T14:00:00Z'),players=[
    {id:'caster',nickname:'시전자',role:'student',connected:true,away:false,avatar:{constellationId:'ophiuchus',level:4},starShards:SHARDS.max-1,constellationAbilityState:freshConstellationAbilityState()},
    {id:'swan',nickname:'백조친구',role:'student',connected:true,away:false,avatar:{constellationId:'cygnus',level:2},starShards:10,constellationAbilityState:freshConstellationAbilityState()}
  ],room={allowedNames:new Set(players.map(player=>player.nickname)),players:new Map(players.map(player=>[player.id,player]))};
  useOphiuchus(room,players[0],{level:4},now,()=>0);
  const borrowed=borrowedOphiuchusActor(players[0],now);
  completeSwanCompliment(borrowed.actor,players[1].id,now);
  borrowed.copied.useCount++;
  borrowed.save();
  assert.deepEqual(validateConstellationAbilityState(players[0].constellationAbilityState),players[0].constellationAbilityState);
});

test('Lv2 selected target is item-blocked for two days and may pay one shard to clear',async t=>{
  const f=await readingFixture(t);makeSerpent(f,2);f.mutate(()=>f.q.starShards=3);
  assert.equal((await call(f.student,'constellation-ability:use',{level:2,targetId:'bad'})).ok,false);
  ok(await call(f.student,'constellation-ability:use',{level:2,targetId:f.q.id}));
  assert.equal(activeOphiuchusParalysis(f.q,f.now).cost,1);
  assert.equal((await call(f.student,'constellation-ability:use',{level:2,targetId:f.q.id})).ok,false);
  assert.equal((await call(f.other,'item:use',{itemId:'little-moon-card',targetId:f.q.id})).ok,false);
  ok(await call(f.other,'constellation-ability:paralysis-clear',{}));
  assert.equal(f.q.starShards,2);assert.equal(activeOphiuchusParalysis(f.q,f.now),null);
  assert.equal((await call(f.other,'constellation-ability:paralysis-clear',{})).ok,false);
  await f.restart();assert.deepEqual(validateConstellationAbilityState(f.p.constellationAbilityState),f.p.constellationAbilityState);
});

test('Lv3 moves forward through class register and ends after last student',async t=>{
  const f=await readingFixture(t);makeSerpent(f,3);f.mutate(()=>f.q.starShards=3);
  const result=ok(await call(f.student,'constellation-ability:use',{level:3,targetId:'forged'}));
  assert.equal(result.targetId,f.q.id);
  f.advance(DAY);f.mutate((_p,room)=>settleOphiuchusTransfers(room,f.now));
  assert.equal(activeOphiuchusParalysis(f.q,f.now),null);
  assert.equal(f.p.constellationAbilityState.ophiuchus.usedLevels[0],3);
});

test('Lv4 seals the target ability and paid clearing lifts both lock and seal',async t=>{
  const f=await readingFixture(t);makeSerpent(f,4);
  f.mutate(()=>{f.q.avatar.constellationId='aquarius';f.q.avatar.level=2;f.q.starShards=3;});
  const result=ok(await call(f.student,'constellation-ability:use',{level:4}));
  assert.equal(result.targetId,f.q.id);
  assert.equal(ok(await call(f.other,'constellation-ability:status',{})).canUse,false);
  assert.equal((await call(f.other,'constellation-ability:use',{})).ok,false);
  ok(await call(f.other,'constellation-ability:paralysis-clear',{}));
  assert.equal(f.q.starShards,0);assert.equal(f.q.constellationAbilityState.abilitySeal,null);
  assert.equal(ok(await call(f.other,'constellation-ability:status',{})).canUse,true);
});

test('failed storage rolls back both sides of paralysis and the release payment',async t=>{
  const f=await readingFixture(t);makeSerpent(f,4);
  f.mutate(()=>{f.q.avatar.constellationId='aquarius';f.q.avatar.level=2;f.q.starShards=5;});
  await f.fail(async()=>assert.equal((await call(f.student,'constellation-ability:use',{level:4})).ok,false));
  assert.equal(f.p.constellationAbilityState.ophiuchus,null);
  assert.equal(f.q.constellationAbilityState.paralysis,null);
  ok(await call(f.student,'constellation-ability:use',{level:4}));
  await f.fail(async()=>assert.equal((await call(f.other,'constellation-ability:paralysis-clear',{})).ok,false));
  assert.equal(f.q.starShards,5);assert(activeOphiuchusParalysis(f.q,f.now));
  ok(await call(f.other,'constellation-ability:paralysis-clear',{}));assert.equal(f.q.starShards,2);
});

test('Lv4 copied instant ability pays caster, not sealed target, exactly once',async t=>{
  const f=await readingFixture(t);makeSerpent(f,4);
  f.mutate(()=>{f.q.avatar.constellationId='aquarius';f.q.avatar.level=2;});
  ok(await call(f.student,'constellation-ability:use',{level:4}));
  const before=f.p.starShards;
  const copied=ok(await call(f.student,'constellation-ability:borrowed-use',{}));
  assert.equal(copied.reward,1);assert.equal(f.p.starShards,before+1);
  assert.equal(f.q.starShards,0);
  assert.equal((await call(f.student,'constellation-ability:borrowed-use',{})).ok,false);
  await f.restart();assert.equal(f.p.starShards,before+1);
});

test('Lv5 has three distinct weekly uses',async t=>{
  const f=await readingFixture(t);makeSerpent(f,5);
  f.mutate(()=>{f.q.avatar.constellationId='aquarius';f.q.avatar.level=2;});
  ok(await call(f.student,'constellation-ability:use',{level:2,targetId:f.q.id}));
  assert.equal((await call(f.student,'constellation-ability:use',{level:2,targetId:f.q.id})).ok,false);
  // The current target cannot be paralyzed twice simultaneously; clear before the next slot.
  f.mutate(()=>{f.q.constellationAbilityState.paralysis=null;});
  ok(await call(f.student,'constellation-ability:use',{level:3}));
  f.mutate(()=>{f.q.constellationAbilityState.paralysis=null;});
  ok(await call(f.student,'constellation-ability:use',{level:4}));
  assert.equal(ok(await call(f.student,'constellation-ability:status',{})).used,true);
  assert.deepEqual(f.p.constellationAbilityState.ophiuchus.usedLevels,[2,3,4]);
});

for(const [id,request,response,expected] of [
  ['pisces',{targetId:'TARGET'},'constellation-ability:pair-respond','piscesPair'],
  ['aries',{targetId:'TARGET'},'aries-sleep:respond','ariesSleep'],
  ['cancer',{targetId:'TARGET',choice:'rock'},'cancer-duel:respond','duel']
])test(`copied ${id} request completes using caster state after target accepts`,async t=>{
  const f=await readingFixture(t);makeSerpent(f,4);
  f.mutate(()=>{f.q.avatar.constellationId=id;f.q.avatar.level=2;f.q.starShards=10;});
  ok(await call(f.student,'constellation-ability:use',{level:4}));
  const invitation=ok(await call(f.student,'constellation-ability:borrowed-use',{
    ...request,targetId:f.q.id
  })).invitation;
  assert(invitation?.id);assert.equal(f.p.constellationAbilityState.ophiuchus.copied.used,false);
  ok(await call(f.other,response,{requestId:invitation.id,accept:true,...(id==='cancer'?{choice:'scissors'}:{})}));
  assert.equal(f.p.constellationAbilityState.ophiuchus.copied.used,true);
  if(expected==='piscesPair')assert(f.p.piscesPair?.endsAt>f.now);
  if(expected==='ariesSleep')assert(f.p.constellationAbilityState.ariesSleep?.endsAt>f.now);
  await f.restart();assert.equal(f.p.constellationAbilityState.ophiuchus.copied.used,true);
});

test('copied Crown Lv4 trial restores actual Ophiuchus Lv5, including restart',async t=>{
  const f=await readingFixture(t);makeSerpent(f,5);
  f.mutate(()=>{f.q.avatar.constellationId='corona-borealis';f.q.avatar.level=4;});
  ok(await call(f.student,'constellation-ability:use',{level:4}));
  ok(await call(f.student,'constellation-ability:borrowed-use',{choice:'trial'}));
  assert.equal(f.p.avatar.level,1);assert.equal(f.p.avatar.constellationId,'ophiuchus');
  assert.equal(f.p.constellationAbilityState.coronaTrial.savedLevel,5);
  await f.restart();assert.equal(f.p.avatar.level,1);
  f.advance(8*DAY);f.mutate((_p,room)=>settleCorona(room,f.now));
  assert.equal(f.p.avatar.level,5);assert.equal(f.p.avatar.constellationId,'ophiuchus');
});

test('copied Hercules passive applies its original warning effect to caster',async t=>{
  const f=await readingFixture(t);makeSerpent(f,4);
  f.mutate(()=>{f.q.avatar.constellationId='hercules';f.q.avatar.level=2;});
  ok(await call(f.student,'constellation-ability:use',{level:4}));
  ok(await call(f.student,'constellation-ability:borrowed-use',{}));
  assert.equal(applyHerculesWeekly(f.p,'warning',f.now).negated,true);
  assert.equal(applyHerculesWeekly(f.p,'warning',f.now),null);
  await f.restart();assert.equal(applyHerculesWeekly(f.p,'warning',f.now),null);
});

test('copied Crown Lv5 passive appears in teacher priorities only during copy period',async t=>{
  const f=await readingFixture(t);makeSerpent(f,4);
  f.mutate(()=>{f.q.avatar.constellationId='corona-borealis';f.q.avatar.level=5;});
  ok(await call(f.student,'constellation-ability:use',{level:4}));
  ok(await call(f.student,'constellation-ability:borrowed-use',{}));
  assert(crownPriorities(f.room,f.now).some(p=>p.id===f.p.id));
  assert(f.game.store.snapshot(f.room,f.teacherPlayer,f.now).crownPriorities.some(p=>p.id===f.p.id));
  assert.equal(f.game.store.snapshot(f.room,f.p,f.now).crownPriorities,undefined);
  assert(!crownPriorities(f.room,f.now+8*DAY).some(p=>p.id===f.p.id));
});

test('copied Swan Lv4 daily ability awards caster after a calm school day',async t=>{
  const f=await readingFixture(t);makeSerpent(f,4);
  f.mutate(()=>{f.q.avatar.constellationId='cygnus';f.q.avatar.level=4;});
  ok(await call(f.student,'constellation-ability:use',{level:4}));
  ok(await call(f.student,'constellation-ability:borrowed-use',{}));
  f.mutate((_p,room)=>settleSwanDaily(room,f.now));
  const before=f.p.starShards;f.advance(16*3600000);
  f.mutate((_p,room)=>settleSwanDaily(room,f.now));
  assert.equal(f.p.starShards,before+1);
});

test('copied Sagittarius ability deletes the caster own warning',async t=>{
  const f=await readingFixture(t);makeSerpent(f,4);
  f.mutate(()=>{f.q.avatar.constellationId='sagittarius';f.q.avatar.level=2;});
  ok(await call(f.student,'constellation-ability:use',{level:4}));
  let planetId,warningId;
  f.mutate((p,room)=>{
    const planet=addPlanet(room,{name:'검사 부서',description:'',...departmentSlots()[0],color:'#c5c9f7',rules:['공평하게'],templateId:'rules'});
    planetId=planet.id;warningId=issueWarning(room,planet,f.teacherPlayer,p,'약속을 지켜요',f.now).entry.id;
  });
  const options=ok(await call(f.student,'constellation-ability:sagittarius-options',{}));
  assert.equal(options.warnings[0].id,warningId);
  ok(await call(f.student,'constellation-ability:borrowed-use',{mode:'warning',warningId}));
  assert.equal(warningCount(f.room.planets.get(planetId),f.p.id),0);
});

test('copied Sagittarius Lv4 clears the real avatar black star, even while trapped',async t=>{
  const f=await readingFixture(t);makeSerpent(f,4);
  f.mutate(()=>{f.q.avatar.constellationId='sagittarius';f.q.avatar.level=4;});
  ok(await call(f.student,'constellation-ability:use',{level:4}));
  let planetId;
  f.mutate((p,room)=>{
    const planet=addPlanet(room,{name:'검사 부서',description:'',...departmentSlots()[0],color:'#c5c9f7',rules:['공평하게'],templateId:'rules'});
    planetId=planet.id;p.avatar.blackStar={at:f.now,planetId};
  });
  ok(await call(f.student,'constellation-ability:borrowed-use',{mode:'black-star',blackStarAt:f.now}));
  assert.equal(f.p.avatar.blackStar,null);
  await f.restart();assert.equal(f.p.avatar.blackStar,null);
});

test('copied Swan Lv2 retains its second compliment after first reaches shard cap',async t=>{
  const f=await readingFixture(t);makeSerpent(f,4);
  f.mutate(()=>{f.q.avatar.constellationId='cygnus';f.q.avatar.level=2;f.p.starShards=SHARDS.max-1;});
  ok(await call(f.student,'constellation-ability:use',{level:4}));
  ok(await call(f.student,'constellation-ability:borrowed-use',{targetId:f.q.id,praiseIndex:0}));
  assert.equal(f.p.starShards,SHARDS.max);
  assert.equal(f.p.constellationAbilityState.ophiuchus.copied.used,false);
  f.mutate(p=>p.starShards--);f.advance(10000);
  ok(await call(f.student,'constellation-ability:borrowed-use',{targetId:f.q.id,praiseIndex:1}));
  assert.equal(f.p.constellationAbilityState.ophiuchus.copied.used,true);
});
