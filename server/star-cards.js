import {randomInt, randomUUID} from 'node:crypto';
import {ITEM_USE, MAP, SHOP, SHARDS} from '../shared/config.js';
import {STAR_CARD_CATALOG, GOLD_CARD_ITEMS, STAR_CARD_LAYOUT, STAR_CARD_ART, MAX_STAR_CARDS, starCardOf, goldItemIdOf} from '../shared/star-cards.js';
import {ensure} from './rooms.js';
import {hasCardStatus, nextKoreaMidnight} from './item-cards.js';
import {activeItemBlocks} from './constellation-abilities.js';
import {hasLv2ItemBlock, collectSunTax, acquireGalaxy} from './lv2-item-effects.js';
import {clearBlackStar} from './warnings.js';

const DAY = 86_400_000;
const PLANETS = ['mercury', 'venus', 'earth', 'mars', 'jupiter', 'saturn', 'uranus', 'neptune', 'pluto'];
const MOON_ITEMS = ['moon-card', 'moon-rabbit-card', 'little-moon-card', 'alien-card', 'spaceman-card'];
const EARTH_ITEMS = ['space-suit-card', 'space-food-card', 'satellite-card', 'spaceship-card'];
const foodCards = ['new-life', 'space-food'];
const statusOf = card => card.automatic.length ? (card.manual.length ? 'partial' : 'automatic') : 'manual';
const active = (record, now) => record.expiresAt === null || record.expiresAt > now;
const validTime = now => ensure(Number.isSafeInteger(now) && now >= 0 && now <= Number.MAX_SAFE_INTEGER - 7 * DAY, '별 카드 사용 시각이 올바르지 않아요.');
const int = (n, min, max) => Number.isSafeInteger(n) && n >= min && n <= max;
const text = (s, max) => typeof s === 'string' && s.trim().length > 0 && s.length <= max;
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const exactKeys = (value, keys) => value && typeof value === 'object' && !Array.isArray(value) &&
  Object.keys(value).length === keys.length && keys.every(key => Object.hasOwn(value, key));

// One-day cards end at Korean midnight, matching other classroom card effects.
// Unspecified durations (including immediate effects) remain for teacher removal.
function expiresAt(card, now) {
  return card.durationDays === null ? null : card.durationDays === 1 ? nextKoreaMidnight(now) : now + card.durationDays * DAY;
}

function pick(chooseIndex, size) {
  const value = chooseIndex(size);
  ensure(int(value, 0, size - 1), '별 카드 추첨 결과가 올바르지 않아요.');
  return value;
}

function giveItem(player, itemId, quantity = 1) {
  const item = GOLD_CARD_ITEMS.find(item => item.id === itemId) || SHOP.items.find(item => item.id === itemId);
  ensure(item, '등록되지 않은 별 카드 보상이에요.');
  const owned = player.inventory.find(item => item.id === itemId);
  ensure((owned?.quantity || 0) + quantity <= Math.min(item.maxOwned ?? SHOP.maxStack, SHOP.maxStack), '보상 아이템 수량을 더 담을 수 없어요.');
  ensure(owned || player.inventory.length < SHOP.maxKinds, '보상 아이템을 담을 가방 칸이 부족해요.');
  if (owned) owned.quantity += quantity;
  else player.inventory.push({id: itemId, quantity});
}

// Keep socket session player references and existing planet references intact.
// All work is isolated, including warnings/movement, tax and random draws.
function draftOf(room) {
  return {...room, players: new Map([...room.players].map(([id, p]) => [id, structuredClone(p)])),
    planets: new Map([...room.planets].map(([id, p]) => [id, structuredClone(p)])),
    starCards: validateStarCards(room.starCards)};
}
function commit(room, draft) {
  for (const [id, p] of draft.players) Object.assign(room.players.get(id), p);
  for (const [id, p] of draft.planets) Object.assign(room.planets.get(id), p);
  room.starCards = draft.starCards;
}

