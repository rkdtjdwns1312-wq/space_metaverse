import test from 'node:test';
import assert from 'node:assert/strict';
import {readingFixture,call,ok} from './helpers/reading-fixture.js';
import {freshConstellationAbilityState,constellationAbilityStatus,validateConstellationAbilityState,applyHerculesWeekly,completeSagittariusUse} from '../server/constellation-weekly-abilities.js';
import {useCetus,respondCetus,settleCetusStomachs} from '../server/cetus-weekly.js';
import {WHALE_STOMACH_ID,PLAZA_ID,UNIVERSE_MAP_LAYOUT,SHARDS} from '../shared/config.js';
import {constellationWeekStart,CONSTELLATION_WEEK_MS} from '../shared/constellation-weekly-abilities.js';

const DAY=86400000;
const makeWhale=(f,level)=>f.mutate(player=>{player.avatar.constellationId='cetus';player.avatar.level=level;player.starShards=10;player.constellationAbilityState=freshConstellationAbilityState();});

test('hidden whale map is not a selectable universe-map entry',()=>{
  assert(!UNIVERSE_MAP_LAYOUT.some(entry=>entry.id===WHALE_STOMACH_ID));
});

test('Lv2 consent creates rather than transfers one shard, and only future weekly uses double',async t=>{
  const f=await readingFixture(t);makeWhale(f,2);
  const invite=ok(await call(f.student,'constellation-ability:use',{targetId:f.q.id})).invitation;
  assert.equal(f.p.starShards,10);assert.equal(f.q.starShards,0);
  ok(await call(f.other,'cetus:respond',{requestId:invite.id,accept:true}));
  assert.equal(f.p.starShards,11);assert.equal(f.q.starShards,0);
  f.mutate(()=>{f.q.avatar.constellationId='aquarius';f.q.avatar.level=2;});
  assert.equal(ok(await call(f.other,'constellation-ability:use')).reward,1);
  assert.equal(ok(await call(f.other,'constellation-ability:use')).reward,1);
  assert.equal((await call(f.other,'constellation-ability:use')).ok,false);
  await f.restart();assert.equal(f.q.starShards,2);
});

test('Lv2 rejection consumes the week and cannot deduct friend shards',async t=>{
  const f=await readingFixture(t);makeWhale(f,2);
  const invite=ok(await call(f.student,'constellation-ability:use',{targetId:f.q.id})).invitation;
  ok(await call(f.other,'cetus:respond',{requestId:invite.id,accept:false}));
  assert.equal(f.p.starShards,10);assert.equal(f.q.starShards,0);
  assert.equal((await call(f.student,'constellation-ability:use',{targetId:f.q.id})).ok,false);
});

test('Lv3 praise never creates negative shards and does not revive already spent ability',async t=>{
  const f=await readingFixture(t);makeWhale(f,3);
  f.mutate(()=>{f.q.avatar.constellationId='aquarius';f.q.avatar.level=2;});
  ok(await call(f.other,'constellation-ability:use'));
  ok(await call(f.student,'constellation-ability:use',{targetId:f.q.id}));
  assert.equal(f.p.starShards,11);
  assert.equal((await call(f.other,'constellation-ability:use')).ok,false);
  assert.deepEqual(validateConstellationAbilityState(f.q.constellationAbilityState),f.q.constellationAbilityState);
});

test('Lv4 belly admits consented friend, allows only map chat or solo escape, and removes future effect on escape',async t=>{
  const f=await readingFixture(t);makeWhale(f,4);
  f.mutate(()=>{f.q.avatar.constellationId='aquarius';f.q.avatar.level=2;});
  const invite=ok(await call(f.student,'constellation-ability:use',{targetId:f.q.id})).invitation;
  ok(await call(f.other,'cetus:respond',{requestId:invite.id,accept:true}));
  assert.equal(f.q.mapId,WHALE_STOMACH_ID);assert.equal(f.p.starShards,13);
  assert.equal((await call(f.other,'constellation-ability:use')).ok,false);
  assert.equal((await call(f.other,'map:travel',{to:PLAZA_ID})).ok,false);
  ok(await call(f.other,'chat:send',{text:'배 속에서 이야기'}));
  assert.equal((await call(f.other,'chat:send',{channel:'department',text:'밖으로 말하기'})).ok,false);
  ok(await call(f.other,'cetus:escape'));
  assert.notEqual(f.q.mapId,WHALE_STOMACH_ID);assert.equal(f.q.constellationAbilityState.cetusPraise,null);
  ok(await call(f.other,'constellation-ability:use'));
  assert.equal((await call(f.other,'constellation-ability:use')).ok,false);
});

