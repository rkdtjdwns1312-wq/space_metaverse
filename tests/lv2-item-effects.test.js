import test from 'node:test';
import assert from 'node:assert/strict';
import {BLACK_HOLE_ID, PLAZA_ID, SHARDS, SHOP} from '../shared/config.js';
import {LV2_ITEMS} from '../shared/lv2-items.js';
import {useLv2Item, settleLv2Items, hasLv2ItemBlock, collectSunTax,
  acquireGalaxy, canPurchaseLv2Item, syncGalaxyHoldings, androidDueAt, lv2ItemsDue} from '../server/lv2-item-effects.js';
import {GameError} from '../server/rooms.js';

const NOW = Date.parse('2026-09-21T03:00:00Z'); // Monday noon KST
const DAY = 86_400_000, WEEK = 7 * DAY;
function player(id) {
  return {id, nickname: id, role: 'student', connected: true, avatar: {level: 2, blackStar: null},
    inventory: [], starShards: 10, cardMarkers: [], effects: [], rabbitDraw: null,
    abilityState: {markers: [], blocks: []}, lastItemUseAt: 0, mapId: PLAZA_ID, x: 100, y: 100};
}
function fixture(itemId, quantity = 1) {
  const [actor, b, c, d, owner] = ['a', 'b', 'c', 'd', 'owner'].map(player);
  if (itemId) actor.inventory.push({id: itemId, quantity});
  const room = {players: new Map([actor, b, c, d, owner].map(p => [p.id, p])), planets: new Map()};
  return {room, actor, b, c, d, owner};
}
function use(f, id, data = {}, now = NOW, die) { return useLv2Item(f.room, f.actor, id, data, now, die); }
function marker(itemId, extra = {}) {
  return {id: 'mark-' + itemId, itemId, until: NOW + WEEK, fromId: 'owner', fromNickname: 'owner', at: NOW - 1000, fromLevel: 2, ...extra};
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
  for (let i = 0; p.inventory.length < SHOP.maxKinds; i++) p.inventory.push({id: 'filler-' + i, quantity: 1});
}

test('catalogue defines exactly ten LV2 effects and rejects spoofed self targets', () => {
  assert.equal(LV2_ITEMS.length, 10);
  assert.ok(LV2_ITEMS.every(item => item.mode === 'lv2'));
  const f = fixture('spaceman-card');
  rejectedWithoutMutation(f, () => useLv2Item(f.room, f.actor, {id: 'spaceman-card', targets: 'any', level: 0}, {targetId: 'b'}, NOW), /나에게만/);
  rejectedWithoutMutation(f, () => use(f, 'unknown-card'), /LV2/);
});

test('owned, level, connection, target levels, UV and ability blocks validate before mutation', () => {
  const cases = [
    [f => { f.actor.inventory = []; }, /가방/],
    [f => { f.actor.inventory[0].quantity = 0; }, /가방/],
    [f => { f.actor.avatar.level = 1; }, /LV2/],
    [f => { f.actor.connected = false; }, /입장/],
    [f => { f.b.connected = false; }, /지금 없어요/],
    [f => { f.b.avatar.level = 3; }, /높은/],
    [f => { f.actor.cardMarkers = [marker('little-sun-card')]; }, /자외선/],
    [f => { f.b.cardMarkers = [marker('little-moon-card')]; }, /꼬마 달/],
    [f => { f.actor.abilityState.blocks = [{until: NOW + 1}]; }, /사용할 수 없어요/],
    [f => { f.actor.cardMarkers = [marker('sun-rabbit-card')]; }, /사용할 수 없어요/]
  ];
  for (const [setup, pattern] of cases) {
    const f = fixture('satellite-card'); setup(f);
    rejectedWithoutMutation(f, () => use(f, 'satellite-card', {targetIds: ['b', 'c']}), pattern);
  }
});

test('cooldown exact boundary, one item consumption, caller and session object identity', () => {
  const f = fixture('spaceman-card', 2);
  f.actor.lastItemUseAt = NOW - 1999;
  rejectedWithoutMutation(f, () => use(f, 'spaceman-card'), /천천히/);
  const original = f.actor;
  f.actor.lastItemUseAt--;
  const result = use(f, 'spaceman-card');
  assert.strictEqual(f.room.players.get('a'), original);
  assert.deepEqual(result.targetIds, ['a']);
  assert.equal(f.actor.inventory[0].quantity, 1);
  assert.equal(f.actor.lastItemUseAt, NOW);
});

