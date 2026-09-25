import test from 'node:test';
import assert from 'node:assert/strict';
import {existsSync, readFileSync} from 'node:fs';
import {STAR_CARD_CATALOG, GOLD_CARD_ITEMS, STAR_CARD_LAYOUT, MAX_STAR_CARDS, goldItemIdOf} from '../shared/star-cards.js';
import {BLACK_HOLE_ID, PLAZA_ID, PLANET, MAP, SHOP, SHARDS, PROGRESSION} from '../shared/config.js';
import {useStarCard, useTypedStarCard, activeStarCards, validateStarCards, removeStarCard, expireStarCards, starCardsDue, STAR_CARD_SLOTS} from '../server/star-cards.js';
import {nextKoreaMidnight} from '../server/item-cards.js';

const NOW = Date.parse('2026-09-21T03:00:00Z'), DAY = 86_400_000;
function fixture(quantity = 1) {
  const player = id => ({id, nickname: id, role: 'student', connected: true,
    avatar: {level: 2, xp: 0, blackStar: null}, inventory: [], starShards: 10,
    cardMarkers: [], effects: [], abilityState: {markers: [], blocks: []}, lastItemUseAt: 0,
    mapId: PLAZA_ID, x: 100, y: 100, input: {x: 0, y: 0, at: 0}});
  const actor = player('a'), other = player('b'), teacher = {...player('teacher'), role: 'teacher'};
  actor.inventory.push({id: 'star-card', quantity});
  return {actor, other, teacher, room: {players: new Map([actor, other, teacher].map(p => [p.id, p])), planets: new Map()}};
}
function use(f, cardId, draws = [], now = NOW) {
  const values = [STAR_CARD_CATALOG.findIndex(card => card.id === cardId), ...draws];
  return useStarCard(f.room, f.actor, now, size => {
    const next = values.shift();
    assert.ok(next >= 0 && next < size, `unexpected draw ${next}/${size}`);
    return next;
  });
}
function rejectUnchanged(f, action, pattern) {
  const before = structuredClone(f.room), actor = f.actor, other = f.other;
  assert.throws(action, pattern);
  assert.deepEqual(f.room, before);
  assert.equal(f.room.players.get(actor.id), actor);
  assert.equal(f.room.players.get(other.id), other);
}
const quantity = (p, id) => p.inventory.find(item => item.id === id)?.quantity || 0;
const marker = (id, extra = {}) => ({id: `marker-${id}`, itemId: id, until: NOW + DAY,
  fromId: 'b', fromNickname: 'b', fromLevel: 2, at: NOW - 10, ...extra});

test('catalog has all 30 original cards, exact source text, explicit durations, and usable typed items', () => {
  assert.equal(STAR_CARD_CATALOG.length, 30);
  assert.equal(new Set(STAR_CARD_CATALOG.map(card => card.id)).size, 30);
  assert.equal(GOLD_CARD_ITEMS.length, 30);
  assert.equal(new Set(GOLD_CARD_ITEMS.map(item => item.id)).size, 30);
  assert.ok(GOLD_CARD_ITEMS.every(item => item.mode === 'star-card' && item.usable && !item.forSale && item.sellPrice === null));
  for (const card of STAR_CARD_CATALOG) {
    const blocks = card.sourceText.trim().split(/\n\s*\n/).map(text => text.trim());
    assert.equal(card.name, blocks[0]);
    assert.equal(card.description, blocks[1]);
    assert.equal(card.effect, blocks.slice(2).join('\n\n'));
    assert.ok([null, 1, 7].includes(card.durationDays));
    assert.ok(card.automatic.length || card.manual.length);
  }
  // The supplied source is optional in other checkouts; never a runtime dependency.
  if (existsSync('.local/gold-source/contents.json')) {
    const source = JSON.parse(readFileSync('.local/gold-source/contents.json', 'utf8'))
      .filter(slide => slide.slide >= 2 && slide.slide <= 6).flatMap(slide => slide.shapes.filter(shape => shape.text.trim()).map(shape => shape.text));
    assert.deepEqual(STAR_CARD_CATALOG.map(card => card.sourceText), source);
  }
  assert.equal(STAR_CARD_LAYOUT.maxCards, 30);
  assert.equal(STAR_CARD_SLOTS.length, 30);
});