test('an active belly survives a persistent classroom restart',async t=>{
  const f=await readingFixture(t);makeWhale(f,4);
  f.mutate(()=>{f.q.avatar.level=2;});
  const invite=ok(await call(f.student,'constellation-ability:use',{targetId:f.q.id})).invitation;
  ok(await call(f.other,'cetus:respond',{requestId:invite.id,accept:true}));
  assert.equal(f.q.mapId,WHALE_STOMACH_ID);
  await f.restart();assert.equal(f.q.mapId,WHALE_STOMACH_ID);
  ok(await call(f.other,'cetus:escape'));assert.notEqual(f.q.mapId,WHALE_STOMACH_ID);
});

test('Lv4 natural release persists future praise rather than replacing it with an old state',async t=>{
  const f=await readingFixture(t);makeWhale(f,4);
  f.mutate(()=>{f.q.avatar.constellationId='aquarius';f.q.avatar.level=2;});
  const invite=ok(await call(f.student,'constellation-ability:use',{targetId:f.q.id})).invitation;
  ok(await call(f.other,'cetus:respond',{requestId:invite.id,accept:true}));
  f.advance(DAY);f.mutate((_p,room)=>settleCetusStomachs(room,f.now));
  assert.equal(f.q.constellationAbilityState.cetusPraise?.sourceId,f.p.id);
  ok(await call(f.other,'constellation-ability:use'));
  ok(await call(f.other,'constellation-ability:use'));
  assert.equal((await call(f.other,'constellation-ability:use')).ok,false);
});

test('solo escape remains possible after previously doubled uses and while asleep',async t=>{
  const f=await readingFixture(t);makeWhale(f,4);
  f.mutate(()=>{f.q.avatar.constellationId='cygnus';f.q.avatar.level=2;
    f.q.constellationAbilityState.cetusPraise={sourceId:f.p.id,startsAt:f.now,endsAt:f.now+7*DAY,
      eligibleWeek:constellationWeekStart(f.now),bonusUsed:false};});
  for(let i=0;i<4;i++){ok(await call(f.other,'constellation-ability:use',{targetId:f.p.id,praiseIndex:i}));f.advance(1600);}
  const invite=ok(await call(f.student,'constellation-ability:use',{targetId:f.q.id})).invitation;
  ok(await call(f.other,'cetus:respond',{requestId:invite.id,accept:true}));
  f.mutate(()=>{f.q.constellationAbilityState.ariesSleep={sourceId:f.p.id,startsAt:f.now,endsAt:f.now+DAY,reward:0,wakeCost:1};});
  ok(await call(f.other,'cetus:escape'));
  assert.notEqual(f.q.mapId,WHALE_STOMACH_ID);
  assert.equal(f.q.constellationAbilityState.cetusPraise,null);
  assert.equal(f.q.constellationAbilityState.lastResult.uses,4);
  await f.restart();assert.equal(f.q.constellationAbilityState.lastResult.uses,4);
});

test('failed disk save rolls back whale invite and spent slot',async t=>{
  const f=await readingFixture(t);makeWhale(f,4);
  f.mutate(()=>{f.q.avatar.level=2;});
  await f.fail(async()=>assert.equal((await call(f.student,'constellation-ability:use',{targetId:f.q.id})).ok,false));
  assert.equal(f.p.constellationAbilityState.cetus,null);
  assert.equal(f.room.cetusInvites?.size??0,0);
  assert.equal(ok(await call(f.student,'constellation-ability:use',{targetId:f.q.id})).invitation.toId,f.q.id);
});