test('asteroid releases actual black-star warnings and moves out of black hole', () => {
  const f = fixture('asteroid-card');
  f.actor.avatar.blackStar = {planetId: 'planet-a', at: NOW - DAY};
  f.actor.mapId = BLACK_HOLE_ID;
  for (const id of ['planet-a', 'planet-b']) f.room.planets.set(id, {id, warnings: {threshold: 3, entries: [
    {targetId: 'a', active: true}, {targetId: 'b', active: true}
  ]}});
  use(f, 'asteroid-card');
  assert.equal(f.actor.avatar.blackStar, null);
  assert.equal(f.actor.mapId, PLAZA_ID);
  assert.equal(f.actor.inventory.length, 0);
  for (const p of f.room.planets.values()) assert.deepEqual(p.warnings.entries.map(e => e.active), [false, true]);
  const absent = fixture('asteroid-card');
  rejectedWithoutMutation(absent, () => use(absent, 'asteroid-card'), /검은별/);
});

test('asteroid tax failure leaves actual warning records intact', () => {
  const f = fixture('asteroid-card');
  f.actor.avatar.blackStar = {planetId: 'p', at: NOW};
  f.room.planets.set('p', {id: 'p', warnings: {entries: [{targetId: 'a', active: true}]}});
  f.actor.cardMarkers.push(marker('sun-card'));
  f.actor.starShards = 0;
  rejectedWithoutMutation(f, () => use(f, 'asteroid-card'), /사용료/);
});

test('spaceship requires actor plus friend; satellite uses exactly two chosen students', () => {
  const f = fixture('spaceship-card');
  rejectedWithoutMutation(f, () => use(f, 'spaceship-card', {targetIds: ['b', 'c']}), /나와 친구/);
  use(f, 'spaceship-card', {targetId: 'b'});
  for (const p of [f.actor, f.b]) {
    assert.equal(p.cardMarkers[0].until, NOW + WEEK);
    assert.equal(p.cardMarkers[0].fromId, 'a');
    assert.match(p.cardMarkers[0].note, /급식 자리/);
  }
  const g = fixture('satellite-card');
  rejectedWithoutMutation(g, () => use(g, 'satellite-card', {targetIds: ['b', 'b']}), /서로 다른/);
  use(g, 'satellite-card', {targetId: 'b', secondTargetId: 'c'});
  assert.equal(g.actor.cardMarkers.length, 0);
  assert.equal(g.b.cardMarkers[0].until, NOW + WEEK);
  assert.match(g.c.cardMarkers[0].note, /b/);
});

test('pair markers beyond 50 preserve existing effects and charge only once', () => {
  const f = fixture('satellite-card');
  f.actor.cardMarkers = [marker('sun-card')];
  f.c.cardMarkers = Array.from({length: 50}, (_, i) => marker('alien-card', {id: '' + i, until: null}));
  use(f, 'satellite-card', {targetIds: ['b', 'c']});
  assert.equal(f.b.cardMarkers.length,1);assert.equal(f.c.cardMarkers.length,51);
  assert.equal(f.c.cardMarkers.filter(m=>m.itemId==='alien-card').length,50);
  assert.ok(!f.actor.inventory.some(i=>i.id==='satellite-card'));
  assert.equal(f.actor.starShards,9);assert.equal(f.owner.starShards,11);
});

test('galaxy grants exactly one placeholder and consumes card with no effect marker', () => {
  const f = fixture('galaxy-card');
  fillBag(f.actor); // Consuming last card frees a slot.
  use(f, 'galaxy-card');
  assert.ok(f.actor.inventory.some(i => i.id === 'star-card' && i.quantity === 1));
  assert.ok(!f.actor.inventory.some(i => i.id === 'galaxy-card'));
  assert.equal(f.actor.cardMarkers.length, 0);
  assert.equal(f.actor.inventory.length, SHOP.maxKinds);
  assert.deepEqual(f.actor.lv2State.galaxyNextAt, []);
});

test('galaxy full-bag/stack reward failures do not consume or charge', () => {
  for (const stacked of [false, true]) {
    const f = fixture('galaxy-card', 2);
    f.actor.cardMarkers = [marker('sun-card')];
    if (stacked) f.actor.inventory.push({id: 'star-card', quantity: SHOP.maxStack});
    else fillBag(f.actor);
    rejectedWithoutMutation(f, () => use(f, 'galaxy-card'), /보상 아이템/);
  }
});

