import test from 'node:test';
import assert from 'node:assert/strict';
import {BLACK_HOLE_ID, ITEM_USE, SHOP, SHARDS} from '../shared/config.js';
import {LV3_ITEMS} from '../shared/lv3-items.js';
import {availableSupernovas, consumeSupernovas, lv3ItemsDue, settleLv3Items, syncLv3Holdings, useLv3Item, validateLv3State} from '../server/lv3-item-effects.js';
import {MAX_CARD_MARKERS} from '../server/item-cards.js';
import {starCardPurchaseQuote, consumeStarCardDiscounts} from '../server/star-cards.js';
import {weekStart} from '../server/temple.js';
import {GameError} from '../server/rooms.js';

const NOW = Date.parse('2026-09-21T03:00:00Z'); // Monday noon KST
const DAY = 86_400_000, WEEK = 7 * DAY;
const card = id => LV3_ITEMS.find(item => item.id === id);
function player(id, level = 3) {
  return {id, nickname: id, role: 'student', connected: true, avatar: {level, blackStar: null}, inventory: [],
    starShards: 20, cardMarkers: [], effects: [], abilityState: {markers: [], blocks: []}, lastItemUseAt: 0,
    mapId: 'plaza', x: 100, y: 100, lv3State: validateLv3State()};
}
function fixture(itemId, quantity = 1) {
  const [actor, b, c, d, owner] = ['a', 'b', 'c', 'd', 'owner'].map(id => player(id));
  if (itemId) actor.inventory.push({id: itemId, quantity});
  const room = {players: new Map([actor, b, c, d, owner].map(p => [p.id, p])), planets: new Map()};
  return {room, actor, b, c, d, owner};
}
function use(f, id, data = {}, now = NOW) { return useLv3Item(f.room, f.actor, id, data, now); }
function marker(itemId, extra = {}) {
  return {id: `mark-${itemId}`, itemId, until: NOW + WEEK, fromId: 'owner', fromNickname: 'owner', at: NOW - 1000, fromLevel: 3, ...extra};
}
function rejectedWithoutMutation(f, fn, pattern) {
  const before = structuredClone(f.room);
  assert.throws(fn, error => {
    assert.ok(error instanceof GameError);
    if (pattern) assert.match(error.message, pattern);
    return true;
  });
  assert.deepEqual(f.room, before);
}
function fillBag(p) {
  for (let i = 0; p.inventory.length < SHOP.maxKinds; i++) p.inventory.push({id: `filler-${i}`, quantity: 1});
}

test('catalogue contains exactly eight public LV3 cards with stable level and mode', () => {
  assert.equal(LV3_ITEMS.length, 8);
  assert.ok(LV3_ITEMS.every(item => item.level === 3 && item.mode === 'lv3'));
  assert.deepEqual(new Set(LV3_ITEMS.map(item => item.id)).size, 8);
  assert.equal(card('space-station-card').targets, 'pair');
  assert.equal(card('great-spaceship-card').targets, 'self-and-two');
});

test('catalogue ID controls use; spoofed level, ID, target policy and unknown IDs are rejected atomically', () => {
  const f = fixture('space-station-card');
  rejectedWithoutMutation(f, () => useLv3Item(f.room, f.actor, {id: 'space-station-card', level: 1, targets: 'self', usable: true}, {targetId: 'a'}, NOW), /대상|서로 다른/);
  rejectedWithoutMutation(f, () => useLv3Item(f.room, f.actor, {id: 'unknown-card', level: 3, usable: true}, {}, NOW), /준비 중/);
  rejectedWithoutMutation(f, () => use(f, 'galaxy-card'), /준비 중/);
  const g = fixture('supernova-alpha-card');
  rejectedWithoutMutation(g, () => useLv3Item(g.room, g.actor, {id: 'supernova-alpha-card', usable: true, targets: 'self'}, {}, NOW), /준비 중/);
});

