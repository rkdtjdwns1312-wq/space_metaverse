import test from 'node:test';
import assert from 'node:assert/strict';
import {refreshTruthRecord} from '../server/truth-record.js';
import {EQUIPMENT_ITEMS,equipmentBonus} from '../shared/equipment.js';
import {PUBLIC_CRAFTING_RECIPES} from '../shared/crafting.js';
import {attemptCraft} from '../server/crafting.js';

test('진리의 기록은 공개 조합법으로 재료1·우주에너지15000을 정확히 차감한다',()=>{
  assert.ok(EQUIPMENT_ITEMS.some(item=>item.id==='truth-record'&&item.level===5&&item.bonus.attack===3));
  assert.ok(PUBLIC_CRAFTING_RECIPES.some(recipe=>recipe.output.id==='truth-record'));
  const player={role:'student',starShards:0,cosmicEnergy:14999,inventory:[{id:'origin-star-record',quantity:1}],equipmentSlots:[null,null,null]};
  assert.equal(attemptCraft(player,[{id:'origin-star-record',quantity:1}]).error,'insufficient-energy');
  assert.equal(player.inventory[0].quantity,1);assert.equal(player.cosmicEnergy,14999);
  player.cosmicEnergy=15000;
  const result=attemptCraft(player,[{id:'origin-star-record',quantity:1}]);
  assert.equal(result.success,true);assert.equal(player.cosmicEnergy,0);
  assert.deepEqual(player.inventory,[{id:'truth-record',quantity:1}]);
  player.equipmentSlots[0]='truth-record';assert.equal(equipmentBonus(player).attack,3);
});

test('진리의 기록은 성공한 E에 한 번만 확률을 굴리고 사용한 스킬의 쿨타임만 초기화한다',()=>{
  for(const id of ['aquarius','corvus','cancer','cetus','pisces','cygnus','ophiuchus','gemini','aries','taurus','hercules','libra','corona-borealis','capricorn','leo','sagittarius']){
    const player={role:'student',avatar:{constellationId:id},equipmentSlots:['truth-record'],aquariusCooldownUntil:5000,sagittariusCooldowns:{0:5000}};
    const result={ready:true,cooldowns:{0:5000}};
    assert.equal(refreshTruthRecord(player,result,'skill',1000,()=>.5).cooldownReset,undefined,id+' 실패 확률');
    assert.equal(refreshTruthRecord(player,result,'skill',1000,()=>0).cooldownReset,true,id+' 성공 확률');
    if(id!=='cygnus')assert.equal(refreshTruthRecord(player,result,'skill',1000,()=>0).cooldowns[0],1000);
  }
  const noItem={role:'student',avatar:{constellationId:'aquarius'},equipmentSlots:[]};
  assert.equal(refreshTruthRecord(noItem,{ready:true},'skill',1000,()=>0).cooldownReset,undefined);
  assert.equal(refreshTruthRecord({...noItem,equipmentSlots:['truth-record']},{ready:false},'skill',1000,()=>0).cooldownReset,undefined);
});

test('백조자리 지속 시간이 끝나면 초기화된 쿨타임을 적용하고, 초월 중 재변신은 막는다',()=>{
  const swan={role:'student',avatar:{constellationId:'cygnus'},equipmentSlots:['truth-record'],swanAura:{endsAt:6000,cooldownMs:10000}};
  const result=refreshTruthRecord(swan,{ready:true,cooldowns:{0:6000}},'skill',1000,()=>0);
  assert.equal(result.cooldownReset,true);assert.equal(swan.swanAura.cooldownMs,0);
  const transformed={role:'student',equipmentSlots:['truth-record'],transformation:{active:true,endsAt:30000,cooldownUntil:120000}};
  assert.equal(refreshTruthRecord(transformed,{...transformed.transformation},'transform',1000,()=>0).cooldownUntil,1000);
});