test('galaxy acquisition anchors each card, caps two and accrues every seven days offline', () => {
  const f = fixture();
  acquireGalaxy(f.actor, 1, NOW);
  acquireGalaxy(f.actor, 1, NOW + DAY);
  assert.deepEqual(f.actor.lv2State.galaxyNextAt, [NOW + WEEK, NOW + WEEK + DAY]);
  assert.equal(canPurchaseLv2Item(f.actor, 'galaxy-card'), false);
  rejectedWithoutMutation(f, () => acquireGalaxy(f.actor, 1, NOW + DAY), /최대 2/);
  assert.equal(settleLv2Items(f.room, NOW + WEEK - 1), false);
  assert.equal(settleLv2Items(f.room, NOW + WEEK), true);
  assert.equal(f.actor.starShards, 11);
  assert.equal(settleLv2Items(f.room, NOW + WEEK), false);
  settleLv2Items(f.room, NOW + 3 * WEEK + DAY);
  assert.equal(f.actor.starShards, 16);
  assert.deepEqual(f.actor.lv2State.galaxyNextAt, [NOW + 4 * WEEK, NOW + 4 * WEEK + DAY]);
});

test('galaxy wallet cap queues accrual; sale/reacquisition never reuses removed anchor', () => {
  const f = fixture();
  acquireGalaxy(f.actor, 2, NOW);
  f.actor.starShards = SHARDS.max;
  assert.equal(settleLv2Items(f.room, NOW + WEEK), false);
  f.actor.starShards -= 2;
  assert.equal(settleLv2Items(f.room, NOW + WEEK), true);
  assert.equal(f.actor.starShards, SHARDS.max);
  f.actor.inventory = [];
  syncGalaxyHoldings(f.actor, NOW + WEEK);
  acquireGalaxy(f.actor, 1, NOW + WEEK + DAY);
  assert.deepEqual(f.actor.lv2State.galaxyNextAt, [NOW + 2 * WEEK + DAY]);
});

test('acquisition respects configured bag capacity and invalid quantities are atomic', () => {
  const f = fixture(); fillBag(f.actor);
  assert.equal(canPurchaseLv2Item(f.actor, 'galaxy-card'), false);
  rejectedWithoutMutation(f, () => acquireGalaxy(f.actor), /빈칸/);
  f.actor.inventory.pop();
  for (const q of [0, -1, 1.5, 3]) rejectedWithoutMutation(f, () => acquireGalaxy(f.actor, q, NOW), /최대 2/);
  acquireGalaxy(f.actor, 2, NOW);
  assert.equal(f.actor.inventory.length, SHOP.maxKinds);
});

test('spaceman has three manual uses, fourteen-day boundary and consumed-use cleanup', () => {
  const f = fixture('spaceman-card'); use(f, 'spaceman-card');
  assert.equal(f.actor.cardMarkers[0].remainingUses, 3);
  assert.equal(settleLv2Items(f.room, NOW + 2 * WEEK - 1), false);
  assert.equal(settleLv2Items(f.room, NOW + 2 * WEEK), true);
  assert.equal(f.actor.cardMarkers.length, 0);
  const g = fixture('spaceman-card'); use(g, 'spaceman-card');
  g.actor.cardMarkers[0].remainingUses = 0;
  assert.equal(settleLv2Items(g.room, NOW + 1), true);
  assert.equal(g.actor.cardMarkers.length, 0);
});

