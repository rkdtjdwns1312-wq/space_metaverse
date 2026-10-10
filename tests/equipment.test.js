import test from 'node:test';
import assert from 'node:assert/strict';
import {buyEquipment,equip,unequip} from '../server/equipment.js';
import {EQUIPMENT_ITEMS,equipmentBonus,validateEquipmentSlots} from '../shared/equipment.js';
import {attackPowerOf,defensePowerOf} from '../shared/combat.js';
import {vitalsOf} from '../shared/vitals.js';

const player=()=>({role:'student',avatar:{level:3,constellationId:'aquarius'},inventory:[],equipmentSlots:[null,null,null],cosmicEnergy:50});
test('구매·세 칸 장착·교체·해제는 장비를 가방과 한 곳에만 보관한다',()=>{
  const p=player();buyEquipment(p,'azure-starblade');buyEquipment(p,'silver-shield');
  assert.equal(p.cosmicEnergy,28);assert.equal(p.inventory.length,2);
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
  p.inventory.push({id:'star-heart',quantity:1});
  assert.throws(()=>equip(p,'star-heart',0),/칸/);
  assert.equal(p.inventory[0].quantity,1);
  equip(p,'star-heart',1);assert.equal(vitalsOf(3,p).hp.max,46);
  assert.equal(equipmentBonus(p).hp,6);
  p.inventory=Array.from({length:60},(_,i)=>({id:'filler-'+i,quantity:1}));
  assert.throws(()=>unequip(p,1),/가방/);assert.equal(p.equipmentSlots[0],'star-heart');
  assert.throws(()=>validateEquipmentSlots(['star-heart','star-heart',null]),/올바르지/);
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
  assert.equal(equipmentBonus(p).attack,3);
});
