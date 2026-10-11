import test from 'node:test';
import assert from 'node:assert/strict';
import {buyEquipment,equip,unequip} from '../server/equipment.js';
import {EQUIPMENT_ITEMS,equipmentBonus,validateEquipmentSlots} from '../shared/equipment.js';
import {attackPowerOf,defensePowerOf} from '../shared/combat.js';
import {vitalsOf} from '../shared/vitals.js';

const player=()=>({role:'student',avatar:{level:3,constellationId:'aquarius'},inventory:[],equipmentSlots:[null,null,null],cosmicEnergy:1000});
test('LV4 구매는 5000 경계를 지키고 조합 전용 장비는 기존 보유 ID로 새 능력을 적용한다',()=>{
  const p=player();p.avatar.level=4;p.cosmicEnergy=4999;
  for(const id of ['celestial-crown','aurora-scabbard','starlight-guardian-stone']){
    assert.throws(()=>buyEquipment(p,id),/부족/);assert.equal(p.cosmicEnergy,4999);
  }
  p.cosmicEnergy=5000;buyEquipment(p,'celestial-crown');assert.equal(p.cosmicEnergy,0);
  equip(p,'celestial-crown',1);assert.equal(equipmentBonus(p).hp,20);assert.equal(equipmentBonus(p).defense,0);
  for(const id of ['sun-ring','moon-earring','burning-ice-necklace']){
    assert.throws(()=>buyEquipment(p,id),/상점의 물건/);
    p.inventory.push({id,quantity:1});
  }
  equip(p,'sun-ring',1);equip(p,'moon-earring',2);equip(p,'burning-ice-necklace',3);
  const bonus=equipmentBonus(p);
  assert.equal(EQUIPMENT_ITEMS.find(i=>i.id==='sun-ring').name,'따뜻한 반지');
  assert.equal(bonus.attack,4);assert.equal(bonus.mp,10);assert.equal(bonus.hp,0);assert.equal(bonus.defense,0);
  assert.equal(bonus.durationMs,2000);assert.equal(bonus.skillDamage,.3);assert.equal(bonus.cooldownReduction,.3);
});
test('구매·세 칸 장착·교체·해제는 장비를 가방과 한 곳에만 보관한다',()=>{
  const p=player();buyEquipment(p,'azure-starblade');buyEquipment(p,'silver-shield');
  assert.equal(p.cosmicEnergy,200);assert.equal(p.inventory.length,2);
  equip(p,'azure-starblade',1);equip(p,'silver-shield',2);
  assert.equal(p.inventory.length,0);assert.deepEqual(p.equipmentSlots,['azure-starblade','silver-shield',null]);
  assert.equal(attackPowerOf(3,'aquarius',p),7);assert.equal(defensePowerOf(3,'aquarius',p),2);
  assert.throws(()=>equip(p,'azure-starblade',3),/가방|같은/);
  unequip(p,1);assert.equal(p.inventory.find(i=>i.id==='azure-starblade').quantity,1);
  assert.equal(attackPowerOf(3,'aquarius',p),6);
  assert.deepEqual(validateEquipmentSlots(undefined),[null,null,null]);
});
test('부족한 재화·레벨·칸·가방 상한은 구매·장착·해제 상태를 바꾸지 않는다',()=>{
  const p=player();p.cosmicEnergy=1;
  assert.throws(()=>buyEquipment(p,'comet-compass'),/부족/);
  assert.throws(()=>buyEquipment(p,'celestial-crown'),/LV4/);
  assert.deepEqual([p.cosmicEnergy,p.inventory.length],[1,0]);
  p.inventory.push({id:'lake-brooch',quantity:1});
  assert.throws(()=>equip(p,'lake-brooch',0),/칸/);
  assert.equal(p.inventory[0].quantity,1);
  equip(p,'lake-brooch',1);assert.equal(vitalsOf(3,p).hp.max,50);
  assert.equal(equipmentBonus(p).hp,10);
  p.inventory=Array.from({length:60},(_,i)=>({id:'filler-'+i,quantity:1}));
  assert.throws(()=>unequip(p,1),/가방/);assert.equal(p.equipmentSlots[0],'lake-brooch');
  assert.throws(()=>validateEquipmentSlots(['lake-brooch','lake-brooch',null]),/올바르지/);
});

