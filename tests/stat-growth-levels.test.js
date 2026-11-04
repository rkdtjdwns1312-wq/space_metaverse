import test from 'node:test';
import assert from 'node:assert/strict';
import {buyStatGrowth,statGrowthInfo,validateStatGrowth} from '../server/stat-growth.js';
import {vitalsOf} from '../shared/vitals.js';
import {attackPowerOf,defensePowerOf} from '../shared/combat.js';
const now=Date.parse('2026-11-03T14:59:59Z');
const expected={2:{cost:20,weights:[45,45,5,5],amounts:[1,1,1,1]},3:{cost:60,weights:[40,40,15,5],amounts:[1,1,1,1]},4:{cost:140,weights:[40,40,10,10],amounts:[2,2,1,1]},5:{cost:300,weights:[35,35,20,10],amounts:[3,3,2,1]}};
const keys=['hp','mp','attack','defense'];
const player=(level=2)=>({role:'student',cosmicEnergy:1000,avatar:{level,constellationId:'sagittarius'},statGrowth:{bonuses:{hp:7,mp:8,attack:9,defense:10},lastPurchaseDay:null}});
for(const level of [2,3,4,5])test(`Lv${level}: all 100 draws have exact probabilities, amounts, cost and combat application`,()=>{
 const rule=expected[level],counts=[0,0,0,0];
 for(let roll=0;roll<100;roll++){
  const p=player(level),old=structuredClone(p.statGrowth.bonuses),v=vitalsOf(level,p),atk=attackPowerOf(level,'sagittarius',p),def=defensePowerOf(level,'sagittarius',p),info=statGrowthInfo(p,now);
  assert.deepEqual(keys.map(k=>info.weights[k]),rule.weights);assert.deepEqual(keys.map(k=>info.amounts[k]),rule.amounts);assert.equal(info.cost,rule.cost);
  const result=buyStatGrowth(p,now,()=>roll),index=keys.indexOf(result.stat),amount=rule.amounts[index];counts[index]++;
  assert.equal(p.cosmicEnergy,1000-rule.cost);assert.equal(result.amount,amount);assert.match(result.message,new RegExp(`영구적으로 ${amount} 올랐어요`));
  for(const k of keys)assert.equal(p.statGrowth.bonuses[k],old[k]+(k===result.stat?amount:0));
  assert.equal(vitalsOf(level,p).hp.max,v.hp.max+(result.stat==='hp'?amount:0));assert.equal(vitalsOf(level,p).mp.max,v.mp.max+(result.stat==='mp'?amount:0));
  assert.equal(attackPowerOf(level,'sagittarius',p),atk+(result.stat==='attack'?amount:0));assert.equal(defensePowerOf(level,'sagittarius',p),def+(result.stat==='defense'?amount:0));
 }
 assert.deepEqual(counts,rule.weights);
});
test('one KST daily purchase survives evolution, old balances and JSON reload; next day uses current level',()=>{
 const p=player();buyStatGrowth(p,now,()=>0);p.avatar.level=5;const saved=structuredClone(p);assert.equal(statGrowthInfo(p,now).canBuy,false);assert.throws(()=>buyStatGrowth(p,now,()=>0),/이미/);assert.deepEqual(p,saved);
 const restored=JSON.parse(JSON.stringify(p));restored.statGrowth=validateStatGrowth(restored.statGrowth);const next=buyStatGrowth(restored,now+1000,()=>70);assert.equal(next.stat,'attack');assert.equal(next.amount,2);assert.equal(next.cost,300);assert.equal(restored.statGrowth.bonuses.hp,8);assert.equal(restored.statGrowth.bonuses.attack,11);assert.equal(statGrowthInfo(restored,now).canBuy,false);
});
test('invalid level, insufficient funds, bad RNG and multi-point cap overflow leave all state untouched',()=>{
 for(const level of [undefined,null,1,0,6,2.5,'2']){const p=player(level);p.avatar.level=level;const old=structuredClone(p);assert.equal(statGrowthInfo(p,now).canBuy,false);assert.throws(()=>buyStatGrowth(p,now),/Lv2/);assert.deepEqual(p,old);}
 for(const level of [2,3,4,5]){const p=player(level);p.cosmicEnergy=expected[level].cost-1;const old=structuredClone(p);assert.throws(()=>buyStatGrowth(p,now),new RegExp(` ${expected[level].cost}개`));assert.deepEqual(p,old);}
 for(const draw of [()=>-1,()=>100,()=>NaN,()=>.5,()=>{throw Error('rng');}]){const p=player(),old=structuredClone(p);assert.throws(()=>buyStatGrowth(p,now,draw));assert.deepEqual(p,old);}
 const p=player(5);p.statGrowth.bonuses.hp=999998;const old=structuredClone(p);assert.throws(()=>buyStatGrowth(p,now,()=>0),/더 올릴/);assert.deepEqual(p,old);p.statGrowth.bonuses.hp=999997;buyStatGrowth(p,now,()=>0);assert.equal(p.statGrowth.bonuses.hp,1000000);
});
test('master keeps free purchases with current level amounts and shared daily limit',()=>{
 for(const level of [2,3,4,5]){const p={...player(level),accountKind:'master',cosmicEnergy:0};const r=buyStatGrowth(p,now,()=>0);assert.equal(r.cost,0);assert.equal(r.amount,expected[level].amounts[0]);assert.equal(p.cosmicEnergy,0);assert.throws(()=>buyStatGrowth(p,now,()=>0),/이미/);}
 assert.throws(()=>buyStatGrowth({...player(),role:'teacher'},now),/학생만/);
});