test('ownership, actor identity, connection, LV3 restriction and cooldown fail before mutation', () => {
  const cases = [
    [f => { f.actor.inventory = []; }, /가방/],
    [f => { f.actor.inventory[0].quantity = 0; }, /가방/],
    [f => { f.actor.avatar.level = 2; }, /lv보다 높은/],
    [f => { f.actor.connected = false; }, /입장/],
    [f => { f.actor.lastItemUseAt = NOW - ITEM_USE.cooldownMs + 1; }, /천천히/]
  ];
  for (const [setup, pattern] of cases) {
    const f = fixture('comet-card'); setup(f);
    rejectedWithoutMutation(f, () => use(f, 'comet-card'), pattern);
  }
  const f = fixture('comet-card');
  const impostor = {...f.actor};
  rejectedWithoutMutation(f, () => useLv3Item(f.room, impostor, 'comet-card', {}, NOW), /입장/);
});

test('UV, LV2 item block, ability block and target protection reject without mutation', () => {
  const cases = [
    [f => { f.actor.cardMarkers = [marker('little-sun-card')]; }, /자외선/],
    [f => { f.actor.cardMarkers = [marker('sun-rabbit-card')]; }, /사용할 수 없어요/],
    [f => { f.actor.abilityState.blocks = [{until: NOW + 1}]; }, /사용할 수 없어요/],
    [f => { f.b.cardMarkers = [marker('little-moon-card')]; }, /꼬마 달/],
    [f => { f.b.avatar.level = 4; }, /높은/],
    [f => { f.b.connected = false; }, /지금 없어요/]
  ];
  for (const [setup, pattern] of cases) {
    const f = fixture('space-station-card'); setup(f);
    rejectedWithoutMutation(f, () => use(f, 'space-station-card', {targetIds: ['b', 'c']}), pattern);
  }
});

test('station accepts exactly two distinct connected student targets and consumes once', () => {
  const bad = [[], ['b'], ['b', 'b'], ['b', 'c', 'd'], ['b', 'missing']];
  for (const targetIds of bad) {
    const f = fixture('space-station-card');
    rejectedWithoutMutation(f, () => use(f, 'space-station-card', {targetIds}), /대상|서로 다른|친구/);
  }
  const f = fixture('space-station-card', 2);
  const result = use(f, 'space-station-card', {targetIds: ['b', 'c']});
  assert.deepEqual(result.targetIds, ['b', 'c']);
  assert.equal(f.actor.inventory[0].quantity, 1);
  for (const p of [f.b, f.c]) assert.equal(p.cardMarkers[0].itemId, 'space-station-card');
  assert.equal(f.actor.cardMarkers.length, 0);
});

test('spaceship requires actor plus exactly two distinct other students', () => {
  for (const data of [{targetIds: []}, {targetIds: ['a', 'b']}, {targetIds: ['b', 'b']}, {targetIds: ['b', 'c', 'd']}]) {
    const f = fixture('great-spaceship-card');
    rejectedWithoutMutation(f, () => use(f, 'great-spaceship-card', data), /대상|서로 다른/);
  }
  const f = fixture('great-spaceship-card');
  const result = use(f, 'great-spaceship-card', {targetIds: ['b', 'c']});
  assert.deepEqual(result.targetIds, ['a', 'b', 'c']);
  assert.deepEqual([f.actor, f.b, f.c].map(p => p.cardMarkers.length), [1, 1, 1]);
  assert.match(f.actor.cardMarkers[0].note, /앞 b · 뒤 c/);
});

test('station marker capacity and sun tax failures roll back every target and item change', () => {
  const full = fixture('space-station-card');
  full.c.cardMarkers = Array.from({length: MAX_CARD_MARKERS}, (_, i) => marker('alien-card', {id: `full-${i}`, until: null}));
  rejectedWithoutMutation(full, () => use(full, 'space-station-card', {targetIds: ['b', 'c']}), /가득/);
  const tax = fixture('rabbit-princess-card');
  tax.actor.cardMarkers = [marker('sun-card')]; tax.actor.starShards = 0;
  rejectedWithoutMutation(tax, () => use(tax, 'rabbit-princess-card'), /사용료/);
});

