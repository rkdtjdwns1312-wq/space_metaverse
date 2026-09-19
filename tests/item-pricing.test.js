import test from 'node:test';
import assert from 'node:assert/strict';
import { deriveLv2Price, deriveSellPrice, sellPrice, sellQuote } from '../shared/item-pricing.js';

test('LV1 price 1 sells only in even pairs and cannot lose on odd quantities', () => {
  assert.deepEqual(sellQuote({ level: 1, price: 1 }, 2), { gain: 1, quantity: 2 });
  assert.deepEqual(sellQuote({ level: 1, price: 1 }, 10), { gain: 5, quantity: 10 });
  assert.equal(sellQuote({ level: 1, price: 1 }, 3).gain, 0);
  assert.equal(sellQuote({ level: 1, price: 1 }, 3).error, 'quantity-must-be-even');
});

test('LV1 normal odd prices use unit floor', () => {
  assert.equal(sellPrice({ level: 1, price: 5 }), 2);
  assert.deepEqual(sellQuote({ level: 1, price: 5 }, 3), { gain: 6, quantity: 3 });
  assert.deepEqual(sellQuote({ level: 1, price: 2 }, 1), { gain: 1, quantity: 1 });
  assert.deepEqual(sellQuote({ level: 1, price: 3 }, 1), { gain: 1, quantity: 1 });
});

test('quantity is restricted to 1 through 10', () => {
  assert.equal(sellQuote({ level: 1, price: 8 }, 0).error, 'invalid-quantity');
  assert.equal(sellQuote({ level: 1, price: 8 }, 11).error, 'invalid-quantity');
});

test('LV2 buy and sell use ingredient buy prices plus the fixed metadata rules', () => {
  assert.equal(deriveLv2Price(10), 15);
  assert.equal(deriveSellPrice(10), 5);
});

test('LV2 through LV4 sell prices use weighted ingredient totals and unit floor', () => {
  for (const level of [2, 3, 4]) {
    assert.equal(deriveSellPrice(12), 6);
  }
});

test('explicit sellPrice and noSell support authored public catalog values', () => {
  assert.deepEqual(sellQuote({ sellPrice: 7 }, 3), { gain: 21, quantity: 3 });
  assert.equal(sellQuote({ sellPrice: null }, 2).error, 'no-sell-price');
  assert.equal(sellQuote({ noSell: true }, 2).error, 'no-sell-price');
});