function applyEffect(room, player, card, now, chooseIndex, data) {
  const reward = (id, quantity = 1) => {
    giveItem(player, id, quantity);
    data.rewards.push({itemId: id, quantity});
  };
  const sample = (ids, quantity) => {
    const pool = [...ids];
    for (let i = 0; i < quantity; i++) reward(pool.splice(pick(chooseIndex, pool.length), 1)[0]);
  };
  if (foodCards.includes(card.id)) reward('space-food-card', 2);
  else if (card.id === 'alien-encounter') reward('alien-card');
  else if (card.id === 'asteroid-collision') reward('asteroid-card');
  else if (card.id === 'moon-life') sample(MOON_ITEMS, 2);
  else if (card.id === 'earth') sample(EARTH_ITEMS, 3);
  else if (card.id === 'black-hole') {
    for (const planet of room.planets.values()) data.warningsCleared += (planet.warnings?.entries || []).filter(e => e.active).length;
    for (const target of room.players.values()) if (target.role === 'student' && target.avatar.blackStar) {
      clearBlackStar(room, target);
      data.blackStarsCleared++;
    }
    // Include warnings for disconnected/deleted targets, preserving the history.
    for (const planet of room.planets.values()) for (const entry of planet.warnings?.entries || []) entry.active = false;
  } else if (card.id === 'planet-exploration') {
    data.roll = pick(chooseIndex, 10) + 1;
    if (data.roll === 10) {
      acquireGalaxy(player, 1, now);
      data.rewards.push({itemId: 'galaxy-card', quantity: 1});
    } else reward(goldItemIdOf(PLANETS[data.roll - 1]));
  }
}

// Both entry points must run inside the main app's persistent transaction.
// chooseIndex is a SERVER-ONLY injectable (exclusive upper bound, zero-based).
// Do not pass it or the selected card type from an untrusted client for generic use.
export function useStarCard(room, player, now = Date.now(), chooseIndex = randomInt, itemId = 'star-card') {
  if (itemId !== 'star-card') return useTypedStarCard(room, player, itemId, now, chooseIndex);
  return activate(room, player, 'star-card', null, now, chooseIndex);
}
export function useTypedStarCard(room, player, itemId, now = Date.now(), chooseIndex = randomInt) {
  const item = GOLD_CARD_ITEMS.find(item => item.id === itemId);
  ensure(item, '별 카드 종류를 확인해주세요.');
  return activate(room, player, item.id, starCardOf(item.cardId), now, chooseIndex);
}

function activate(room, player, itemId, selectedCard, now, chooseIndex) {
  validTime(now);
  ensure(player && room.players.get(player.id) === player && player.connected, '먼저 교실에 입장해주세요.');
  ensure(['student', 'teacher'].includes(player.role) && player.avatar?.level >= 1, '사용자를 확인해주세요.');
  const owned = player.inventory?.find(item => item.id === itemId);
  ensure(owned && int(owned.quantity, 1, SHOP.maxStack), '가방에 그 별 카드가 없어요.');
  ensure(!hasCardStatus(player, 'little-sun-card', now), '자외선 상태에서는 아이템을 사용할 수 없어요.');
  ensure(!hasLv2ItemBlock(player, now) && !activeItemBlocks(player, now).length, '지금은 아이템을 사용할 수 없어요.');
  ensure(now - (player.lastItemUseAt ?? 0) >= ITEM_USE.cooldownMs, '조금 천천히 써요.');
  ensure(int(player.starShards, 0, SHARDS.max), '별 파편 상태를 확인해주세요.');
  const draft = draftOf(room);
  draft.starCards = draft.starCards.filter(record => active(record, now));
  ensure(draft.starCards.length < MAX_STAR_CARDS, '신전의 별 카드 자리가 가득 찼어요. 선생님께 완료 카드를 정리해 달라고 해주세요.');
  const actor = draft.players.get(player.id);
  const tax = collectSunTax(draft, actor, now);
  const card = selectedCard || STAR_CARD_CATALOG[pick(chooseIndex, STAR_CARD_CATALOG.length)];
  const inventoryItem = actor.inventory.find(item => item.id === itemId);
  inventoryItem.quantity--;
  actor.inventory = actor.inventory.filter(item => item.quantity > 0);
  const usedSlots = new Set(draft.starCards.map(record => record.data.slot));
  const slot = Array.from({length: MAX_STAR_CARDS}, (_, i) => i).find(i => !usedSlots.has(i));
  const data = {slot, status: statusOf(card), automatic: [...card.automatic], manual: [...card.manual],
    rewards: [], roll: null, xp: 0, shards: 0, warningsCleared: 0, blackStarsCleared: 0};
  applyEffect(draft, actor, card, now, chooseIndex, data);
  const record = {id: randomUUID(), cardId: card.id, userId: actor.id, userNickname: actor.nickname,
    createdAt: now, expiresAt: expiresAt(card, now), data};
  draft.starCards.push(record);
  validateStarCards(draft.starCards);
  actor.lastItemUseAt = now;
  commit(room, draft);
  return {message: `${card.name} 별 카드를 공개했어요.${card.manual.length ? ' 선생님 확인이 필요한 효과가 있어요.' : ' 자동 효과를 적용했어요.'}`,
    record: structuredClone(record), card: structuredClone(card), targetIds: [player.id], tax,
    starCard: {card: publicRecord(record), definition: structuredClone(card), canRemove: false}};
}