test('sun rabbit clears all item effects/draw but preserves ability markers and inventory', () => {
  const f = fixture('sun-rabbit-card');
  f.b.cardMarkers = [marker('spaceman-card', {remainingUses: 3})];
  f.b.effects = [{itemId: 'meteor-board', until: NOW + 1000}];
  f.b.rabbitDraw = {id: 'draw'};
  f.b.abilityState = {markers: [{id: 'ability'}], blocks: [{until: NOW + DAY}]};
  f.b.inventory = [{id: 'alien-card', quantity: 2}];
  const abilities = structuredClone(f.b.abilityState);
  use(f, 'sun-rabbit-card', {targetId: 'b'});
  assert.deepEqual(f.b.effects, []);
  assert.equal(f.b.rabbitDraw, null);
  assert.deepEqual(f.b.abilityState, abilities);
  assert.deepEqual(f.b.inventory, [{id: 'alien-card', quantity: 2}]);
  assert.deepEqual(f.b.cardMarkers.map(m => m.itemId), ['sun-rabbit-card']);
  assert.equal(hasLv2ItemBlock(f.b, NOW + WEEK - 1), true);
  assert.equal(hasLv2ItemBlock(f.b, NOW + WEEK), false);
  settleLv2Items(f.room, NOW + WEEK);
  assert.ok(f.b.inventory.some(i => i.id === 'star-card' && i.quantity === 1));
  assert.ok(!f.actor.inventory.some(i => i.id === 'star-card'));
  assert.equal(settleLv2Items(f.room, NOW + WEEK), false);
});

test('sun rabbit reward remains queued through full bag and stack, then grants once', () => {
  for (const stacked of [false, true]) {
    const f = fixture('sun-rabbit-card');
    if (stacked) f.b.inventory = [{id: 'star-card', quantity: SHOP.maxStack}];
    else fillBag(f.b);
    use(f, 'sun-rabbit-card', {targetId: 'b'});
    settleLv2Items(f.room, NOW + WEEK);
    assert.equal(f.b.cardMarkers[0].pendingGrant, true);
    assert.equal(hasLv2ItemBlock(f.b, NOW + WEEK), false);
    assert.equal(settleLv2Items(f.room, NOW + WEEK + 1), false);
    if (stacked) f.b.inventory[0].quantity--;
    else f.b.inventory.pop();
    assert.equal(settleLv2Items(f.room, NOW + WEEK + 2), true);
    assert.equal(f.b.cardMarkers.length, 0);
    assert.equal(f.b.inventory.find(i => i.id === 'star-card').quantity, stacked ? SHOP.maxStack : 1);
    assert.equal(settleLv2Items(f.room, NOW + WEEK + 3), false);
  }
});

test('sun rabbit canceled before natural expiry yields no reward; expired reward survives new rabbit', () => {
  const f = fixture('sun-rabbit-card', 2);
  use(f, 'sun-rabbit-card', {targetId: 'b'});
  use(f, 'sun-rabbit-card', {targetId: 'b'}, NOW + DAY);
  settleLv2Items(f.room, NOW + WEEK);
  assert.equal(f.b.inventory.length, 0);
  settleLv2Items(f.room, NOW + WEEK + DAY);
  assert.deepEqual(f.b.inventory, [{id: 'star-card', quantity: 1}]);
  const g = fixture('sun-rabbit-card'); fillBag(g.b);
  g.b.cardMarkers = [marker('sun-rabbit-card', {until: NOW - 1, pendingGrant: true})];
  use(g, 'sun-rabbit-card', {targetId: 'b'});
  assert.equal(g.b.cardMarkers.length, 2);
});

for (let roll = 1; roll <= 6; roll++) test(`alien rabbit die ${roll} grants exemption plus exact extra reward`, () => {
  const f = fixture('alien-rabbit-card');
  assert.equal(use(f, 'alien-rabbit-card', {}, NOW, () => roll).roll, roll);
  const expected = [{id: 'alien-card', quantity: 1}];
  if (roll >= 3) expected.push({id: roll <= 4 ? 'moon-rabbit-card' : 'star-card', quantity: 1});
  assert.deepEqual(f.actor.inventory, expected);
  assert.equal(f.actor.cardMarkers.length, 0);
});

test('alien rabbit invalid die or second reward capacity rolls back first reward and tax', () => {
  for (const roll of [0, 7, 1.5]) {
    const f = fixture('alien-rabbit-card');
    rejectedWithoutMutation(f, () => use(f, 'alien-rabbit-card', {}, NOW, () => roll), /1~6/);
  }
  const f = fixture('alien-rabbit-card'); fillBag(f.actor);
  f.actor.cardMarkers = [marker('sun-card')];
  rejectedWithoutMutation(f, () => use(f, 'alien-rabbit-card', {}, NOW, () => 5), /보상 아이템/);
});

