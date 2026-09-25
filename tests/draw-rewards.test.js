import test from 'node:test';
import assert from 'node:assert/strict';
import {createRabbitDraw,rabbitDrawView,validateRabbitDraw,RABBIT_DRAW_CATALOG} from '../server/rabbit-draw.js';
import {awardDrawReward} from '../server/draw-rewards.js';

const player=()=>({starShards:0,inventory:[],avatar:{level:1,xp:0,form:'asteroid'}});
test('new rabbit draw is an exact shuffled 54-card multiset and view does not peek',()=>{
  const draw=createRabbitDraw(1),view=rabbitDrawView(draw);
  assert.equal(draw.cards.length,54); assert.equal(RABBIT_DRAW_CATALOG.length,54);
  assert.deepEqual(draw.cards.map(c=>JSON.stringify(c.reward)).sort(),RABBIT_DRAW_CATALOG.map(JSON.stringify).sort());
  assert.deepEqual(view,{id:draw.id,count:54});
});
test('old numeric ten-card draws remain valid and new draws validate after cloning',()=>{
  const old={id:'old',startedAt:1,markerId:'m',cards:Array.from({length:10},(_,i)=>({id:'c'+i,reward:i+1}))};
  assert.deepEqual(validateRabbitDraw(old),old); assert.equal(validateRabbitDraw(createRabbitDraw()).cards.length,54);
});
test('tampered new draw is rejected',()=>{
  const draw=createRabbitDraw(); draw.cards[0].reward={kind:'shards',amount:999};
  assert.throws(()=>validateRabbitDraw(draw));
});
test('draw reward validates capacity before mutating and applies XP overflow as shards',()=>{
  const p=player(); p.avatar={level:5,xp:0,form:'transcendent'}; p.starShards=9999;
  assert.throws(()=>awardDrawReward(p,{kind:'xp',amount:10,name:'과다 성장'}));
  assert.equal(p.starShards,9999); assert.equal(p.avatar.xp,0); assert.deepEqual(p.inventory,[]);
  const q=player(); q.avatar={level:5,xp:0,form:'transcendent'};
  const result=awardDrawReward(q,{kind:'xp',amount:10,name:'과다 성장'});
  assert.equal(q.avatar.xp,0); assert.equal(q.starShards,10); assert.equal(result.deltas.shards,10);
});
test('item reward respects stack and forty-slot limits atomically',()=>{
  const p=player(); p.inventory=[{id:'space-food-card',quantity:99}];
  assert.throws(()=>awardDrawReward(p,{kind:'item',amount:1,itemId:'space-food-card',name:'우주 식량'}));
  assert.equal(p.inventory[0].quantity,99);
  const full=player(); full.inventory=Array.from({length:40},(_,i)=>({id:'x'+i,quantity:1}));
  assert.throws(()=>awardDrawReward(full,{kind:'item',amount:1,itemId:'space-food-card',name:'우주 식량'}));
  assert.equal(full.inventory.length,40);
});
