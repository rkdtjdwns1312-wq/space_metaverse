import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {monstersOf,monsterViews,damageMonster,moveMonsters} from '../server/monsters.js';
import {collectEnergyDrop} from '../server/energy-drops.js';
import {loadCraftingRecipes} from '../server/crafting-recipes.js';
import {attemptCraft} from '../server/crafting.js';
import {equip,buyEquipment} from '../server/equipment.js';
import {equipmentBonus} from '../shared/equipment.js';
import {monsterType} from '../shared/monsters.js';
import {itemOf} from '../shared/config.js';

const owner=(id,mapId)=>({id,role:'student',nickname:id,connected:true,away:false,mapId,
  x:900,y:570,avatar:{level:4,constellationId:'taurus'},inventory:[],
  equipmentSlots:[null,null,null],starShards:3,cosmicEnergy:0});
function roomFor(typeId){
  const type=monsterType(typeId),player=owner('a',type.mapId);
  const room={players:new Map([[player.id,player]])};
  const boss=monstersOf(room,1000,()=>0).get(typeId+'-boss');
  room.monsters=new Map([[boss.id,boss]]);
  return {room,player,boss};
}

test('두 낙원 3에 보스가 한 마리씩, LV3 몬스터 2배 크기와 전투 수치로 생성된다',()=>{
  for(const id of ['noksera','leoon']){
    const {room,boss}=roomFor(id),type=monsterType(id);
    assert.equal(type.name,id==='noksera'?'노크세라':'레오온');
    assert.equal(type.boss,true);
    assert.equal(boss.mapId,type.mapId);
    assert.equal(boss.radius,192);
    assert.equal(boss.hp,2000);
    assert.equal(monsterViews(room)[0].attackPower,20);
    assert.equal(monsterViews(room)[0].typeId,id);
    assert.equal(monsterViews(room).length,1);
  }
});

test('보스 방어력 5, 우주에너지 400~600, 전용재료 100%, LV4 완제품 1%를 각각 적용한다',()=>{
  for(const id of ['noksera','leoon']){
    const {room,player,boss}=roomFor(id);
    assert.equal(damageMonster(room,boss,player,5,1100).damage,1);
    const result=damageMonster(room,boss,player,2004,1200,{
      energyRoll:(min,max)=>{assert.deepEqual([min,max],[400,601]);return 400;},
      bossRoll:(min,max)=>min
    });
    assert.equal(result.defeated,true);
    const drops=[...room.energyDrops.values()];
    assert.equal(drops.filter(d=>!d.kind).length,1);
    assert.equal(drops.find(d=>!d.kind).total,400);
    assert.equal(drops.find(d=>d.itemId===(id==='noksera'?'noksera-horn':'leoon-claw')).total,1);
    assert.equal(drops.filter(d=>d.kind==='item').length,2);
    assert.equal(itemOf(drops.find(d=>d.kind==='item'&&d.itemId!== (id==='noksera'?'noksera-horn':'leoon-claw')).itemId).level,4);
    const material=drops.find(d=>d.itemId===(id==='noksera'?'noksera-horn':'leoon-claw'));
    Object.assign(player,{x:material.x,y:material.y});
    assert.equal(collectEnergyDrop(room,player,material.id,1300).kind,'item');
    assert.equal(player.inventory.find(i=>i.id===material.itemId).quantity,1);
  }
});

test('보스 공격 간격은 2초이며 일반 LV3 몬스터보다 느리다',()=>{
  const {room,player,boss}=roomFor('noksera');
  player.x=boss.x+boss.radius+25;player.y=boss.y;
  boss.attackers.set(player.id,1);boss.targetId=player.id;boss.nextAttackAt=1000;
  const hits=moveMonsters(room,1000,()=>0);
  assert.ok(hits.length>=1);
  assert.equal(boss.nextAttackAt,3000);
  assert.equal(moveMonsters(room,2000,()=>0).length,0);
});

test('보스 장비 조합은 비공개 파일에서 읽어 별 파편·재료를 소모하고 장착된다',t=>{
  assert.deepEqual(loadCraftingRecipes('nonexistent-boss-crafting-test.json'),[]);
  const dir=mkdtempSync(join(tmpdir(),'boss-recipe-fixture-'));t.after(()=>rmSync(dir,{recursive:true,force:true}));
  const path=join(dir,'recipes.json');
  // 공개 검사는 실제 조합법과 다른 임시 재료로 로더·장착 흐름만 확인합니다.
  const parts=[{id:'noksera-horn',quantity:3}],output='sun-ring';
  writeFileSync(path,JSON.stringify([{output:{id:output,quantity:1},ingredients:parts}]));
  const recipes=loadCraftingRecipes(path),player=owner('a','moon-paradise-3');player.inventory=structuredClone(parts);
  const result=attemptCraft(player,parts,{recipes});
  assert.equal(result.success,true);
  assert.equal(result.item.id,output);
  assert.equal(player.starShards,2);
  assert.deepEqual(player.inventory,[{id:output,quantity:1}]);
  assert.equal(equip(player,output,1).equipmentSlots[0],output);
  assert.ok(Object.values(equipmentBonus(player)).some(value=>value>0));
  assert.throws(()=>buyEquipment(player,output));
});