test('android uses KST weekday end boundaries including Friday, weekend and month rollover', () => {
  const dates = [
    ['2026-09-24T23:59:59.999+09:00', '2026-09-26T00:00:00+09:00'],
    ['2026-09-25T00:00:00+09:00', '2026-09-29T00:00:00+09:00'],
    ['2026-09-25T23:59:59.999+09:00', '2026-09-29T00:00:00+09:00'],
    ['2026-09-26T00:00:00+09:00', '2026-10-03T00:00:00+09:00'],
    ['2026-09-27T12:00:00+09:00', '2026-10-03T00:00:00+09:00']
  ];
  for (const [from, to] of dates) assert.equal(androidDueAt(Date.parse(from)), Date.parse(to));
  const f = fixture('android-card'); use(f, 'android-card');
  assert.equal(f.actor.cardMarkers[0].until, Date.parse('2026-09-26T00:00:00+09:00'));
});

test('sun requires exactly three distinct other students and validates all before applying', () => {
  for (const ids of [['a', 'b', 'c'], ['b', 'b', 'c'], ['b', 'c'], ['b', 'c', 'missing']]) {
    const f = fixture('sun-card');
    rejectedWithoutMutation(f, () => use(f, 'sun-card', {targetIds: ids}));
  }
  const f = fixture('sun-card'); use(f, 'sun-card', {targetIds: ['b', 'c', 'd']});
  for (const p of [f.b, f.c, f.d]) {
    assert.equal(p.cardMarkers[0].until, NOW + WEEK);
    assert.equal(p.cardMarkers[0].fromLevel, 2);
    assert.equal(p.cardMarkers[0].at, NOW);
    assert.equal(p.cardMarkers[0].fromId, 'a');
  }
});

test('sun higher-level priority; same-level most recent replaces, no partial targets', () => {
  const f = fixture('sun-card');
  f.d.cardMarkers = [marker('sun-card', {fromLevel: 3})];
  rejectedWithoutMutation(f, () => use(f, 'sun-card', {targetIds: ['b', 'c', 'd']}), /高|높은/);
  f.actor.avatar.level = 3;
  use(f, 'sun-card', {targetIds: ['b', 'c', 'd']});
  assert.equal(f.d.cardMarkers.length, 1);
  assert.equal(f.d.cardMarkers[0].fromId, 'a');
});

test('tax conserves shards, charges one winning owner once, even offline; expiry charges zero', () => {
  const f = fixture();
  f.owner.connected = false;
  f.actor.cardMarkers = [marker('sun-card'), marker('sun-card', {id: 'duplicate'}),
    marker('sun-card', {id: 'lower', fromId: 'b', fromLevel: 1, at: NOW})];
  assert.deepEqual(collectSunTax(f.room, f.actor, NOW), {amount: 1, ownerIds: ['owner']});
  assert.equal(f.actor.starShards, 9); assert.equal(f.owner.starShards, 11); assert.equal(f.b.starShards, 10);
  f.actor.cardMarkers.push(marker('sun-card', {id: 'recent', fromId: 'b', at: NOW}));
  assert.deepEqual(collectSunTax(f.room, f.actor, NOW), {amount: 1, ownerIds: ['b']});
  assert.deepEqual(collectSunTax(f.room, f.actor, NOW + WEEK), {amount: 0, ownerIds: []});
});

test('tax insufficient payer or full owner refuses with no mutation; missing owner not charged', () => {
  for (const full of [false, true]) {
    const f = fixture('spaceman-card'); f.actor.cardMarkers = [marker('sun-card')];
    if (full) f.owner.starShards = SHARDS.max; else f.actor.starShards = 0;
    rejectedWithoutMutation(f, () => collectSunTax(f.room, f.actor, NOW));
    rejectedWithoutMutation(f, () => use(f, 'spaceman-card'));
  }
  const f = fixture(); f.actor.cardMarkers = [marker('sun-card', {fromId: 'gone'})];
  assert.equal(collectSunTax(f.room, f.actor, NOW).amount, 0);
});

test('LV2 successful use taxes exactly once', () => {
  const f = fixture('spaceman-card'); f.actor.cardMarkers = [marker('sun-card')];
  use(f, 'spaceman-card');
  assert.equal(f.actor.starShards, 9); assert.equal(f.owner.starShards, 11);
});