// Candidate centers stay in the reserved 900x700 temple area. Filter the actual
// map's pillars, then retain the nearest 30 centers. Record slots never shift
// when another record expires or is removed. Recompute only on module load.
export const STAR_CARD_SLOTS = Object.freeze(Array.from({length: STAR_CARD_LAYOUT.columns * STAR_CARD_LAYOUT.rows}, (_, index) => ({
  x: MAP.templeCenter.x + (index % STAR_CARD_LAYOUT.columns - (STAR_CARD_LAYOUT.columns - 1) / 2) * STAR_CARD_LAYOUT.spacingX,
  y: 450 + Math.floor(index / STAR_CARD_LAYOUT.columns) * STAR_CARD_LAYOUT.spacingY
})).filter(point => MAP.objects.filter(object => object.kind === 'pillar').every(pillar =>
  Math.hypot(point.x - pillar.x, point.y - pillar.y) >= STAR_CARD_LAYOUT.minPillarDistance))
  .sort((a, b) => (a.x - MAP.templeCenter.x) ** 2 + (a.y - 720) ** 2 -
    (b.x - MAP.templeCenter.x) ** 2 - (b.y - 720) ** 2 || a.y - b.y || a.x - b.x)
  .slice(0, MAX_STAR_CARDS).map(Object.freeze));

function publicRecord(record) {
  const card = starCardOf(record.cardId), position = STAR_CARD_SLOTS[record.data.slot];
  return {...structuredClone(record), slot: record.data.slot, name: card.name, description: card.description, effect: card.effect,
    durationDays: card.durationDays, mapId: MAP.id, ...position,
    width: STAR_CARD_LAYOUT.width, height: STAR_CARD_LAYOUT.height, art: STAR_CARD_ART.face, backArt: STAR_CARD_ART.back};
}

// Public read-only projection: suitable for every student and the teacher.
// x/y is the card's center; no inventory, warning reasons or secret recipes leak.
export function activeStarCards(room, now = Date.now()) {
  validTime(now);
  return validateStarCards(room.starCards).filter(record => active(record, now)).map(publicRecord);
}

export function removeStarCard(room, teacher, id) {
  ensure(teacher && room.players.get(teacher.id) === teacher && teacher.connected && teacher.role === 'teacher', '선생님만 별 카드를 정리할 수 있어요.');
  const records = validateStarCards(room.starCards);
  const record = records.find(record => record.id === id);
  ensure(record, '정리할 별 카드를 찾을 수 없어요.');
  room.starCards = records.filter(record => record.id !== id);
  return {record: structuredClone(record), message: '별 카드 표시를 정리했어요. 이미 지급한 보상은 유지돼요.'};
}

