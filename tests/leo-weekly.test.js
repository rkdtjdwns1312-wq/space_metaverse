import test from 'node:test';
import assert from 'node:assert/strict';
import {readingFixture,call,ok} from './helpers/reading-fixture.js';
import {freshConstellationAbilityState,validateConstellationAbilityState} from '../server/constellation-weekly-abilities.js';
import {useLeoChallenge,rewardLeoSubmission} from '../server/leo-weekly.js';
import {borrowedOphiuchusActor,useOphiuchus} from '../server/ophiuchus-weekly.js';
import {saveNotice} from '../server/temple.js';
import {MAP} from '../shared/config.js';

const makePlayer=(id,level,constellationId='aquarius')=>({id,nickname:id,role:'student',connected:true,away:false,
  avatar:{level,constellationId,xp:0,form:'constellation'},starShards:0,constellationAbilityState:freshConstellationAbilityState()});

test('Lv2 random challenge rewards caster once per friend, even across resubmissions',()=>{
  const now=Date.parse('2026-10-13T10:00:00Z'),caster=makePlayer('caster',2,'leo'),a=makePlayer('a',2),b=makePlayer('b',2);
  const room={players:new Map([caster,a,b].map(p=>[p.id,p]))};
  const result=useLeoChallenge(room,caster,{},now,()=>0);
  assert.deepEqual(result.targetIds,['a','b']);
  assert.equal(rewardLeoSubmission(room,a,now+1000).length,1);
  assert.equal(rewardLeoSubmission(room,a,now+2000).length,0);
  assert.equal(rewardLeoSubmission(room,b,now+3000).length,1);
  assert.equal(caster.starShards,2);assert.equal(a.starShards,0);assert.equal(b.starShards,0);
  assert.equal(rewardLeoSubmission(room,b,now+86400000).length,0);
  assert.equal(validateConstellationAbilityState(caster.constellationAbilityState).lastResult.constellationId,'leo');
});

test('Lv3 rewards both sides once, while expired challenge gives no reward',()=>{
  const now=Date.parse('2026-10-13T10:00:00Z'),caster=makePlayer('caster',3,'leo'),a=makePlayer('a',2),b=makePlayer('b',2);
  const room={players:new Map([caster,a,b].map(p=>[p.id,p]))};
  useLeoChallenge(room,caster,{},now,()=>0);
  rewardLeoSubmission(room,a,now+1000);rewardLeoSubmission(room,b,now+86400000);
  assert.equal(caster.starShards,1);assert.equal(a.starShards,1);assert.equal(b.starShards,0);
});

test('Lv5 requires two distinct Lv3-or-below friends and awards 4 XP/4 shards each',()=>{
  const now=Date.parse('2026-10-13T10:00:00Z'),caster=makePlayer('caster',5,'leo'),a=makePlayer('a',3),b=makePlayer('b',2),high=makePlayer('high',4);
  const room={players:new Map([caster,a,b,high].map(p=>[p.id,p]))};
  assert.throws(()=>useLeoChallenge(room,caster,{targetIds:['a','a']},now));
  assert.throws(()=>useLeoChallenge(room,caster,{targetIds:['a','high']},now));
  assert.equal(a.constellationAbilityState.leoChallenges.length,0);
  useLeoChallenge(room,caster,{targetIds:['a','b']},now);
  rewardLeoSubmission(room,a,now+1);rewardLeoSubmission(room,b,now+2);
  assert.equal(a.avatar.xp,4);assert.equal(b.avatar.xp,4);assert.equal(caster.starShards,8);
});

test('Ophiuchus copied Leo challenge credits the borrower, not the sealed original',()=>{
  const now=Date.parse('2026-10-13T10:00:00Z'),caster=makePlayer('caster',4,'ophiuchus'),leo=makePlayer('leo',4,'leo'),friend=makePlayer('friend',3);
  const room={players:new Map([caster,leo,friend].map(p=>[p.id,p])),allowedNames:new Set(['caster','leo','friend'])};
  useOphiuchus(room,caster,{level:4},now,()=>0);
  assert.equal(caster.constellationAbilityState.ophiuchus.copied.constellationId,'leo');
  const borrowed=borrowedOphiuchusActor(caster,now);
  useLeoChallenge(room,borrowed.actor,{targetIds:['friend']},now);
  borrowed.copied.used=true;borrowed.save();
  rewardLeoSubmission(room,friend,now+1000);
  assert.equal(caster.starShards,4);assert.equal(leo.starShards,0);assert.equal(friend.avatar.xp,4);
});

test('Lv4 reward happens on the actual first homework submission and survives restart',async t=>{
  const f=await readingFixture(t);f.mutate((p,room)=>{
    p.avatar.constellationId='leo';p.avatar.level=4;p.starShards=0;
    f.q.avatar.level=3;f.q.avatar.xp=0;
    saveNotice(room,'별 과제',[0],f.now);
    const portal=MAP.objects.find(object=>object.kind==='andromeda');
    Object.assign(f.q,{mapId:MAP.id,x:portal.x,y:portal.y,input:{x:0,y:0,at:0}});
  });
  ok(await call(f.student,'constellation-ability:use',{targetIds:[f.q.id]}));
  const assignment=f.room.temple.assignments[0];
  const submitted=ok(await call(f.other,'assignment:status:set',{assignmentId:assignment.id,status:'submitted'}));
  assert.equal(submitted.challengeRewards.length,1);
  assert.equal(f.q.avatar.xp,4);assert.equal(f.p.starShards,4);
  ok(await call(f.other,'assignment:status:set',{assignmentId:assignment.id,status:'working'}));
  assert.equal(ok(await call(f.other,'assignment:status:set',{assignmentId:assignment.id,status:'submitted'})).challengeRewards.length,0);
  assert.equal(f.q.avatar.xp,4);assert.equal(f.p.starShards,4);
  await f.restart();assert.equal(f.p.starShards,4);assert.equal(f.q.avatar.xp,4);
});

test('failed homework save rolls back challenge reward and submission status',async t=>{
  const f=await readingFixture(t);f.mutate((p,room)=>{
    p.avatar.constellationId='leo';p.avatar.level=4;p.starShards=0;f.q.avatar.level=3;
    saveNotice(room,'별 과제',[0],f.now);
    const portal=MAP.objects.find(object=>object.kind==='andromeda');
    Object.assign(f.q,{mapId:MAP.id,x:portal.x,y:portal.y,input:{x:0,y:0,at:0}});
  });
  ok(await call(f.student,'constellation-ability:use',{targetIds:[f.q.id]}));
  const assignment=f.room.temple.assignments[0];
  await f.fail(async()=>assert.equal((await call(f.other,'assignment:status:set',{assignmentId:assignment.id,status:'submitted'})).ok,false));
  assert.equal(f.p.starShards,0);assert.equal(f.q.avatar.xp,0);
  assert.equal(f.q.tasks.some(task=>task.status==='submitted'),false);
  ok(await call(f.other,'assignment:status:set',{assignmentId:assignment.id,status:'submitted'}));
  assert.equal(f.p.starShards,4);
});
