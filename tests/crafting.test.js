import test from 'node:test';
import assert from 'node:assert/strict';
import { CRAFTING } from '../shared/crafting.js';
import { attemptCraft } from '../server/crafting.js';
import { SHOP } from '../shared/config.js';

const catalog = [
  { id: 'a', level: 1, name: 'A' }, { id: 'b', level: 1, name: 'B' },
  { id: 'ab', level: 2, name: 'AB' }
];
const recipes = [{ ingredients: [{ id: 'a', quantity: 2 }, { id: 'b', quantity: 1 }], output: { id: 'ab' } }];
const player = (inventory = [{ id: 'a', quantity: 2 }, { id: 'b', quantity: 1 }], shards = 3) => ({ inventory, starShards: shards });

test('빈 레시피는 비용 없이 거절한다', () => {
  const p = player(); const before = structuredClone(p);
  const result = attemptCraft(p, [{ id: 'a', quantity: 2 }]);
  assert.equal(result.success, false); assert.equal(result.error, 'invalid-recipe'); assert.deepEqual(p, before);
});

test('정확히 일치한 레시피는 재료를 소비하고 다음 단계 아이템을 만든다', () => {
  const p = player(); const result = attemptCraft(p, [{ id: 'b', quantity: 1 }, { id: 'a', quantity: 2 }], { recipes, catalog });
  assert.equal(result.success, true); assert.equal(result.error, null); assert.equal(result.balance, 2); assert.deepEqual(p.inventory, [{ id: 'ab', quantity: 1 }]);
});

test('레시피 불일치는 재료를 보존하고 비용만 낸다', () => {
  const p = player(); const result = attemptCraft(p, [{ id: 'a', quantity: 1 }], { recipes, catalog });
  assert.equal(result.success, false); assert.equal(result.error, 'recipe-mismatch'); assert.equal(result.balance, 2); assert.deepEqual(p.inventory, [{ id: 'a', quantity: 2 }, { id: 'b', quantity: 1 }]);
});

test('형식 오류와 부족한 재화·재료는 비용을 내지 않는다', () => {
  for (const input of [[], [{ id: 'missing', quantity: 1 }], [{ id: 'a', quantity: 0 }], [{ id: 'a', quantity: 1 }, { id: 'a', quantity: 1 }]]) {
    const p = player(); const result = attemptCraft(p, input, { recipes, catalog }); assert.equal(result.success, false); assert.equal(result.error, input.length === 0 || input[0].id === 'missing' ? (input.length === 0 ? 'invalid-input' : 'unknown-ingredient') : 'invalid-input'); assert.equal(p.starShards, 3);
  }
  const poor = player([{ id: 'a', quantity: 1 }, { id: 'b', quantity: 1 }], 3); attemptCraft(poor, [{ id: 'a', quantity: 2 }, { id: 'b', quantity: 1 }], { recipes, catalog }); assert.equal(poor.starShards, 3);
  const broke = player(undefined, 0); attemptCraft(broke, [{ id: 'a', quantity: 1 }], { recipes, catalog }); assert.equal(broke.starShards, 0);
});

test('가방 칸과 출력 스택 제한은 원자적으로 거절한다', () => {
  const full = player([{ id: 'a', quantity: 3 }, { id: 'b', quantity: 2 }, ...Array.from({ length: SHOP.maxKinds - 2 }, (_, i) => ({ id: 'x' + i, quantity: 1 }))], 3);
  const before = structuredClone(full); const result = attemptCraft(full, [{ id: 'a', quantity: 2 }, { id: 'b', quantity: 1 }], { recipes, catalog });
  assert.equal(result.success, false); assert.equal(result.error, 'inventory-full'); assert.deepEqual(full, before);
  const freed = player([{ id: 'a', quantity: 2 }, { id: 'b', quantity: 1 }, ...Array.from({ length: SHOP.maxKinds - 2 }, (_, i) => ({ id: 'x' + i, quantity: 1 }))], 3);
  assert.equal(attemptCraft(freed, [{ id: 'a', quantity: 2 }, { id: 'b', quantity: 1 }], { recipes, catalog }).success, true);
  const stacked = player([{ id: 'a', quantity: 2 }, { id: 'b', quantity: 1 }, { id: 'ab', quantity: 99 }], 3); const copy = structuredClone(stacked);
  assert.equal(attemptCraft(stacked, [{ id: 'a', quantity: 2 }, { id: 'b', quantity: 1 }], { recipes, catalog }).success, false); assert.deepEqual(stacked, copy);
});

test('형식이 깨진 레시피만 있으면 비용 없이 거절한다', () => {
  const p = player();
  const result = attemptCraft(p, [{ id: 'a', quantity: 2 }, { id: 'b', quantity: 1 }], {
    recipes: [{ ingredients: [{ id: 'a', quantity: 2 }], output: { id: 'missing' } }], catalog
  });
  assert.equal(result.success, false); assert.equal(result.error, 'invalid-recipe'); assert.equal(p.starShards, 3);
});

test('성령왕의 영혼은 공개 조합법으로 재화 두 종류를 소비해 LV5 망토를 만든다',()=>{
  const p={role:'student',avatar:{level:5},inventory:[{id:'spirit-king-soul',quantity:1}],starShards:10,cosmicEnergy:10000};
  const result=attemptCraft(p,[{id:'spirit-king-soul',quantity:1}]);
  assert.equal(result.success,true);
  assert.equal(result.item.id,'spirit-king-cloak');
  assert.deepEqual(p.inventory,[{id:'spirit-king-cloak',quantity:1}]);
  assert.equal(p.starShards,0);assert.equal(p.cosmicEnergy,0);
  assert.deepEqual(p.learnedRecipeIds,['spirit-king-cloak']);
});

test('성령왕 망토 조합은 별 파편·우주에너지 부족이나 꽉 찬 가방에서 원자적으로 거절한다',()=>{
  for(const [shards,energy,extra,error] of [[9,10000,[], 'insufficient-fee'],[10,9999,[], 'insufficient-energy'],
    [10,10000,[{id:'spirit-king-cloak',quantity:99}],'output-stack-full']]){
    const p={inventory:[{id:'spirit-king-soul',quantity:1},...extra],starShards:shards,cosmicEnergy:energy};
    const before=structuredClone(p),result=attemptCraft(p,[{id:'spirit-king-soul',quantity:1}]);
    assert.equal(result.error,error);assert.deepEqual(p,before);
  }
});