test('cluster rewards two star cards and rabbit princess rewards one atomically', () => {
  for (const [id, amount] of [['galaxy-cluster-card', 2], ['rabbit-princess-card', 1]]) {
    const f = fixture(id);
    use(f, id);
    assert.deepEqual(f.actor.inventory, [{id: 'star-card', quantity: amount}]);
    assert.equal(f.actor.lastItemUseAt, NOW);
  }
  for (const [id, amount] of [['galaxy-cluster-card', 2], ['rabbit-princess-card', 1]]) {
    const stacked = fixture(id);
    stacked.actor.inventory.push({id: 'star-card', quantity: SHOP.maxStack - amount + 1});
    rejectedWithoutMutation(stacked, () => use(stacked, id), /가방 공간/);
  }
});

test('successful LV3 use collects sun tax exactly once alongside its reward', () => {
  const f = fixture('galaxy-cluster-card');
  f.actor.cardMarkers = [marker('sun-card'), marker('sun-card', {id: 'duplicate-sun'})];
  use(f, 'galaxy-cluster-card');
  assert.equal(f.actor.starShards, 19);
  assert.equal(f.owner.starShards, 21);
  assert.deepEqual(f.actor.inventory, [{id: 'star-card', quantity: 2}]);
});

test('reward capacity is checked after item consumption can free a slot', () => {
  const f = fixture('galaxy-cluster-card');
  fillBag(f.actor);
  use(f, 'galaxy-cluster-card');
  assert.equal(f.actor.inventory.length, SHOP.maxKinds);
  assert.ok(f.actor.inventory.some(item => item.id === 'star-card' && item.quantity === 2));
});

test('comet clears every warning and black star including disconnected students', () => {
  const f = fixture('comet-card');
  f.b.connected = false;
  f.b.avatar.blackStar = {planetId: 'p1', at: NOW - DAY}; f.b.mapId = BLACK_HOLE_ID;
  f.c.avatar.blackStar = {planetId: 'p2', at: NOW - DAY};
  f.room.planets.set('p1', {id: 'p1', warnings: {threshold: 3, entries: [
    {targetId: 'b', active: true}, {targetId: 'gone', active: true}, {targetId: 'c', active: false}
  ]}});
  f.room.planets.set('p2', {id: 'p2', warnings: {threshold: 3, entries: [{targetId: 'c', active: true}]}});
  use(f, 'comet-card');
  assert.equal(f.b.avatar.blackStar, null); assert.equal(f.c.avatar.blackStar, null);
  assert.notEqual(f.b.mapId, BLACK_HOLE_ID);
  for (const planet of f.room.planets.values()) assert.ok(planet.warnings.entries.every(entry => !entry.active));
  assert.equal(f.actor.inventory.length, 0);
});

test('cluster holdings create at most two seven-day anchors, including multiple acquisitions', () => {
  const f = fixture();
  f.actor.inventory.push({id: 'galaxy-cluster-card', quantity: 1});
  assert.equal(syncLv3Holdings(f.actor, NOW), true);
  assert.deepEqual(f.actor.lv3State.clusterNextAt, [NOW + WEEK]);
  f.actor.inventory[0].quantity = 2;
  syncLv3Holdings(f.actor, NOW + DAY);
  assert.deepEqual(f.actor.lv3State.clusterNextAt, [NOW + WEEK, NOW + DAY + WEEK]);
  f.actor.inventory[0].quantity = 3;
  syncLv3Holdings(f.actor, NOW + 2 * DAY);
  assert.equal(f.actor.lv3State.clusterNextAt.length, 2);
});

test('cluster settles all due weeks across multiple anchors and offline players', () => {
  const f = fixture();
  f.actor.connected = false;
  f.actor.inventory = [{id: 'galaxy-cluster-card', quantity: 2}];
  f.actor.lv3State.clusterNextAt = [NOW - 3 * WEEK, NOW - 2 * WEEK];
  assert.equal(lv3ItemsDue(f.room, NOW), true);
  assert.equal(settleLv3Items(f.room, NOW), true);
  assert.equal(f.actor.starShards, 20 + (4 * 2 + 3 * 2));
  assert.deepEqual(f.actor.lv3State.clusterNextAt, [NOW + WEEK, NOW + WEEK]);
  assert.equal(settleLv3Items(f.room, NOW), false);
});

