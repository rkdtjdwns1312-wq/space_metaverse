import test from 'node:test';
import assert from 'node:assert/strict';
import {readingFixture,call,ok} from './helpers/reading-fixture.js';
import {freshConstellationAbilityState,validateConstellationAbilityState,markConstellationChange} from '../server/constellation-weekly-abilities.js';
import {swanDailyDue,settleSwanDaily,swanCardOffer,buySwanStarCard,swanCampaignSigns} from '../server/swan-weekly.js';
import {constellationWeekStart} from '../shared/constellation-weekly-abilities.js';
import {SHARDS,SHOP} from '../shared/config.js';

const DAY=86400000,HOUR=3600000;
const player=(level=5)=>({id:'swan',nickname:'백조',role:'student',connected:true,away:false,starShards:10,inventory:[],avatar:{constellationId:'cygnus',level,blackStar:null},constellationAbilityState:freshConstellationAbilityState()});
const room=p=>({players:new Map([[p.id,p]]),planets:new Map()});

test('daily cutoffs pay once, deleted warnings still block, restart ledger and Friday card purchase stay single-use',()=>{
  const monday=Date.parse('2026-10-19T00:00:00Z'),week=constellationWeekStart(monday),p=player(5),r=room(p);
  const beforeMonday=week+DAY+14*HOUR;
  assert.equal(settleSwanDaily(r,beforeMonday).changed,true);
  assert.equal(swanDailyDue(r,beforeMonday),false);
  assert.equal(settleSwanDaily(r,week+DAY+15*HOUR).awards.length,1);
  assert.equal(p.starShards,11);
  assert.equal(settleSwanDaily(r,week+DAY+15*HOUR).changed,false);
  const warning={targetId:p.id,at:week+2*DAY+10*HOUR,active:false};
  r.planets.set('warning',{warnings:{entries:[warning]}});
  settleSwanDaily(r,week+2*DAY+15*HOUR);
  assert.equal(p.starShards,11);
  assert.equal(swanCardOffer(r,p,week+5*DAY),false);
  r.planets.clear();
  for(let day=3;day<=4;day++)settleSwanDaily(r,week+day*DAY+15*HOUR);
  const friday=week+5*DAY+15*HOUR;
  assert.equal(swanCardOffer(r,p,friday),true);
  assert.deepEqual(validateConstellationAbilityState(p.constellationAbilityState),p.constellationAbilityState);
  const initial=p.starShards;
  buySwanStarCard(r,p,friday);
  assert.equal(p.starShards,initial-4);
  assert.equal(p.inventory.find(item=>item.id==='star-card').quantity,1);
  assert.throws(()=>buySwanStarCard(r,p,friday));
  p.constellationAbilityState=structuredClone(validateConstellationAbilityState(p.constellationAbilityState));
  assert.equal(swanCardOffer(r,p,friday),false);
  assert.equal(SHARDS.max>=p.starShards&&SHOP.items.some(item=>item.id==='star-card'),true);
});

test('level 4 includes Friday; level 5 excludes it; changed zodiac week never pays',()=>{
  const week=constellationWeekStart(Date.parse('2026-10-19T00:00:00Z'));
  for(const level of [4,5]){
    const p=player(level),r=room(p);settleSwanDaily(r,week+DAY+14*HOUR);
    for(let day=1;day<=5;day++)settleSwanDaily(r,week+day*DAY+15*HOUR);
    assert.equal(p.starShards,10+(level===4?5:4));
  }
  const p=player(4),r=room(p);markConstellationChange(p,week+DAY);
  assert.equal(swanDailyDue(r,week+DAY+15*HOUR),false);
  assert.equal(settleSwanDaily(r,week+DAY+15*HOUR).changed,false);
  assert.equal(p.starShards,10);
});

test('compliment needs a real friend and campaign needs teacher approval; both survive restart',async t=>{
  const f=await readingFixture(t);
  f.mutate(p=>{p.avatar.constellationId='cygnus';p.avatar.level=2;p.starShards=10;});
  assert.equal((await call(f.student,'constellation-ability:use',{targetId:'missing',praiseIndex:0})).ok,false);
  assert.equal(ok(await call(f.student,'constellation-ability:use',{targetId:f.q.id,praiseIndex:1})).reward,1);
  f.advance(2000);
  assert.equal(ok(await call(f.student,'constellation-ability:use',{targetId:f.q.id,praiseIndex:2})).used,true);
  assert.equal((await call(f.student,'constellation-ability:use',{targetId:f.q.id,praiseIndex:0})).ok,false);
  assert.equal(f.p.starShards,12);
  await f.restart();
  assert.equal(ok(await call(f.student,'constellation-ability:status')).uses,2);
  f.mutate(p=>{p.avatar.level=3;p.constellationAbilityState=freshConstellationAbilityState();});
  assert.equal((await call(f.student,'constellation-ability:use',{campaignText:'\u0000bad'})).ok,false);
  assert.equal((await call(f.student,'constellation-ability:use',{campaignText:'🌟'.repeat(41)})).ok,false);
  assert.equal(f.p.constellationAbilityState.usedWeek,null);
  ok(await call(f.student,'constellation-ability:use',{campaignText:'서로 먼저 인사해요'}));
  assert.equal(f.p.starShards,12);
  assert.equal(f.room.players.get(f.p.id).constellationAbilityState.lastResult.approvedAt,null);
  assert.equal(f.game.store.snapshot(f.room,f.q,f.now).campaignRequests,undefined);
  assert.equal(f.game.store.snapshot(f.room,f.teacherPlayer,f.now).campaignRequests.length,1);
  assert.equal(swanCampaignSigns(f.room,f.now).length,0);
  assert.equal((await call(f.student,'constellation-ability:swan-campaign-approve',{playerId:f.p.id})).ok,false);
  await f.fail(async()=>assert.equal((await call(f.teacher,'constellation-ability:swan-campaign-approve',{playerId:f.p.id})).ok,false));
  assert.equal(f.p.starShards,12);
  ok(await call(f.teacher,'constellation-ability:swan-campaign-approve',{playerId:f.p.id}));
  assert.equal(f.p.starShards,15);
  assert.equal(swanCampaignSigns(f.room,f.now).length,1);
  assert.equal((await call(f.teacher,'constellation-ability:swan-campaign-approve',{playerId:f.p.id})).ok,false);
  await f.restart();
  assert.equal(swanCampaignSigns(f.room,f.now).length,1);
});
