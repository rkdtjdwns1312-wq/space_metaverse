import test from 'node:test';
import assert from 'node:assert/strict';
import {createAvatar, SHOP, SHARDS, PROGRESSION} from '../shared/config.js';
import {CONSTELLATIONS} from '../shared/constellations.js';
import {starCardOf, goldItemIdOf} from '../shared/star-cards.js';
import {useTypedStarCard, chooseStarCard, starCardChoiceInfo, validateStarCards, activeStarCards,
  requireStarCardItemAccess, starCardShopDiscounts, starCardPurchaseQuote, consumeStarCardDiscounts, removeStarCard} from '../server/star-cards.js';
import {nextKoreaMidnight} from '../server/item-cards.js';

const NOW = Date.parse('2026-09-25T03:00:00Z');
function fixture() {
  const make = id => ({id, nickname: id, role: 'student', connected: true, avatar: createAvatar(),
    inventory: [], starShards: 10, lastItemUseAt: 0, effects: [], cardMarkers: []});
  const actor = make('a'), other = make('b'), teacher = {...make('teacher'), role: 'teacher'};
  return {actor, other, teacher, room: {players: new Map([actor, other, teacher].map(p => [p.id, p])), planets: new Map()}};
}
function activate(f, type, actor = f.actor, now = NOW) {
  actor.inventory.push({id: goldItemIdOf(type), quantity: 1}); actor.lastItemUseAt = 0;
  return useTypedStarCard(f.room, actor, goldItemIdOf(type), now).record;
}
function rejectsUnchanged(f, callback, pattern) {
  const before = structuredClone(f.room);
  assert.throws(callback, pattern); assert.deepEqual(f.room, before);
}

test('old manual records load without retroactive choice, discount or lock', () => {
  for (const type of ['zodiac', 'saturn', 'pluto']) {
    const f = fixture(), record = activate(f, type), old = f.room.starCards[0], definition = starCardOf(type);
    delete old.data.automation;
    Object.assign(old.data, {status: 'manual', automatic: [...definition.automatic], manual: [...definition.manual]});
    assert.deepEqual(validateStarCards(f.room.starCards), f.room.starCards);
    assert.equal(starCardChoiceInfo(f.room, f.actor, old).canChoose, false);
    assert.deepEqual(starCardShopDiscounts(f.room, f.actor, NOW), {});
    requireStarCardItemAccess(f.room, f.other, NOW);
    rejectsUnchanged(f, () => chooseStarCard(f.room, f.actor, {id: record.id, choice: 'xp'}, NOW));
  }
});

for (let roll = 1; roll <= 6; roll++) test(`zodiac die ${roll}: XP cap, excess shards and exactly once`, () => {
  const f = fixture(); f.actor.avatar.xp = 14;
  const record = activate(f, 'zodiac'), id = record.id;
  assert.equal(starCardChoiceInfo(f.room, f.actor, record).canChoose, true);
  assert.deepEqual(starCardChoiceInfo(f.room, f.actor, record).options, []);
  const result = chooseStarCard(f.room, f.actor, {id, choice: 'xp'}, NOW, size => {assert.equal(size, 6); return roll - 1;});
  assert.equal(result.data.roll, roll); assert.equal(result.data.xp, 1);
  assert.equal(result.data.shards, Math.min(roll * 3, 10) - 1);
  assert.equal(f.actor.avatar.xp, 15); assert.equal(f.actor.avatar.level, 1);
  assert.equal(f.actor.starShards, 9 + Math.min(roll * 3, 10));
  assert.equal(f.room.players.get(f.actor.id), f.actor);
  f.room.starCards = JSON.parse(JSON.stringify(validateStarCards(f.room.starCards)));
  rejectsUnchanged(f, () => chooseStarCard(f.room, f.actor, {id, choice: 'xp'}, NOW, () => 5));
});

test('zodiac max-level XP is entirely converted, roll rejected atomically on capacity/invalid inputs', () => {
  const f = fixture(); f.actor.avatar = {...f.actor.avatar, level: PROGRESSION.transcendentLevel, xp: 0, form: 'transcendent', constellationId: 'aries'};
  const {id} = activate(f, 'zodiac'); f.actor.starShards = SHARDS.max - 9;
  let draws = 0;
  rejectsUnchanged(f, () => chooseStarCard(f.room, f.actor, {id, choice: 'xp'}, NOW, () => {draws++;return 0;}), /공간/);
  assert.equal(draws, 0);
  f.actor.starShards = 10;
  for (const random of [-1, 6, 1.1, '1']) rejectsUnchanged(f, () => chooseStarCard(f.room, f.actor, {id, choice: 'xp'}, NOW, () => random));
  chooseStarCard(f.room, f.actor, {id, choice: 'xp'}, NOW, () => 5);
  assert.equal(f.actor.avatar.xp, 0); assert.equal(f.actor.starShards, 20);
});