test('cluster wallet maximum preserves undelivered accrual until capacity returns', () => {
  const f = fixture();
  f.actor.inventory = [{id: 'galaxy-cluster-card', quantity: 2}];
  f.actor.starShards = SHARDS.max;
  f.actor.lv3State.clusterNextAt = [NOW - 2 * WEEK, NOW - WEEK];
  assert.equal(settleLv3Items(f.room, NOW), false);
  assert.deepEqual(f.actor.lv3State.clusterNextAt, [NOW - 2 * WEEK, NOW - WEEK]);
  f.actor.starShards -= 3;
  assert.equal(settleLv3Items(f.room, NOW), true);
  assert.equal(f.actor.starShards, SHARDS.max - 1);
  assert.deepEqual(f.actor.lv3State.clusterNextAt, [NOW - WEEK, NOW - WEEK]);
});

test('cluster sale and reacquisition starts a fresh anchor rather than reusing sold time', () => {
  const f = fixture();
  f.actor.inventory = [{id: 'galaxy-cluster-card', quantity: 2}];
  f.actor.lv3State.clusterNextAt = [NOW + 10, NOW + 20];
  f.actor.inventory = [];
  syncLv3Holdings(f.actor, NOW + DAY);
  assert.deepEqual(f.actor.lv3State.clusterNextAt, []);
  f.actor.inventory = [{id: 'galaxy-cluster-card', quantity: 1}];
  syncLv3Holdings(f.actor, NOW + DAY);
  assert.deepEqual(f.actor.lv3State.clusterNextAt, [NOW + DAY + WEEK]);
});

test('supernova discounts are once per type per Korean week regardless of duplicate quantity', () => {
  const f = fixture();
  f.actor.inventory = [{id: 'supernova-alpha-card', quantity: 3}, {id: 'supernova-beta-card', quantity: 2}];
  assert.deepEqual(availableSupernovas(f.actor, NOW), ['supernova-alpha-card', 'supernova-beta-card']);
  consumeSupernovas(f.actor, ['supernova-alpha-card', 'supernova-alpha-card'], NOW);
  assert.deepEqual(availableSupernovas(f.actor, NOW), ['supernova-beta-card']);
  consumeSupernovas(f.actor, ['supernova-beta-card'], NOW);
  assert.deepEqual(availableSupernovas(f.actor, NOW), []);
  assert.deepEqual(availableSupernovas(f.actor, NOW + WEEK), ['supernova-alpha-card', 'supernova-beta-card']);
});

test('supernova sale and reacquisition cannot reset same-week use; Korean Monday boundary is exact', () => {
  const f = fixture();
  f.actor.inventory = [{id: 'supernova-alpha-card', quantity: 2}];
  consumeSupernovas(f.actor, ['supernova-alpha-card'], NOW);
  f.actor.inventory = [];
  f.actor.inventory = [{id: 'supernova-alpha-card', quantity: 1}];
  assert.deepEqual(availableSupernovas(f.actor, NOW + DAY), []);
  assert.deepEqual(availableSupernovas(f.actor, Date.parse('2026-09-27T14:59:59Z')), []);
  assert.deepEqual(availableSupernovas(f.actor, Date.parse('2026-09-27T15:00:00Z')), ['supernova-alpha-card']);
  assert.equal(weekStart(Date.parse('2026-09-27T14:59:59Z')), '2026-09-21');
  assert.equal(weekStart(Date.parse('2026-09-27T15:00:00Z')), '2026-09-28');
});