test('추가 장비는 단계별 수량·구매 가능 여부를 지키고 성령왕 망토는 조합 전용이다',()=>{
  const counts=[1,2,3,4].map(level=>EQUIPMENT_ITEMS.filter(item=>item.level===level&&!item.craftOnly).length);
  assert.deepEqual(counts,[6,6,5,3]);
  const cloak=EQUIPMENT_ITEMS.find(item=>item.id==='spirit-king-cloak');
  assert.equal(cloak.level,5);assert.equal(cloak.craftOnly,true);assert.equal(cloak.price,null);
  const p=player();p.avatar.level=5;p.cosmicEnergy=20000;
  assert.throws(()=>buyEquipment(p,'spirit-king-cloak'),/상점의 물건/);
  p.inventory.push({id:'spirit-king-cloak',quantity:1});
  equip(p,'spirit-king-cloak',1);
  assert.equal(equipmentBonus(p).hp,30);
  assert.equal(equipmentBonus(p).attack,5);
  assert.equal(equipmentBonus(p).defense,3);
  assert.equal(equipmentBonus(p).mp,30);
  assert.equal(equipmentBonus(p).speed,0);
  assert.equal(equipmentBonus(p).regen,0);
});

test('LV1 장비 6종은 새 가격과 장착 능력치를 가지며 합계에는 장착 효과만 반영한다',()=>{
  const expected={
    'comet-compass':[100,{speed:.10}], 'starlight-flask':[120,{mp:5}],
    'crescent-charm':[120,{hp:5}], 'dawn-ribbon':[100,{hpRegen:1}],
    'stardew-ring':[100,{mpRegen:1}], 'asteroid-badge':[100,{durationMs:1000}]
  };
  for(const [id,[price,bonus]] of Object.entries(expected)){
    const item=EQUIPMENT_ITEMS.find(entry=>entry.id===id);
    assert.equal(item.price,price);assert.deepEqual(item.bonus,bonus);
  }
  const p=player();
  assert.deepEqual(equipmentBonus(p),{attack:0,defense:0,hp:0,mp:0,speed:0,regen:0,hpRegen:0,mpRegen:0,durationMs:0,skillDamage:0,cooldownReduction:0,allCooldownReduction:0});
  p.equipmentSlots=['dawn-ribbon','stardew-ring','asteroid-badge'];
  assert.deepEqual(equipmentBonus(p),{attack:0,defense:0,hp:0,mp:0,speed:0,regen:0,hpRegen:1,mpRegen:1,durationMs:1000,skillDamage:0,cooldownReduction:0,allCooldownReduction:0});
});

test('LV2 장비 6종은 요청한 가격과 장착 bonus만 가진다',()=>{
  const expected={
    'azure-starblade':[400,{attack:1}], 'silver-shield':[400,{defense:1}],
    'healing-crystal':[500,{hpRegen:1,mpRegen:1}], 'star-pattern-gloves':[500,{skillDamage:.20}],
    'lake-brooch':[500,{hp:10}], 'breeze-anklet':[800,{mp:10,speed:.10}]
  };
  for(const [id,[price,bonus]] of Object.entries(expected)){
    const item=EQUIPMENT_ITEMS.find(entry=>entry.id===id);
    assert.equal(item.price,price);assert.deepEqual(item.bonus,bonus);
  }
  const p=player();p.equipmentSlots=['healing-crystal','star-pattern-gloves',null];
  assert.deepEqual(equipmentBonus(p),{attack:0,defense:0,hp:0,mp:0,speed:0,regen:0,hpRegen:1,mpRegen:1,durationMs:0,skillDamage:.20,cooldownReduction:0,allCooldownReduction:0});
});

test('LV3 장비 5종은 ID와 레벨을 유지하며 지정 가격·bonus만 가진다',()=>{
  const expected={
    'galaxy-pendant':[1000,{mp:10,mpRegen:2}], 'star-heart':[1000,{hp:10,hpRegen:2}],
    'meteor-boots':[1200,{speed:.20,cooldownReduction:.10}], 'galaxy-compass':[1500,{attack:1,skillDamage:.20}],
    'dream-guardian-cloak':[1500,{defense:1,hp:10}]
  };
  for(const [id,[price,bonus]] of Object.entries(expected)){
    const item=EQUIPMENT_ITEMS.find(entry=>entry.id===id);
    assert.equal(item.level,3);assert.equal(item.price,price);assert.deepEqual(item.bonus,bonus);
  }
  const p=player();p.equipmentSlots=['meteor-boots','galaxy-compass','star-heart'];
  assert.deepEqual(equipmentBonus(p),{attack:1,defense:0,hp:10,mp:0,speed:.20,regen:0,hpRegen:2,mpRegen:0,durationMs:0,skillDamage:.20,cooldownReduction:.10,allCooldownReduction:0});
});