for (const card of STAR_CARD_CATALOG) test(`generic star-card can reveal ${card.name} and round-trip its strict record`, () => {
  const f = fixture(2);
  const result = use(f, card.id, [0, 0, 0]);
  assert.equal(result.record.cardId, card.id);
  assert.equal(result.starCard.card.cardId, card.id);
  assert.equal(result.starCard.definition.id, card.id);
  assert.equal(result.starCard.canRemove, false);
  assert.equal(result.starCard.card.slot, result.record.data.slot);
  assert.ok(Number.isFinite(result.starCard.card.x) && Number.isFinite(result.starCard.card.y));
  assert.equal(quantity(f.actor, 'star-card'), 1);
  assert.equal(f.actor.lastItemUseAt, NOW);
  assert.equal(f.room.players.get('a'), f.actor);
  assert.deepEqual(validateStarCards(f.room.starCards), f.room.starCards);
  assert.notEqual(result.record, f.room.starCards[0]);
  result.record.data.slot = 31;
  assert.equal(f.room.starCards[0].data.slot, 0);
});

test('failed membership, ownership, cooldown, item blocks, random values and times are atomic', () => {
  const cases = [
    f => { f.actor.inventory = []; },
    f => { f.actor.inventory[0].quantity = 0; },
    f => { f.actor.connected = false; },
    f => { f.actor.lastItemUseAt = NOW - 1999; },
    f => { f.actor.cardMarkers = [marker('little-sun-card')]; },
    f => { f.actor.cardMarkers = [marker('sun-rabbit-card')]; },
    f => { f.actor.abilityState.blocks = [{until: NOW + 1}]; }
  ];
  for (const setup of cases) {
    const f = fixture(); setup(f);
    rejectUnchanged(f, () => use(f, 'new-life'));
  }
  for (const draw of [-1, 30, 0.5, NaN, Infinity, '0', undefined]) {
    const f = fixture();
    rejectUnchanged(f, () => useStarCard(f.room, f.actor, NOW, () => draw));
  }
  for (const time of [-1, NaN, Infinity, Number.MAX_SAFE_INTEGER, 0.1]) {
    const f = fixture();
    rejectUnchanged(f, () => use(f, 'new-life', [], time));
  }
  const f = fixture();
  rejectUnchanged(f, () => useStarCard(f.room, {...f.actor}, NOW, () => 0));
  f.actor.lastItemUseAt = NOW - 2000;
  use(f, 'new-life');
});

test('expired item blocks do not block, LV1 can use generic and typed cards', () => {
  const f = fixture(); f.actor.avatar.level = 1;
  f.actor.cardMarkers = [marker('sun-rabbit-card', {until: NOW}), marker('little-sun-card', {until: NOW})];
  f.actor.abilityState.blocks = [{until: NOW}];
  use(f, 'new-life');
  f.actor.inventory.push({id: goldItemIdOf('mercury'), quantity: 1});
  const result = useTypedStarCard(f.room, f.actor, goldItemIdOf('mercury'), NOW + 2000);
  assert.equal(result.record.cardId, 'mercury');
});

test('sun tax is collected once and all transferred shards roll back on a later reward failure', () => {
  const f = fixture(2); f.actor.cardMarkers = [marker('sun-card')];
  use(f, 'new-life');
  assert.equal(f.actor.starShards, 9); assert.equal(f.other.starShards, 11);
  f.actor.inventory.find(item => item.id === 'space-food-card').quantity = SHOP.maxStack - 1;
  rejectUnchanged(f, () => use(f, 'new-life', [], NOW + 2000), /수량/);
  f.actor.starShards = 0;
  rejectUnchanged(f, () => use(f, 'comet', [], NOW + 2000), /사용료/);
  f.actor.starShards = 1; f.other.starShards = SHARDS.max;
  rejectUnchanged(f, () => use(f, 'comet', [], NOW + 2000), /더 보낼/);
});

test('food, alien and initial asteroid rewards apply while physical activities remain explicitly manual', () => {
  for (const [cardId, id, count] of [['new-life', 'space-food-card', 2], ['space-food', 'space-food-card', 2],
    ['alien-encounter', 'alien-card', 1], ['asteroid-collision', 'asteroid-card', 1]]) {
    const f = fixture(), result = use(f, cardId);
    assert.equal(quantity(f.actor, id), count);
    assert.equal(result.record.data.status, 'partial');
    assert.ok(result.record.data.manual.length > 0);
    assert.equal(quantity(f.actor, 'meteor-fragment-card'), 0);
  }
});