test('moon removes sun and rewards two after paying use tax, not on ordinary use or expiry', () => {
  const f = fixture('moon-card'); f.actor.cardMarkers = [marker('sun-card')];
  use(f, 'moon-card');
  assert.equal(f.actor.starShards, 11); assert.equal(f.owner.starShards, 11);
  assert.deepEqual(f.actor.cardMarkers.map(m => m.itemId), ['moon-card']);
  assert.equal(f.actor.cardMarkers[0].until, NOW + WEEK);
  settleLv2Items(f.room, NOW + WEEK);
  assert.equal(f.actor.starShards, 11);
  const g = fixture('moon-card'); use(g, 'moon-card');
  assert.equal(g.actor.starShards, 10);
});

test('moon cannot bypass UV or black star; new black star cancels moon without reward', () => {
  for (const status of ['black', 'little-sun-card']) {
    const f = fixture('moon-card');
    if (status === 'black') f.actor.avatar.blackStar = {planetId: 'p', at: NOW};
    else f.actor.cardMarkers = [marker(status)];
    rejectedWithoutMutation(f, () => use(f, 'moon-card'));
  }
  const f = fixture('moon-card'); use(f, 'moon-card');
  f.actor.avatar.blackStar = {planetId: 'p', at: NOW + 1};
  settleLv2Items(f.room, NOW + 1);
  assert.equal(f.actor.cardMarkers.length, 0);
  assert.equal(f.actor.starShards, 10);
});

test('moon reward wallet overflow rolls back sun removal, tax and consumption', () => {
  const f = fixture('moon-card');
  f.actor.cardMarkers = [marker('sun-card')]; f.actor.starShards = SHARDS.max;
  rejectedWithoutMutation(f, () => use(f, 'moon-card'), /보상 2개/);
});

test('settlement removes expired LV2 markers only, preserves existing manual and ability markers', () => {
  const f = fixture();
  f.actor.cardMarkers = [marker('spaceship-card', {until: NOW}), marker('alien-card', {until: null}), marker('little-sun-card', {until: NOW})];
  f.actor.abilityState.markers = [{id: 'ability'}];
  assert.equal(settleLv2Items(f.room, NOW), true);
  assert.deepEqual(f.actor.cardMarkers.map(m => m.itemId), ['alien-card', 'little-sun-card']);
  assert.deepEqual(f.actor.abilityState.markers, [{id: 'ability'}]);
});

test('due predicate is read-only and matches settlement at boundaries and blocked capacities', () => {
  const check = (f, now, expected) => {
    const before = structuredClone(f.room);
    assert.equal(lv2ItemsDue(f.room, now), expected);
    assert.deepEqual(f.room, before);
    assert.equal(settleLv2Items(f.room, now), expected);
    assert.equal(lv2ItemsDue(f.room, now), false);
  };
  const f = fixture('galaxy-card');
  check(f, NOW, true); // Initial ownership anchor is missing.
  check(f, NOW + WEEK - 1, false);
  f.actor.starShards = SHARDS.max;
  check(f, NOW + WEEK, false);
  f.actor.starShards--;
  check(f, NOW + WEEK, true);
  const g = fixture('sun-rabbit-card'); fillBag(g.b);
  use(g, 'sun-rabbit-card', {targetId: 'b'});
  check(g, NOW + WEEK - 1, false);
  check(g, NOW + WEEK, true); // Mark the deferred grant once.
  check(g, NOW + WEEK + 1, false);
  g.b.inventory.pop();
  check(g, NOW + WEEK + 2, true);
  const h = fixture('spaceman-card'); use(h, 'spaceman-card');
  h.actor.cardMarkers[0].remainingUses = 0;
  check(h, NOW + 1, true);
  const j = fixture('moon-card'); use(j, 'moon-card');
  j.actor.avatar.blackStar = {planetId: 'p', at: NOW};
  check(j, NOW + 1, true);
});

test('little moon allows LV2 self and shared self effects but protects other recipients',()=>{
 for(const id of ['moon-card','spaceman-card','spaceship-card']){
 const f=fixture(id);f.actor.cardMarkers=[marker('little-moon-card')];
 use(f,id,id==='spaceship-card'?{targetId:'b'}:{});
 assert.ok(f.actor.cardMarkers.some(m=>m.itemId===id));
 assert.ok(f.actor.cardMarkers.some(m=>m.itemId==='little-moon-card'));
 }
 const f=fixture('spaceship-card');f.b.cardMarkers=[marker('little-moon-card')];
 rejectedWithoutMutation(f,()=>use(f,'spaceship-card',{targetId:'b'}),/꼬마 달/);
});
