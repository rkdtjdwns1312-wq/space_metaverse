import assert from 'node:assert/strict';
import test from 'node:test';
import {craftingHintViews} from '../server/crafting-hints.js';
import {BOSS_EQUIPMENT_RECIPES} from '../shared/crafting.js';

test('hints sum quantities by ingredient level and deduplicate equivalent alternative recipes',()=>{
  const recipes=[
    {output:{id:'android-card'},ingredients:[{id:'space-food-card',quantity:1},{id:'star-crumb',quantity:2},{id:'azure-starblade',quantity:1}]},
    {output:{id:'android-card'},ingredients:[{id:'space-food-card',quantity:3},{id:'silver-shield',quantity:1}]},
    {output:{id:'android-card'},ingredients:[{id:'azure-starblade',quantity:1},{id:'space-station-card',quantity:2}]},
    {output:{id:'space-station-card'},ingredients:[{id:'android-card',quantity:1}]}
  ];
  assert.deepEqual(craftingHintViews('android-card',recipes),[
    'Lv1 아이템 3개 + Lv2 아이템 1개',
    'Lv2 아이템 1개 + Lv3 아이템 2개'
  ]);
  assert.deepEqual(craftingHintViews('space-food-card',recipes),[]);
  assert.deepEqual(craftingHintViews('sun-ring',BOSS_EQUIPMENT_RECIPES),['Lv1 아이템 2개']);
  assert.deepEqual(craftingHintViews('burning-ice-necklace',BOSS_EQUIPMENT_RECIPES),['Lv1 아이템 2개']);
});