test('full bag can use its last generic card slot but retaining a stack cannot make room', () => {
  for (const count of [1, 2]) {
    const f = fixture(count);
    while (f.actor.inventory.length < SHOP.maxKinds) f.actor.inventory.push({id: `filler-${f.actor.inventory.length}`, quantity: 1});
    if (count === 1) { use(f, 'new-life'); assert.equal(f.actor.inventory.length, SHOP.maxKinds); }
    else rejectUnchanged(f, () => use(f, 'new-life'), /가방/);
  }
});

test('moon-life and earth sample without replacement, and multi-reward failure rolls everything back', () => {
  for (const [id, count] of [['moon-life', 2], ['earth', 3]]) {
    const f = fixture(), result = use(f, id, Array(count).fill(0));
    assert.equal(result.record.data.rewards.length, count);
    assert.equal(new Set(result.record.data.rewards.map(r => r.itemId)).size, count);
    assert.equal(result.record.data.status, 'automatic');
    const g = fixture(2);
    g.actor.inventory.push({id: id === 'moon-life' ? 'moon-rabbit-card' : 'space-food-card', quantity: SHOP.maxStack});
    rejectUnchanged(g, () => use(g, id, Array(count).fill(0)), /수량/);
    const h = fixture();
    let draw = 0;
    rejectUnchanged(h, () => useStarCard(h.room, h.actor, NOW, () => draw++ === 0 ? STAR_CARD_CATALOG.findIndex(c => c.id === id) : draw === 2 ? 0 : -1));
  }
});

test('black hole clears all planets and students including offline users, preserves warning history and returns trapped users', () => {
  const f = fixture();
  f.other.connected = false;
  for (const p of [f.actor, f.other]) { p.avatar.blackStar = {planetId: 'p1', at: NOW - 1}; p.mapId = BLACK_HOLE_ID; }
  for (const id of ['p1', 'p2']) f.room.planets.set(id, {id, warnings: {threshold: 3, entries: [
    {targetId: 'a', active: true}, {targetId: 'b', active: true}, {targetId: 'deleted', active: true}, {targetId: 'a', active: false}
  ]}});
  const planet = f.room.planets.get('p1');
  const result = use(f, 'black-hole');
  assert.equal(result.record.data.warningsCleared, 6);
  assert.equal(result.record.data.blackStarsCleared, 2);
  for (const p of [f.actor, f.other]) { assert.equal(p.avatar.blackStar, null); assert.equal(p.mapId, PLAZA_ID); }
  assert.equal(f.room.planets.get('p1'), planet);
  for (const p of f.room.planets.values()) { assert.equal(p.warnings.entries.length, 4); assert.ok(p.warnings.entries.every(e => !e.active)); }
});

test('zodiac preserves constellation OR XP choice without rolling dice or awarding XP/shards', () => {
  for (const level of [1, 2, PROGRESSION.transcendentLevel]) {
    const f = fixture(); f.actor.starShards = SHARDS.max;
    f.actor.avatar = {level, xp: 0, constellationId: 'aries'};
    const avatar = structuredClone(f.actor.avatar);
    const result = use(f, 'zodiac'); // Only the generic card selection may draw.
    assert.deepEqual(f.actor.avatar, avatar);
    assert.equal(f.actor.starShards, SHARDS.max);
    assert.equal(result.record.data.xp, 0);
    assert.equal(result.record.data.shards, 0);
    assert.equal(result.record.data.roll, null);
    assert.equal(result.record.data.status, 'automatic');
    assert.equal(result.record.data.automation.choice, null);
    assert.match(result.record.data.automatic.join(' '), /변경 또는/);
  }
});