test('state validator defaults, clones valid state, and rejects malformed anchors or weekly use data', () => {
  assert.deepEqual(validateLv3State(undefined), {clusterNextAt: [], supernovaUsed: {}});
  const valid = {clusterNextAt: [NOW, NOW + WEEK], supernovaUsed: {'supernova-alpha-card': '2026-09-21'}};
  const copy = validateLv3State(valid);
  assert.deepEqual(copy, valid); assert.notStrictEqual(copy.clusterNextAt, valid.clusterNextAt);
  const invalid = [null, [], {clusterNextAt: [1, 2, 3], supernovaUsed: {}},
    {clusterNextAt: [-1], supernovaUsed: {}}, {clusterNextAt: [1.5], supernovaUsed: {}},
    {clusterNextAt: [], supernovaUsed: {'unknown-card': '2026-09-21'}},
    {clusterNextAt: [], supernovaUsed: {'supernova-alpha-card': '2026-09-22'}},
    {clusterNextAt: [], supernovaUsed: {'supernova-alpha-card': '2026-02-30'}}];
  for (const value of invalid) assert.throws(() => validateLv3State(value), /LV3 아이템 저장 데이터/);
});

test('supernova quote charges only one discount per purchase and consume records both sources', () => {
  const f = fixture();
  f.actor.inventory = [{id: 'supernova-alpha-card', quantity: 4}, {id: 'supernova-beta-card', quantity: 3}];
  const saturn = {id: 'saturn-record', cardId: 'saturn', userId: 'a', expiresAt: null,
    data: {automation: {version: 1, usedItems: []}}};
  f.room.starCards = [structuredClone(saturn), {...structuredClone(saturn), id: 'saturn-record-2',
    data: {automation: {version: 1, usedItems: []}}}];
  const item = {id: 'some-for-sale-item', price: 11, forSale: true};
  const quote = starCardPurchaseQuote(f.room, f.actor, item, 5, NOW);
  assert.equal(quote.discounted, 4);
  assert.equal(quote.cost, Math.floor(11 / 2) * 4 + 11);
  assert.equal(quote.cardIds.length, 2);
  assert.deepEqual(quote.supernovaIds, ['supernova-alpha-card', 'supernova-beta-card']);
  consumeStarCardDiscounts(f.room, item.id, quote, f.actor, NOW);
  assert.deepEqual(f.room.starCards.map(record => record.data.automation.usedItems), [[item.id], [item.id]]);
  assert.deepEqual(availableSupernovas(f.actor, NOW), []);
});

test('concurrent Saturn cards cannot discount the same item twice; distinct items remain eligible', () => {
  const f = fixture();
  const record = n => ({id: `saturn-${n}`, cardId: 'saturn', userId: 'a', expiresAt: null,
    data: {automation: {version: 1, usedItems: []}}});
  f.room.starCards = [record(1), record(2)];
  const first = {id: 'item-a', price: 9}, second = {id: 'item-b', price: 8};
  const quote = starCardPurchaseQuote(f.room, f.actor, first, 1, NOW);
  assert.deepEqual(quote.cardIds, ['saturn-1']);
  assert.equal(quote.discounted, 1);
  consumeStarCardDiscounts(f.room, first.id, quote, f.actor, NOW);
  const next = starCardPurchaseQuote(f.room, f.actor, first, 1, NOW);
  assert.deepEqual(next.cardIds, ['saturn-2']);
  const other = starCardPurchaseQuote(f.room, f.actor, second, 1, NOW);
  assert.deepEqual(other.cardIds, ['saturn-1']);
});

test('Saturn and supernova opportunities discount each purchased item at most once', () => {
  const f = fixture();
  const record = n => ({id: `saturn-${n}`, cardId: 'saturn', userId: 'a', expiresAt: null,
    data: {automation: {version: 1, usedItems: []}}});
  f.room.starCards = [record(1), record(2)];
  f.actor.inventory = [{id: 'supernova-alpha-card', quantity: 3}, {id: 'supernova-beta-card', quantity: 2}];
  const item = {id: 'item-a', price: 9};
  const one = starCardPurchaseQuote(f.room, f.actor, item, 1, NOW);
  assert.equal(one.discounted, 1);
  assert.equal(one.cost, Math.floor(item.price / 2));
  assert.equal(one.cardIds.length + one.supernovaIds.length, 1);

  const quote = starCardPurchaseQuote(f.room, f.actor, item, 2, NOW);
  assert.equal(quote.discounted, 2);
  assert.equal(quote.cost, Math.floor(item.price / 2) * 2);
  assert.equal(quote.cardIds.length + quote.supernovaIds.length, 2);
});