test('zodiac validates owner, LV2, valid choice and ignores constellation occupancy exactly once', () => {
  const f = fixture(), {id} = activate(f, 'zodiac');
  rejectsUnchanged(f, () => chooseStarCard(f.room, f.other, {id, choice: 'xp'}, NOW));
  rejectsUnchanged(f, () => chooseStarCard(f.room, f.teacher, {id, choice: 'xp'}, NOW));
  rejectsUnchanged(f, () => chooseStarCard(f.room, f.actor, {id, choice: 'constellation', constellationId: 'leo'}, NOW), /LV2/);
  f.actor.avatar = {...f.actor.avatar, level: 2, constellationId: 'aries', xp: 7};
  f.other.avatar = {...f.other.avatar, level: 2, constellationId: 'leo'};
  f.room.players.set('offline', {...structuredClone(f.other), id: 'offline', connected: false});
  assert.equal(starCardChoiceInfo(f.room, f.actor, f.room.starCards[0]).options.length, 16);
  for (const selected of ['bad', 'virgo', 'aries']) rejectsUnchanged(f, () => chooseStarCard(f.room, f.actor, {id, choice: 'constellation', constellationId: selected}, NOW));
  rejectsUnchanged(f, () => chooseStarCard(f.room, f.actor, {id, choice: 'xp', constellationId: 'leo'}, NOW));
  chooseStarCard(f.room, f.actor, {id, choice: 'constellation', constellationId: 'leo'}, NOW);
  assert.equal(f.actor.avatar.constellationId, 'leo'); assert.equal(f.actor.avatar.xp, 7); assert.equal(f.actor.avatar.level, 2);
  assert.equal(f.actor.starShards, 10);
  rejectsUnchanged(f, () => chooseStarCard(f.room, f.actor, {id, choice: 'xp'}, NOW));
});

test('all 16 current constellations can be chosen, legacy and teacher forms are not options', () => {
  for (const target of CONSTELLATIONS) {
    const f = fixture(); f.actor.avatar = {...f.actor.avatar, level: 5, constellationId: target.id === 'aries' ? 'leo' : 'aries'};
    const {id} = activate(f, 'zodiac');
    chooseStarCard(f.room, f.actor, {id, choice: 'constellation', constellationId: target.id}, NOW);
    assert.equal(f.actor.avatar.constellationId, target.id); assert.equal(f.actor.avatar.form, 'transcendent');
  }
});

test('Saturn discounts one unit per item, floor including zero; multiple cards never quarter a price', () => {
  const f = fixture(); activate(f, 'saturn');
  const item = SHOP.items.find(i => i.forSale !== false && i.price % 2 === 1);
  let quote = starCardPurchaseQuote(f.room, f.actor, item, 3, NOW);
  assert.equal(quote.cost, Math.floor(item.price / 2) + item.price * 2); assert.equal(quote.discounted, 1);
  assert.deepEqual(starCardShopDiscounts(f.room, f.other, NOW), {});
  consumeStarCardDiscounts(f.room, item.id, quote);
  assert.equal(starCardPurchaseQuote(f.room, f.actor, item, 1, NOW).cost, item.price);
  f.room.starCards = validateStarCards(JSON.parse(JSON.stringify(f.room.starCards)));
  assert.equal(starCardShopDiscounts(f.room, f.actor, NOW)[item.id], undefined);
  activate(f, 'saturn'); activate(f, 'saturn');
  quote = starCardPurchaseQuote(f.room, f.actor, item, 3, NOW);
  assert.equal(quote.discounted, 2); assert.equal(quote.cost, Math.floor(item.price / 2) * 2 + item.price);
  const cheap = SHOP.items.find(i => i.forSale !== false && i.price === 1);
  assert.equal(starCardPurchaseQuote(f.room, f.actor, cheap, 1, NOW).cost, 0);
});

test('public Saturn projections conceal purchased items and teacher removal stops unused discounts', () => {
  const f = fixture(), {id} = activate(f, 'saturn'), item = SHOP.items.find(i => i.forSale !== false);
  consumeStarCardDiscounts(f.room, item.id, starCardPurchaseQuote(f.room, f.actor, item, 1, NOW));
  assert.equal(JSON.stringify(activeStarCards(f.room, NOW)).includes('usedItems'), false);
  assert.ok(f.room.starCards[0].data.automation.usedItems.includes(item.id));
  removeStarCard(f.room, f.teacher, id);
  assert.deepEqual(starCardShopDiscounts(f.room, f.actor, NOW), {});
});

test('Pluto blocks every other student including offline owner until KST midnight; teacher exempt and removal immediate', () => {
  const f = fixture(), {id} = activate(f, 'pluto');
  requireStarCardItemAccess(f.room, f.actor, NOW); requireStarCardItemAccess(f.room, f.teacher, NOW);
  assert.throws(() => requireStarCardItemAccess(f.room, f.other, NOW), /명왕성/);
  f.actor.connected = false;
  assert.throws(() => requireStarCardItemAccess(f.room, f.other, nextKoreaMidnight(NOW) - 1), /명왕성/);
  requireStarCardItemAccess(f.room, f.other, nextKoreaMidnight(NOW));
  f.actor.connected = true;
  f.other.inventory = [{id: goldItemIdOf('pluto'), quantity: 1}];
  rejectsUnchanged(f, () => useTypedStarCard(f.room, f.other, goldItemIdOf('pluto'), NOW), /명왕성/);
  removeStarCard(f.room, f.teacher, id); requireStarCardItemAccess(f.room, f.other, NOW);
});

test('versioned persistence rejects forged state, unknown versions, mismatched choice/XP, duplicate discounts', () => {
  for (const type of ['zodiac', 'saturn', 'pluto']) {
    const f = fixture(); activate(f, type);
    for (const mutate of [s => {s.version = 2;}, s => {s.extra = true;}]) {
      const records = structuredClone(f.room.starCards); mutate(records[0].data.automation);
      assert.throws(() => validateStarCards(records));
    }
  }
  const f = fixture(); activate(f, 'saturn');
  f.room.starCards[0].data.automation.usedItems = ['space-food-card', 'space-food-card'];
  assert.throws(() => validateStarCards(f.room.starCards));
  const z = fixture(); activate(z, 'zodiac');
  z.room.starCards[0].data.automation.choice = 'xp';
  assert.throws(() => validateStarCards(z.room.starCards));
});