for (let roll = 1; roll <= 10; roll++) test(`planet exploration roll ${roll} gives a usable typed card or capped galaxy`, () => {
  const f = fixture(), result = use(f, 'planet-exploration', [roll - 1]);
  const rewardId = result.record.data.rewards[0].itemId;
  assert.equal(quantity(f.actor, rewardId), 1);
  if (roll === 10) {
    assert.equal(rewardId, 'galaxy-card');
    assert.deepEqual(f.actor.lv2State.galaxyNextAt, [NOW + 7 * DAY]);
  } else {
    assert.ok(GOLD_CARD_ITEMS.some(item => item.id === rewardId));
    const typed = useTypedStarCard(f.room, f.actor, rewardId, NOW + 2000, () => 0);
    assert.equal(typed.record.cardId, ['mercury', 'venus', 'earth', 'mars', 'jupiter', 'saturn', 'uranus', 'neptune', 'pluto'][roll - 1]);
    assert.equal(quantity(f.actor, rewardId), 0);
  }
});

test('galaxy max-owned rule, invalid typed IDs and unowned types cannot consume a generic card', () => {
  const f = fixture(); f.actor.inventory.push({id: 'galaxy-card', quantity: 2});
  rejectUnchanged(f, () => use(f, 'planet-exploration', [9]), /최대 2개/);
  rejectUnchanged(f, () => useTypedStarCard(f.room, f.actor, goldItemIdOf('earth'), NOW), /가방/);
  rejectUnchanged(f, () => useTypedStarCard(f.room, f.actor, 'earth', NOW), /종류/);
  rejectUnchanged(f, () => useTypedStarCard(f.room, f.actor, {id: goldItemIdOf('earth')}, NOW), /종류/);
});

test('all 30 typed catalog entries can be activated without randomizing the card type', () => {
  for (const item of GOLD_CARD_ITEMS) {
    const f = fixture(); f.actor.inventory = [{id: item.id, quantity: 1}];
    const result = useStarCard(f.room, f.actor, NOW, () => 0, item.id);
    assert.equal(result.record.cardId, item.cardId);
    assert.equal(quantity(f.actor, item.id), 0);
  }
});

test('30 stable centered slots avoid pillars and fit reserved area, full board rejects, removal reuses only the free slot', () => {
  const f = fixture(MAX_STAR_CARDS + 1);
  for (let i = 0; i < MAX_STAR_CARDS; i++) use(f, 'rest', [], NOW + i * 2000);
  const views = activeStarCards(f.room, NOW + DAY);
  assert.equal(views.length, MAX_STAR_CARDS);
  const reserved = PLANET.reserved.find(area => area.label === '별들의 신전');
  for (const view of views) {
    assert.ok(view.x - view.width / 2 >= reserved.x && view.x + view.width / 2 <= reserved.x + reserved.width);
    assert.ok(view.y - view.height / 2 >= reserved.y && view.y + view.height / 2 <= reserved.y + reserved.height);
    assert.equal(view.width, 66); assert.equal(view.height, 90); assert.equal(view.mapId, MAP.id);
    assert.equal(view.slot, view.data.slot);
    for (const pillar of MAP.objects.filter(object => object.kind === 'pillar')) {
      assert.ok(Math.hypot(view.x - pillar.x, view.y - pillar.y) >= 80);
    }
    assert.equal(view.inventory, undefined);
  }
  assert.equal(new Set(views.map(view => `${view.x},${view.y}`)).size, MAX_STAR_CARDS);
  rejectUnchanged(f, () => use(f, 'rest', [], NOW + DAY), /가득/);
  const id = f.room.starCards[3].id;
  rejectUnchanged(f, () => removeStarCard(f.room, f.actor, id), /선생님/);
  rejectUnchanged(f, () => removeStarCard(f.room, {...f.teacher}, id), /선생님/);
  removeStarCard(f.room, f.teacher, id);
  const before = activeStarCards(f.room, NOW + DAY);
  const result = use(f, 'rest', [], NOW + DAY);
  assert.equal(result.record.data.slot, 3);
  assert.deepEqual(activeStarCards(f.room, NOW + DAY).filter(view => view.id !== result.record.id), before);
  assert.equal(quantity(f.actor, 'star-card'), 0);
});

test('public views and returned records are detached; manual duration remains until teacher removal with no refund', () => {
  const f = fixture(); use(f, 'new-life');
  const views = activeStarCards(f.room, NOW + 365 * DAY);
  assert.equal(views[0].expiresAt, null);
  views[0].data.manual.length = 0;
  assert.ok(f.room.starCards[0].data.manual.length);
  removeStarCard(f.room, f.teacher, f.room.starCards[0].id);
  assert.equal(quantity(f.actor, 'space-food-card'), 2);
  assert.equal(quantity(f.actor, 'star-card'), 0);
  assert.deepEqual(activeStarCards(f.room, NOW), []);
});