test('Ophiuchus copying Cetus Lv2 can send and settle the original invitation',async t=>{
  const f=await readingFixture(t);
  f.mutate(player=>{player.avatar.constellationId='ophiuchus';player.avatar.level=4;player.starShards=10;
    f.q.avatar.constellationId='cetus';f.q.avatar.level=2;});
  ok(await call(f.student,'constellation-ability:use',{level:4}));
  const invite=ok(await call(f.student,'constellation-ability:borrowed-use',{targetId:f.q.id})).invitation;
  assert.equal(invite.borrowedFromOphiuchus,true);
  ok(await call(f.other,'cetus:respond',{requestId:invite.id,accept:true}));
  assert.equal(f.p.starShards,11);assert.equal(f.q.starShards,0);
  await f.restart();assert.equal(f.p.starShards,11);
});

test('copied Cetus reward over the shard cap moves to the native pending ledger',async t=>{
  const f=await readingFixture(t);
  f.mutate(player=>{player.avatar.constellationId='ophiuchus';player.avatar.level=4;player.starShards=SHARDS.max;
    f.q.avatar.constellationId='cetus';f.q.avatar.level=2;});
  ok(await call(f.student,'constellation-ability:use',{level:4}));
  const invite=ok(await call(f.student,'constellation-ability:borrowed-use',{targetId:f.q.id})).invitation;
  ok(await call(f.other,'cetus:respond',{requestId:invite.id,accept:true}));
  assert.equal(f.p.constellationAbilityState.cetusUnclaimed,1);
  assert.equal(f.p.constellationAbilityState.ophiuchus.copied.state.cetusUnclaimed,0);
  f.mutate(player=>{player.starShards--;});
  ok(await call(f.student,'chat:send',{text:'별 파편 보상 확인'}));
  assert.equal(f.p.starShards,SHARDS.max);
  assert.equal(f.p.constellationAbilityState.cetusUnclaimed,0);
});

test('copied Cetus Lv5 can persist four invitation uses',()=>{
  const state=freshConstellationAbilityState();
  state.ophiuchus={week:constellationWeekStart(Date.parse('2026-10-13T10:00:00Z')),usedLevels:[4],bonusUsedLevels:[],copied:{
    fromId:'friend',constellationId:'cetus',level:5,used:true,useCount:4,usedLevels:[],
    endsAt:constellationWeekStart(Date.parse('2026-10-13T10:00:00Z'))+CONSTELLATION_WEEK_MS,
    state:freshConstellationAbilityState()}};
  assert.deepEqual(validateConstellationAbilityState(state),state);
});

test('praised Sagittarius Lv5 department mode records 2 then 4 uses and stops',()=>{
  const now=Date.parse('2026-10-13T10:00:00Z'),state=freshConstellationAbilityState();
  state.cetusPraise={sourceId:'whale',startsAt:now,endsAt:now+7*DAY,eligibleWeek:constellationWeekStart(now),bonusUsed:false};
  const player={id:'archer',role:'student',connected:true,away:false,avatar:{constellationId:'sagittarius',level:5,blackStar:null},starShards:0,constellationAbilityState:state};
  completeSagittariusUse(player,'department',{planetId:'one'},now);
  assert.equal(player.constellationAbilityState.lastResult.uses,2);
  assert.equal(constellationAbilityStatus(player,now).canUse,true);
  completeSagittariusUse(player,'department',{planetId:'two'},now);
  assert.equal(player.constellationAbilityState.lastResult.uses,4);
  assert.equal(constellationAbilityStatus(player,now).canUse,false);
});

test('Lv5 automatic release gives one later shard on first weekly ability use',async t=>{
  const f=await readingFixture(t);makeWhale(f,5);
  f.mutate(()=>{f.q.avatar.constellationId='aquarius';f.q.avatar.level=2;});
  const invite=ok(await call(f.student,'constellation-ability:use',{targetId:f.q.id})).invitation;
  ok(await call(f.other,'cetus:respond',{requestId:invite.id,accept:true}));
  f.advance(DAY);f.mutate((_p,room)=>settleCetusStomachs(room,f.now));
  assert.notEqual(f.q.mapId,WHALE_STOMACH_ID);
  assert.equal(f.q.constellationAbilityState.cetusAfterglow.claimed,false);
  assert.equal(ok(await call(f.other,'constellation-ability:use')).reward,1);
  assert.equal(f.q.starShards,2);
  assert.equal(f.q.constellationAbilityState.cetusAfterglow.claimed,true);
  await f.restart();assert.equal(f.q.starShards,2);
});

