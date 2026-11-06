import test from 'node:test';
import assert from 'node:assert/strict';
import {equipmentOf,equipmentBonus,equipmentAuraOf,enhancementInfo,validateEquipmentSlots,equipmentStatText} from '../shared/equipment.js';
import {enhanceEquipment} from '../server/equipment-enhancement.js';
import {equip,unequip} from '../server/equipment.js';
import {bossItemEvidence} from '../shared/boss-item-evidence.js';
import {advancePassiveRecovery} from '../server/passive-recovery.js';
import {ensureVitals} from '../server/vitals.js';
import {gainInfiniteEnergy} from '../server/infinite-energy.js';
import {infiniteEnergyStacks} from '../shared/infinite-energy.js';
import {refreshTruthRecord} from '../server/truth-record.js';
import {SHOP,STREET} from '../shared/config.js';
import {readingFixture,call,ok} from './helpers/reading-fixture.js';
const player=(id='sun-ring',quantity=1)=>({role:'student',avatar:{level:5,constellationId:'hercules'},connected:true,inventory:[{id,quantity},{id:'leoon-claw',quantity:10}],equipmentSlots:[null,null,null],starShards:8,cosmicEnergy:900});

test('all enhancement stages have cumulative bonuses and correct chance boundaries',()=>{
 for(let stage=0;stage<=9;stage++){
  const id=base=>base+(stage?'+'+stage:'');
  const sun=equipmentOf(id('sun-ring')).bonus,moon=equipmentOf(id('moon-earring')).bonus,ice=equipmentOf(id('burning-ice-necklace')).bonus;
  assert.equal(sun.attack,3+Math.floor(stage/3));assert.equal(sun.hp||0,stage);assert.equal(sun.skillDamage||0,[0,0,0,0,0,0,0,.05,.15,.30][stage]);
  assert.equal(moon.mp,10+stage);assert.equal(moon.mpRegen||0,Math.floor(stage/3));assert.equal(moon.cooldownReduction,.3);assert.equal(moon.attack||0,Math.max(0,stage-6));
  assert.equal(ice.hp||0,Math.ceil(stage/2));assert.equal(ice.mp||0,Math.floor(stage/2));assert.equal(ice.skillDamage,[.20,.20,.20,.25,.29,.34,.45,.52,.60,.74][stage]);
  const cloak=equipmentOf(id('spirit-king-cloak')).bonus,gem=equipmentOf(id('primordial-star-gem')).bonus;
  const cloakVitality=[0,1,2,3,5,7,9,12,15,18][stage];
  assert.equal(cloak.hp,20+cloakVitality);assert.equal(cloak.mp,20+cloakVitality);
  assert.equal(cloak.attack,[3,3,3,3,3,3,3,4,5,7][stage]);assert.equal(cloak.defense,[2,2,2,2,2,2,2,2,3,4][stage]);
  assert.equal(gem.hpRegen,5);assert.equal(gem.mpRegen,3+Math.floor(stage/3));assert.equal(gem.skillDamage,(50+Math.ceil(stage/2)*5)/100);assert.equal(gem.manaCostIncrease,(100-Math.floor(stage/2)*10)/100);
  const convergence=equipmentOf(id('truth-convergence')).bonus;assert.equal(convergence.hp,10+stage);assert.equal(convergence.mp,10+stage);assert.equal(convergence.skillDamage,(50+[0,10,30,60][Math.floor(stage/3)])/100);assert.equal(convergence.cooldownReduction,.5);
  const sigil=equipmentOf(id('primordial-star-sigil'));assert.equal(sigil.bonus.defense,2+Math.floor(stage/3));assert.equal(sigil.sigilDamageFactor,[2.5,3,3.5,4,5,6,7,8.5,10,11.5][stage]);
  const bracelet=equipmentOf(id('infinite-star-bracelet')),record=equipmentOf(id('truth-record'));
  assert.equal(bracelet.infiniteMaxStacks,3+Math.ceil(stage/2));assert.equal(bracelet.infiniteDurationMs,5000+Math.floor(stage/2)*1000);
  assert.equal(record.cooldownResetChance,(40+Math.min(stage,6)*5)/100);assert.equal(record.bonus.attack,3+[0,1,3,6][Math.max(0,stage-6)]);
  const info=enhancementInfo(id('sun-ring'));assert.equal(info.stage,stage);assert.equal(info.chance,stage===9?0:(100-stage*10)/100);
  if(stage===9){assert.equal(info.nextStage,null);continue;}
  const p=player(id('sun-ring'),2),before=p.inventory[1].quantity;
  const result=enhanceEquipment(p,{itemId:id('sun-ring'),materialId:'leoon-claw'},{draw:()=>info.chance-0.0001});
  assert.equal(result.success,true);assert.equal(result.stage,stage+1);assert.equal(p.inventory.find(e=>e.id===id('sun-ring')).quantity,1);assert.equal(p.inventory.find(e=>e.id===info.nextItemId).quantity,1);assert.equal(p.inventory.find(e=>e.id==='leoon-claw').quantity,before-1);
  if(stage){const q=player(id('sun-ring'));const r=enhanceEquipment(q,{itemId:id('sun-ring'),materialId:'leoon-claw'},{draw:()=>info.chance});assert.equal(r.success,false);assert.equal(r.stage,stage);assert.equal(q.inventory[0].id,id('sun-ring'));assert.equal(q.inventory[1].quantity,9);assert.equal(q.starShards,8);assert.equal(q.cosmicEnergy,900);}
 }
 for(const id of ['sun-ring+0','sun-ring+10','sun-ring+01','comet-compass+1','sun-ring+1+1'])assert.equal(equipmentOf(id),null);
});
test('enhancement rejects invalid/full states atomically and accepts either necklace material',()=>{
 for(const [id,material] of [['sun-ring+9','leoon-claw'],['comet-compass','black-gem'],['sun-ring','noksera-horn']]){
  const p=player(id),before=structuredClone(p);assert.throws(()=>enhanceEquipment(p,{itemId:id,materialId:material}));assert.deepEqual(p,before);
 }
 const worn=player();worn.inventory.shift();worn.equipmentSlots[0]='sun-ring';assert.throws(()=>enhanceEquipment(worn,{itemId:'sun-ring',materialId:'leoon-claw'}),/해제/);
 const full=player('sun-ring',2);while(full.inventory.length<SHOP.maxKinds)full.inventory.push({id:'filler-'+full.inventory.length,quantity:1});const before=structuredClone(full);assert.throws(()=>enhanceEquipment(full,{itemId:'sun-ring',materialId:'leoon-claw'}),/빈칸/);assert.deepEqual(full,before);
 for(const materialId of ['leoon-claw','noksera-horn']){const p=player('burning-ice-necklace');p.inventory[1]={id:materialId,quantity:1};const r=enhanceEquipment(p,{itemId:'burning-ice-necklace',materialId});assert.equal(r.itemId,'burning-ice-necklace+1');assert.equal(p.inventory.length,1);}
});
test('enhanced bracelet stacks/duration and truth-record reset chance apply to real effects',()=>{
 for(let stage=0;stage<=9;stage++){
  const p=player();p.equipmentSlots=['infinite-star-bracelet'+(stage?'+'+stage:'')];
  for(let i=0;i<20;i++)gainInfiniteEnergy(p,1000);
  const expiry=6000+Math.floor(stage/2)*1000;
  assert.equal(infiniteEnergyStacks(p,expiry-1),3+Math.ceil(stage/2));assert.equal(infiniteEnergyStacks(p,expiry),0);
  p.inventory=[];p.equipmentSlots.push(null,null);unequip(p,1);assert.equal(p.infiniteEnergy,undefined);
  p.equipmentSlots=['truth-record'+(stage?'+'+stage:'')];p.avatar.constellationId='aquarius';
  const chance=(40+Math.min(stage,6)*5)/100;
  assert.equal(refreshTruthRecord(p,{ready:true},'skill',1000,()=>chance-.0001).cooldownReset,true);
  assert.equal(refreshTruthRecord(p,{ready:true},'skill',1000,()=>chance).cooldownReset,undefined);
 }
});
test('enhanced gear equips, preserves boss evidence/aura, and adds ten-second mana regeneration',()=>{
 const p=player('moon-earring+9');p.inventory.push({id:'moon-earring',quantity:1});equip(p,'moon-earring+9',1);
 assert.throws(()=>equip(p,'moon-earring',2),/같은 장비/);assert.throws(()=>validateEquipmentSlots(['moon-earring','moon-earring+1',null]));
 assert.equal(equipmentBonus(p).mpRegen,3);assert.deepEqual(bossItemEvidence({...p,inventory:[]}),['noksera']);assert.match(equipmentStatText(equipmentOf('moon-earring+9')),/10초마다 마나 회복 \+3/);
 const room={players:new Map([['p',p]])},v=ensureVitals(p);v.mp=0;advancePassiveRecovery(room,1000);advancePassiveRecovery(room,10999);assert.equal(v.mp,0);advancePassiveRecovery(room,11000);assert.equal(v.mp,5);
 unequip(p,1);assert.ok(p.inventory.some(e=>e.id==='moon-earring+9'));
 assert.equal(equipmentAuraOf({equipmentSlots:['spirit-king-cloak+3','primordial-star-gem+9']}),'rainbow');
});
test('enhancement socket guards distance, duplicate requests, disk failure and persistence',async t=>{
 const f=await readingFixture(t,{craftingRecipes:[]}),machine=STREET.objects.find(o=>o.kind==='crafting');
 const at=()=>Object.assign(f.p,{mapId:STREET.id,x:machine.x,y:machine.y+80,input:{x:0,y:0,at:0}});
 f.mutate(p=>Object.assign(p,{avatar:{...p.avatar,level:5},inventory:[{id:'sun-ring',quantity:2},{id:'leoon-claw',quantity:5}],starShards:8,cosmicEnergy:900}));at();
 let token=ok(await call(f.student,'crafting:open')).enhancementToken;
 f.p.x=0;f.p.y=0;assert.equal((await call(f.student,'crafting:enhance',{itemId:'sun-ring',materialId:'leoon-claw',enhancementToken:token})).ok,false);at();
 await f.fail(async()=>{assert.equal((await call(f.student,'crafting:enhance',{itemId:'sun-ring',materialId:'leoon-claw',enhancementToken:token})).ok,false);});
 assert.deepEqual(f.p.inventory,[{id:'sun-ring',quantity:2},{id:'leoon-claw',quantity:5}]);at();
 const input={itemId:'sun-ring',materialId:'leoon-claw',enhancementToken:token};
 const results=await Promise.all([call(f.student,'crafting:enhance',input),call(f.student,'crafting:enhance',input)]);assert.equal(results.filter(r=>r.ok).length,1);const result=results.find(r=>r.ok);assert.equal(result.stage,1);assert.notEqual(result.enhancementToken,token);assert.equal(f.p.inventory.find(e=>e.id==='leoon-claw').quantity,4);
 ok(await call(f.student,'equipment:equip',{itemId:'sun-ring+1',slot:1}));await f.restart();
 assert.deepEqual(f.p.equipmentSlots,['sun-ring+1',null,null]);assert.equal(f.p.inventory.find(e=>e.id==='sun-ring').quantity,1);assert.equal(f.p.inventory.find(e=>e.id==='leoon-claw').quantity,4);assert.equal(f.p.starShards,8);assert.equal(f.p.cosmicEnergy,900);
 at();assert.equal((await call(f.student,'crafting:enhance',{...input,enhancementToken:result.enhancementToken})).ok,false);
});