test('known one-day/seven-day boundaries expire exclusively, manual polaris has no hidden scheduled payouts', () => {
  for (const id of ['comet', 'mercury', 'jupiter', 'uranus', 'pluto', 'polaris', 'launch', 'wormhole']) {
    const f = fixture(), result = use(f, id), end = result.record.expiresAt;
    assert.equal(end, result.card.durationDays === 1 ? nextKoreaMidnight(NOW) : NOW + 7 * DAY);
    assert.equal(activeStarCards(f.room, end - 1).length, 1);
    assert.equal(starCardsDue(f.room, end - 1), false);
    assert.equal(expireStarCards(f.room, end - 1), false);
    assert.equal(activeStarCards(f.room, end).length, 0);
    assert.equal(starCardsDue(f.room, end), true);
    assert.equal(validateStarCards(f.room.starCards).length, 1);
    assert.equal(expireStarCards(f.room, end), true);
    assert.equal(expireStarCards(f.room, end), false);
    assert.equal(f.actor.starShards, 10);
    if (id === 'polaris') {
      assert.equal(result.record.data.status, 'manual');
      assert.match(result.record.data.manual[0], /자동 지급하지 않아요/);
    }
  }
});

test('activation prunes expired records transactionally and reuses a slot without moving survivors', () => {
  const f = fixture(3);
  use(f, 'comet'); use(f, 'rest', [], NOW + 2000);
  const surviving = activeStarCards(f.room, NOW + DAY)[0];
  use(f, 'new-life', [], NOW + DAY);
  assert.deepEqual(activeStarCards(f.room, NOW + DAY)[0], surviving);
  assert.equal(f.room.starCards[1].data.slot, 0);
});

test('strict persistence rejects duplicate slots/ids, foreign keys, forged states/outcomes/times and retains valid data', () => {
  const f = fixture(); use(f, 'new-life');
  const good = f.room.starCards;
  assert.deepEqual(validateStarCards(undefined), []);
  for (const value of [null, {}, 1, [null], Array(33).fill(good[0])]) assert.throws(() => validateStarCards(value));
  const corruptions = [
    r => { r.extra = true; }, r => { r.id = ''; }, r => { r.userId = ''; }, r => { r.userNickname = 'x'.repeat(13); },
    r => { r.cardId = 'missing'; }, r => { r.createdAt = -1; }, r => { r.expiresAt = NOW + DAY; },
    r => { r.data.slot = 32; }, r => { r.data.slot = 0.5; }, r => { r.data.status = 'automatic'; },
    r => { r.data.manual = []; }, r => { r.data.automatic = ['fake']; }, r => { r.data.hidden = {}; },
    r => { r.data.rewards[0].quantity = 1; }, r => { r.data.rewards[0].itemId = 'alien-card'; },
    r => { r.data.roll = 1; }, r => { r.data.xp = 1; }, r => { r.data.shards = 1; },
    r => { r.data.warningsCleared = 1; }, r => { r.data.blackStarsCleared = 1; }
  ];
  for (const corrupt of corruptions) {
    const value = structuredClone(good); corrupt(value[0]); assert.throws(() => validateStarCards(value));
  }
  const dup = structuredClone(good[0]);
  assert.throws(() => validateStarCards([...good, dup]));
  dup.id = 'other'; assert.throws(() => validateStarCards([...good, dup]));
  dup.data.slot = 1; assert.equal(validateStarCards([...good, dup]).length, 2);
  const result = validateStarCards(good); result[0].data.slot = 1;
  assert.equal(good[0].data.slot, 0);
});

test('forged zodiac totals and planet exploration result mismatches are rejected', () => {
  const z = fixture(); use(z, 'zodiac', [0]);
  z.room.starCards[0].data.xp++;
  assert.throws(() => validateStarCards(z.room.starCards));
  const p = fixture(); use(p, 'planet-exploration', [0]);
  p.room.starCards[0].data.roll = 2;
  assert.throws(() => validateStarCards(p.room.starCards));
});