test('Lv4 refusals consume only one invite slot',()=>{
  const now=Date.parse('2026-10-13T10:00:00Z');
  const make=(id,name,level,constellationId)=>({id,nickname:name,role:'student',connected:true,away:false,
    avatar:{level,constellationId,blackStar:null},starShards:0,mapId:PLAZA_ID,x:500,y:500,
    constellationAbilityState:freshConstellationAbilityState()});
  const whale=make('w','고래',4,'cetus'),a=make('a','첫째',2,'aquarius'),b=make('b','둘째',2,'aquarius');
  const room={players:new Map([[whale.id,whale],[a.id,a],[b.id,b]]),planets:new Map(),cetusInvites:new Map()};
  const first=useCetus(room,whale,{targetId:a.id},now).invitation;
  assert.equal(respondCetus(room,a,first.id,false,now).accepted,false);
  assert.equal(constellationAbilityStatus(whale,now).canUse,true);
  const second=useCetus(room,whale,{targetId:b.id},now).invitation;
  assert.equal(respondCetus(room,b,second.id,false,now).accepted,false);
  assert.equal(constellationAbilityStatus(whale,now).canUse,false);
});

test('praise doubles Hercules weekly passive warning uses',()=>{
  const now=Date.parse('2026-10-13T10:00:00Z'),state=freshConstellationAbilityState();
  state.cetusPraise={sourceId:'whale',startsAt:now,endsAt:now+7*DAY,eligibleWeek:constellationWeekStart(now),bonusUsed:false};
  const player={id:'hero',role:'student',connected:true,away:false,avatar:{constellationId:'hercules',level:2,blackStar:null},starShards:0,constellationAbilityState:state};
  assert.equal(applyHerculesWeekly(player,'warning',now).negated,true);
  assert.equal(applyHerculesWeekly(player,'warning',now).negated,true);
  assert.equal(applyHerculesWeekly(player,'warning',now),null);
  assert.equal(player.constellationAbilityState.warningCount,2);
});

test('praise gives Ophiuchus Lv2 one additional future stage use',async t=>{
  const f=await readingFixture(t);
  f.mutate(player=>{player.avatar.constellationId='ophiuchus';player.avatar.level=2;player.starShards=10;
    player.constellationAbilityState.cetusPraise={sourceId:'whale',startsAt:f.now,endsAt:f.now+7*DAY,eligibleWeek:constellationWeekStart(f.now),bonusUsed:false};});
  ok(await call(f.student,'constellation-ability:use',{level:2,targetId:f.q.id}));
  f.mutate(()=>{f.q.constellationAbilityState.paralysis=null;});
  ok(await call(f.student,'constellation-ability:use',{level:2,targetId:f.q.id}));
  assert.deepEqual(f.p.constellationAbilityState.ophiuchus.bonusUsedLevels,[2]);
  assert.equal((await call(f.student,'constellation-ability:use',{level:2,targetId:f.q.id})).ok,false);
  await f.restart();assert.deepEqual(f.p.constellationAbilityState.ophiuchus.bonusUsedLevels,[2]);
});

test('praise doubles Swan Lv2 compliment uses from two to four',async t=>{
  const f=await readingFixture(t);
  f.mutate(()=>{f.q.avatar.constellationId='cygnus';f.q.avatar.level=2;
    f.q.constellationAbilityState.cetusPraise={sourceId:f.p.id,startsAt:f.now,endsAt:f.now+7*DAY,
      eligibleWeek:constellationWeekStart(f.now),bonusUsed:false};});
  for(let i=0;i<4;i++){
    ok(await call(f.other,'constellation-ability:use',{targetId:f.p.id,praiseIndex:i}));
    f.advance(1600);
  }
  assert.equal(f.q.starShards,4);
  assert.equal(f.q.constellationAbilityState.cetusPraise.bonusUsed,true);
  assert.equal((await call(f.other,'constellation-ability:use',{targetId:f.p.id,praiseIndex:0})).ok,false);
});