// Pure due predicate + mutation helper for main's persist-on-change timer.
// There are deliberately no scheduled payouts; conditional rewards are manual.
export function starCardsDue(room, now = Date.now()) {
  validTime(now);
  return validateStarCards(room.starCards).some(record => !active(record, now));
}
export function expireStarCards(room, now = Date.now()) {
  validTime(now);
  const records = validateStarCards(room.starCards), remaining = records.filter(record => active(record, now));
  if (remaining.length === records.length) return false;
  room.starCards = remaining;
  return true;
}

function validOutcome(card, data) {
  const ids = data.rewards.map(reward => reward.itemId);
  const fixedReward = (id, quantity) => same(data.rewards, [{itemId: id, quantity}]);
  let rewardOK = data.rewards.length === 0;
  if (foodCards.includes(card.id)) rewardOK = fixedReward('space-food-card', 2);
  else if (card.id === 'alien-encounter') rewardOK = fixedReward('alien-card', 1);
  else if (card.id === 'asteroid-collision') rewardOK = fixedReward('asteroid-card', 1);
  else if (card.id === 'moon-life' || card.id === 'earth') {
    const pool = card.id === 'moon-life' ? MOON_ITEMS : EARTH_ITEMS;
    rewardOK = ids.length === (card.id === 'moon-life' ? 2 : 3) && new Set(ids).size === ids.length &&
      ids.every(id => pool.includes(id)) && data.rewards.every(reward => reward.quantity === 1);
  } else if (card.id === 'planet-exploration') {
    rewardOK = int(data.roll, 1, 10) && fixedReward(data.roll === 10 ? 'galaxy-card' : goldItemIdOf(PLANETS[data.roll - 1]), 1);
  }
  const xpOK = data.xp === 0 && data.shards === 0;
  const rollOK = card.id === 'planet-exploration' || data.roll === null;
  const clearedOK = card.id === 'black-hole' || (data.warningsCleared === 0 && data.blackStarsCleared === 0);
  return rewardOK && xpOK && rollOK && clearedOK;
}

// Validate, clone, and KEEP expired rows. Loading must not silently prune state
// outside the persistence transaction. No wall clock dependence in validation.
export function validateStarCards(value) {
  if (value === undefined) return [];
  const fail = () => { throw new Error('별 카드 저장 데이터가 올바르지 않습니다.'); };
  if (!Array.isArray(value) || value.length > MAX_STAR_CARDS) fail();
  const ids = new Set(), slots = new Set();
  for (const record of value) {
    if (!exactKeys(record, ['id', 'cardId', 'userId', 'userNickname', 'createdAt', 'expiresAt', 'data'])) fail();
    const card = starCardOf(record.cardId), data = record.data;
    if (!card || !text(record.id, 128) || ids.has(record.id) || !text(record.userId, 128) || !text(record.userNickname, 12) ||
      !int(record.createdAt, 0, Number.MAX_SAFE_INTEGER - 7 * DAY) || record.expiresAt !== expiresAt(card, record.createdAt)) fail();
    if (!exactKeys(data, ['slot', 'status', 'automatic', 'manual', 'rewards', 'roll', 'xp', 'shards', 'warningsCleared', 'blackStarsCleared']) ||
      !int(data.slot, 0, MAX_STAR_CARDS - 1) || slots.has(data.slot) || data.status !== statusOf(card) ||
      !same(data.automatic, card.automatic) || !same(data.manual, card.manual) ||
      !Array.isArray(data.rewards) || data.rewards.length > 3 || data.rewards.some(reward =>
        !exactKeys(reward, ['itemId', 'quantity']) || !text(reward.itemId, 80) || !int(reward.quantity, 1, 2)) ||
      !int(data.xp, 0, 10) || !int(data.shards, 0, 10) || !int(data.warningsCleared, 0, Number.MAX_SAFE_INTEGER) ||
      !int(data.blackStarsCleared, 0, Number.MAX_SAFE_INTEGER) || !validOutcome(card, data)) fail();
    ids.add(record.id); slots.add(data.slot);
  }
  return structuredClone(value);
}
