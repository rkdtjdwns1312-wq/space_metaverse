import test from 'node:test';
import assert from 'node:assert/strict';
import {readingFixture,call,ok} from './helpers/reading-fixture.js';
import {freshConstellationAbilityState,validateConstellationAbilityState,constellationAbilityStatus} from '../server/constellation-weekly-abilities.js';
import {useCoronaWeekly,coronaDue,settleCorona} from '../server/corona-weekly.js';
import {constellationWeekStart} from '../shared/constellation-weekly-abilities.js';
import {attemptCraft} from '../server/crafting.js';
import {EQUIPMENT_ITEMS} from '../shared/equipment.js';
import {SHARDS} from '../shared/config.js';
import {MARKET} from '../shared/market.js';

const DAY=86400000;
const make=level=>({id:'c',role:'student',connected:true,away:false,avatar:{constellationId:'corona-borealis',level,xp:7,form:'constellation'},equipmentSlots:[null,null,null],inventory:[],starShards:10,constellationAbilityState:freshConstellationAbilityState()});
const room=p=>({players:new Map([[p.id,p]])});
const monday=Date.parse('2026-10-19T00:00:00Z');

test('Lv2/3 period cards expire together, remain separate from originals, and cannot be crafted',()=>{
  for(const level of [2,3]){
    const p=make(level),r=room(p),now=monday;
    p.inventory=[{id:'space-food-card',quantity:1}];
    const result=useCoronaWeekly(p,undefined,now);
    assert.equal(result.expiresAt,now+DAY);
    assert.equal(p.inventory.find(item=>item.id==='space-food-card').quantity,1);
    assert.equal(p.inventory.find(item=>item.id==='crown-food-card').expiresAt,now+DAY);
    assert.equal(p.inventory.some(item=>item.id==='crown-suit-card'),level===3);
    assert.deepEqual(validateConstellationAbilityState(p.constellationAbilityState),p.constellationAbilityState);
    assert.equal(attemptCraft(p,[{id:'crown-food-card',quantity:1}]).error,'unknown-ingredient');
    assert.equal(coronaDue(r,now+DAY),true);
    assert.equal(settleCorona(r,now+DAY),true);
    assert.equal(p.inventory.length,1);
    assert.equal(settleCorona(r,now+DAY),false);
  }
});

test('Lv4 two-card choice ends at Sunday or five days, whichever comes first',()=>{
  const week=constellationWeekStart(monday);
  for(const now of [week+DAY,week+5*DAY]){
    const p=make(4),r=room(p),result=useCoronaWeekly(p,'both',now);
    assert.equal(result.expiresAt,Math.min(now+5*DAY,week+7*DAY));
    assert.deepEqual(p.inventory.map(i=>i.quantity),[2,2]);
    assert.equal(settleCorona(r,result.expiresAt-1),false);
    assert.equal(settleCorona(r,result.expiresAt),true);
    assert.equal(p.inventory.length,0);
  }
});

test('Lv4 trial preserves equipment and XP, restores Monday only once, and retains full-wallet reward',()=>{
  const p=make(4),r=room(p),equipment=EQUIPMENT_ITEMS.find(item=>item.level<=4);
  p.equipmentSlots=[equipment.id,null,null];p.starShards=SHARDS.max-2;
  const week=constellationWeekStart(monday),result=useCoronaWeekly(p,'trial',monday);
  assert.equal(result.expiresAt,week+8*DAY);
  assert.equal(p.avatar.level,1);assert.deepEqual(p.equipmentSlots,[null,null,null]);
  p.avatar.xp=3;
  assert.equal(settleCorona(r,result.expiresAt-1),false);
  assert.equal(settleCorona(r,result.expiresAt),true);
  assert.equal(p.avatar.level,4);assert.equal(p.avatar.xp,15);
  assert.deepEqual(p.equipmentSlots,[equipment.id,null,null]);
  assert.equal(p.starShards,SHARDS.max);assert.equal(p.constellationAbilityState.coronaUnclaimed,3);
  assert.equal(settleCorona(r,result.expiresAt),false);
  p.starShards-=3;assert.equal(settleCorona(r,result.expiresAt+1000),true);
  assert.equal(p.starShards,SHARDS.max);assert.equal(p.constellationAbilityState.coronaUnclaimed,0);
});

test('a later trial keeps star shards deferred by the full-wallet limit',()=>{
  const p=make(4),r=room(p),first=useCoronaWeekly(p,'trial',monday);
  p.starShards=SHARDS.max;
  settleCorona(r,first.expiresAt);
  assert.equal(p.constellationAbilityState.coronaUnclaimed,5);
  const second=useCoronaWeekly(p,'trial',first.expiresAt+DAY);
  assert.equal(p.constellationAbilityState.coronaUnclaimed,5);
  settleCorona(r,second.expiresAt);
  assert.equal(p.constellationAbilityState.coronaUnclaimed,10);
});

test('cards left from Saturday cannot acquire a new expiry on Sunday',()=>{
  const p=make(2),r=room(p),saturday=constellationWeekStart(monday)+6*DAY+18*3600000;
  const first=useCoronaWeekly(p,undefined,saturday);
  assert.throws(()=>useCoronaWeekly(p,undefined,saturday+6*3600000),/남아/);
  assert.equal(p.inventory[0].expiresAt,first.expiresAt);
  settleCorona(r,first.expiresAt);
  assert.equal(p.inventory.length,0);
  assert.doesNotThrow(()=>useCoronaWeekly(p,undefined,first.expiresAt));
});

test('Lv5 priority is passive and teachers alone can use the roster',()=>{
  const p=make(5),status=constellationAbilityStatus(p,monday);
  assert.equal(status.passive,true);assert.equal(status.canUse,false);
  assert.throws(()=>useCoronaWeekly(p,'both',monday));
});

test('socket use, failed-save rollback, expiry and restart keep crown rewards single-use',async t=>{
  const f=await readingFixture(t);
  f.mutate(p=>{p.avatar.constellationId='corona-borealis';p.avatar.level=4;p.avatar.xp=6;p.starShards=10;});
  assert.equal((await call(f.student,'constellation-ability:use',{choice:'invalid'})).ok,false);
  await f.fail(async()=>assert.equal((await call(f.student,'constellation-ability:use',{choice:'both'})).ok,false));
  assert.equal(f.p.inventory.some(i=>i.id==='crown-food-card'),false);
  ok(await call(f.student,'constellation-ability:use',{choice:'both'}));
  assert.equal((await call(f.student,'constellation-ability:use',{choice:'trial'})).ok,false);
  assert.equal((await call(f.student,'shop:sell',{itemId:'crown-food-card',quantity:1})).ok,false);
  await f.restart();
  assert.equal(f.p.inventory.find(i=>i.id==='crown-food-card')?.quantity,2);
  const expiresAt=f.p.inventory.find(i=>i.id==='crown-food-card').expiresAt;
  f.mutate(p=>{for(const member of [p,f.q])Object.assign(member,{mapId:'space-plaza',x:MARKET.x,y:MARKET.y,input:{x:0,y:0,at:0}});});
  const proposed=ok(await call(f.student,'trade:propose',{targetId:f.q.id}));
  ok(await call(f.other,'trade:respond',{tradeId:proposed.tradeId,accept:true}));
  ok(await call(f.student,'trade:offer',{tradeId:proposed.tradeId,revision:0,offer:{shards:1,energy:0,items:[]}}));
  ok(await call(f.other,'trade:offer',{tradeId:proposed.tradeId,revision:1,offer:{shards:0,energy:0,items:[]}}));
  ok(await call(f.student,'trade:confirm',{tradeId:proposed.tradeId,revision:2}));
  ok(await call(f.other,'trade:confirm',{tradeId:proposed.tradeId,revision:2}));
  assert.equal(f.p.inventory.find(i=>i.id==='crown-food-card')?.expiresAt,expiresAt);
  await f.restart();
  assert.equal(f.p.inventory.find(i=>i.id==='crown-food-card')?.expiresAt,expiresAt);
  f.advance(expiresAt-f.now);
  assert.equal((await call(f.student,'item:use',{itemId:'crown-food-card',targetId:f.p.id})).ok,false);
});
