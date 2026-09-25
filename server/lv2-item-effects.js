import {randomInt} from 'node:crypto';
import {hasUnlimitedShards} from '../shared/economy.js';
import {ITEM_USE, SHARDS, SHOP} from '../shared/config.js';
import {LV2_ITEMS} from '../shared/lv2-items.js';
import {addCardMarker, hasCardStatus, MAX_CARD_MARKERS, hasItemImmunity} from './item-cards.js';
import {activeItemBlocks} from './constellation-abilities.js';
import {clearBlackStar} from './warnings.js';
import {ensure as fail} from './rooms.js';

const DAY = 86_400_000;
const WEEK = 7 * DAY;
const KST = 9 * 3_600_000;
const levelOf = p => p.role === 'teacher' ? ITEM_USE.teacherLevel : p.avatar.level;
const active = (marker, now) => marker.until === null || marker.until > now;
const count = (p, id) => p.inventory.find(entry => entry.id === id)?.quantity || 0;
const catalogueItem = item => LV2_ITEMS.find(entry => entry.id === (typeof item === 'string' ? item : item?.id));
const validNow = now => fail(Number.isSafeInteger(now) && now >= 0 && now <= Number.MAX_SAFE_INTEGER - 2 * WEEK, '사용 시각이 올바르지 않습니다.');

// Persistence contract (main owns validators):
// - cardMarkers keep existing id/itemId/fromId/fromNickname/note fields plus
//   finite until, at (nonnegative safe timestamp), fromLevel (integer 1..6),
//   spaceman remainingUses (0..3), and sun-rabbit pendingGrant (optional boolean).
// - Retain expired sun-rabbit markers on load/generic pruning until settled;
//   preserving all LV2 markers until settleLv2Items is also safe.
// - lv2State defaults to {galaxyNextAt: []}; entries are nonnegative safe
//   timestamps, in acquisition order, at most two. Do not sort them by due date.
// - Teacher completion decrements spaceman remainingUses once per action; remove
//   at zero (or call settle). Other markers follow the existing completion flow.
// - star-card is an inventory-only placeholder; no star-card subtype/effect here.

// Integration: persist lv2State.galaxyNextAt (0..2 acquisition-anchored timestamps).
// Call after EVERY inventory change (buy/craft/give/trade/sell/use). Existing cards
// without state start their first week now; elapsed ownership cannot be inferred.
// Removing a card removes the newest anchor; a new card never inherits that week.
export function syncGalaxyHoldings(player, now = Date.now()) {
  validNow(now);
  const quantity = Math.min(2, count(player, 'galaxy-card'));
  const previous = player.lv2State?.galaxyNextAt || [];
  const next = previous.slice(0, quantity);
  while (next.length < quantity) next.push(now + WEEK);
  if (JSON.stringify(previous) === JSON.stringify(next)) return false;
  player.lv2State = {...player.lv2State, galaxyNextAt: next};
  return true;
}

export function canPurchaseLv2Item(player, item, quantity = 1) {
  const card = catalogueItem(item);
  return !!card && Number.isSafeInteger(quantity) && quantity > 0 &&
    count(player, card.id) + quantity <= Math.min(SHOP.maxStack, card.maxOwned ?? SHOP.maxStack) &&
    (count(player, card.id) > 0 || player.inventory.length < SHOP.maxKinds);
}

// Atomic inventory acquisition only: caller owns price/permission checks.
export function acquireGalaxy(player, quantity = 1, now = Date.now()) {
  validNow(now);
  fail(canPurchaseLv2Item(player, 'galaxy-card', quantity), '은하수는 최대 2개까지 보유할 수 있으며 가방에 빈칸이 필요해요.');
  syncGalaxyHoldings(player, now);
  giveItem(player, 'galaxy-card', quantity);
  syncGalaxyHoldings(player, now);
}

function fits(player, id, quantity = 1) {
  return count(player, id) + quantity <= SHOP.maxStack &&
    (count(player, id) > 0 || player.inventory.length < SHOP.maxKinds);
}

function giveItem(player, id, quantity = 1) {
  fail(fits(player, id, quantity), '보상 아이템을 담을 가방 칸이나 수량 여유가 부족해요.');
  const entry = player.inventory.find(value => value.id === id);
  if (entry) entry.quantity += quantity;
  else player.inventory.push({id, quantity});
}

export function hasLv2ItemBlock(player, now = Date.now()) {
  return (player.cardMarkers || []).some(marker => marker.itemId === 'sun-rabbit-card' && active(marker, now));
}

function sunWinner(player, now) {
  // One controlling effect per target; legacy duplicate markers cannot double tax.
  return (player.cardMarkers || []).filter(marker => ['sun-card','total-eclipse-card'].includes(marker.itemId) && active(marker, now))
    .reduce((best, marker) => !best || (marker.fromLevel || 0) > (best.fromLevel || 0) ||
      ((marker.fromLevel || 0) === (best.fromLevel || 0) && (marker.at || 0) >= (best.at || 0)) ? marker : best, null);
}

// Call once per successful LV1/draw use inside its transaction, AFTER validation
// and BEFORE its effect. useLv2Item already calls this; do not charge it twice.
// Draw card selection is completion of that use, not a second taxable use.
export function collectSunTax(room, actor, now = Date.now()) {
  validNow(now);
  fail(room.players.get(actor.id) === actor, '교실의 사용자를 확인해주세요.');
  if (hasUnlimitedShards(actor)) return {amount: 0, ownerIds: []};
  const marker = sunWinner(actor, now);
  const owner = marker && room.players.get(marker.fromId);
  fail(marker?.itemId!=='total-eclipse-card'||(owner&&owner.id!==actor.id), '개기 일식 사용자를 찾지 못했어요. 선생님께 금지 효과 확인을 요청해주세요.');
  if (!owner || owner.id === actor.id) return {amount: 0, ownerIds: []};
  fail(actor.starShards >= 1, (marker.itemId==='total-eclipse-card'?'개기 일식 금지 상태입니다. 이번 한 번을 허용받을 ':'해 효과의 ')+'사용료 별 파편 1개가 부족해요.');
  fail(owner.starShards < SHARDS.max, '해 효과 사용자에게 별 파편을 더 보낼 수 없어요.');
  actor.starShards--;
  owner.starShards++;
  return {amount: 1, ownerIds: [owner.id]};
}

// Exclusive midnight boundary: Thursday -> Friday end; Friday -> Monday end;
// Saturday/Sunday -> next Friday end. This is a weekday calendar, not a holiday
// or school-calendar calculation (neither calendar was provided).
export function androidDueAt(now = Date.now()) {
  validNow(now);
  const dayStart = Math.floor((now + KST) / DAY) * DAY - KST;
  const weekday = new Date(now + KST).getUTCDay();
  const days = weekday === 5 ? 3 : (5 - weekday + 7) % 7;
  return dayStart + (days + 1) * DAY;
}

function recipients(room, actor, item, data) {
  let ids;
  if (Array.isArray(data.targetIds)) ids = data.targetIds;
  else ids = [data.targetId, data.secondTargetId, data.thirdTargetId].filter(id => id !== undefined);
  if (item.targets === 'self' && ids.length === 0) ids = [actor.id];
  if (item.id === 'spaceship-card' && ids.length === 1 && ids[0] !== actor.id) ids = [actor.id, ...ids];
  const spaceship = item.id === 'spaceship-card';
  const expected = item.targets === 'three' ? 3 : item.targets === 'pair' || spaceship ? 2 : 1;
  fail(ids.length === expected && new Set(ids).size === expected && ids.every(id => typeof id === 'string'), '서로 다른 사용 대상을 골라주세요.');
  const targets = ids.map(id => room.players.get(id));
  fail(targets.every(p => p?.connected), '그 친구는 지금 없어요.');
  if (item.targets === 'self') fail(ids[0] === actor.id, '이 물건은 나에게만 쓸 수 있어요.');
  if ((item.targets === 'other' && !spaceship) || item.targets === 'three') fail(targets.every(p => p.id !== actor.id && p.role === 'student'), '다른 학생 친구를 골라주세요.');
  if (item.targets === 'pair' || spaceship) fail(targets.every(p => p.role === 'student'), '학생 친구 2명을 골라주세요.');
  if (item.id === 'spaceship-card') fail(ids.includes(actor.id), '우주선은 나와 친구에게 함께 사용해요.');
  for (const target of targets) {
    fail(levelOf(actor) >= levelOf(target), '나보다 레벨이 높은 친구에게는 쓸 수 없어요.');
    fail(!hasCardStatus(target, 'little-moon-card', data.now) && !hasItemImmunity(target, data.now), '꼬마 달 보호 중에는 다른 카드 효과를 받지 않아요.');
  }
  return targets;
}

function mark(player, item, actor, now, until, note, extra = {}) {
  // Never silently discard an expired rabbit whose reward is still owed.
  player.cardMarkers = (player.cardMarkers || []).filter(marker => active(marker, now) || marker.itemId === 'sun-rabbit-card');
  fail(player.cardMarkers.length < MAX_CARD_MARKERS, '사용 중인 카드 기록이 가득 찼어요. 선생님께 알려주세요.');
  return Object.assign(addCardMarker(player, item, actor, until, note), {at: now, fromLevel: levelOf(actor)}, extra);
}

export function useLv2Item(room, actor, item, data = {}, now = Date.now(), die = () => randomInt(1, 7)) {
  validNow(now);
  const card = catalogueItem(item); // Ignore caller-supplied levels/targets/modes.
  fail(card?.mode === 'lv2', 'LV2 아이템을 확인해주세요.');
  fail(room.players.get(actor.id) === actor && actor.connected, '먼저 교실에 입장해주세요.');
  fail(count(actor, card.id) > 0, '가방에 그 물건이 없어요.');
  fail(levelOf(actor) >= 2, 'LV2부터 사용할 수 있어요.');
  fail(!hasCardStatus(actor, 'little-sun-card', now), '자외선 상태에서는 아이템을 사용할 수 없어요.');
  fail(!hasLv2ItemBlock(actor, now) && !activeItemBlocks(actor, now).length, '지금은 아이템을 사용할 수 없어요.');
  fail(now - (actor.lastItemUseAt ?? 0) >= ITEM_USE.cooldownMs, '조금 천천히 써요.');
  const targets = recipients(room, actor, card, {...data, now});
  if (card.id === 'moon-card') fail(!actor.avatar.blackStar, '검은별 상태에서는 달을 사용할 수 없어요.');
  if (card.id === 'asteroid-card') fail(actor.role === 'student' && actor.avatar.blackStar, '검은별 상태에서 사용할 수 있어요.');

  // Player object identities survive commit because socket sessions reference them.
  // No live mutation occurs until every target, tax and reward has succeeded.
  const draft = {...room, players: new Map([...room.players].map(([id, p]) => [id, structuredClone(p)]))};
  const user = draft.players.get(actor.id);
  const selected = targets.map(p => draft.players.get(p.id));
  collectSunTax(draft, user, now);
  syncGalaxyHoldings(user, now);
  const owned = user.inventory.find(entry => entry.id === card.id);
  owned.quantity--;
  user.inventory = user.inventory.filter(entry => entry.quantity > 0);
  user.lastItemUseAt = now;
  let roll;
  let message = `${card.name}을 사용했어요.`;
  switch (card.id) {
    case 'asteroid-card':
      draft.planets = new Map([...room.planets].map(([id, planet]) => [id, structuredClone(planet)]));
      clearBlackStar(draft, user);
      message = '검은별과 해당 경고를 해제했어요.';
      break;
    case 'spaceship-card':
    case 'satellite-card':
      for (const target of selected) mark(target, card, user, now, now + WEEK,
        `${card.id === 'spaceship-card' ? '급식 자리' : '자리 맞교환'}: ${selected.find(p => p.id !== target.id).nickname} · 선생님 확인`);
      break;
    case 'galaxy-card':
      giveItem(user, 'star-card');
      message = '별 카드 1장을 보관했어요. 종류와 효과는 추후 등록돼요.';
      break;
    case 'spaceman-card':
      mark(user, card, user, now, now + 2 * WEEK, '일기 또는 독서록 면제 · 선생님 확인', {remainingUses: 3});
      break;
    case 'sun-rabbit-card': {
      const target = selected[0];
      // Expired unpaid rewards are liabilities, not active effects to cancel.
      target.cardMarkers = (target.cardMarkers || []).filter(marker => marker.itemId === 'sun-rabbit-card' && !active(marker, now));
      target.effects = [];
      target.rabbitDraw = null;
      mark(target, card, user, now, now + WEEK, '아이템 사용 금지 · 자연 만료 때 별 카드 1장');
      break;
    }
    case 'alien-rabbit-card':
      roll = die();
      fail(Number.isInteger(roll) && roll >= 1 && roll <= 6, '주사위 결과는 1~6이어야 합니다.');
      giveItem(user, 'alien-card');
      if (roll >= 3) giveItem(user, roll <= 4 ? 'moon-rabbit-card' : 'star-card');
      message = `주사위 ${roll}: 외계인 면제권${roll >= 3 ? (roll <= 4 ? '과 달토끼 카드' : '과 별 카드') : ''}를 받았어요.`;
      break;
    case 'android-card':
      mark(user, card, user, now, androidDueAt(now), '제출 기한 연장 · 선생님 확인');
      break;
    case 'sun-card':
      for (const target of selected) {
        const winner = sunWinner(target, now);
        fail(!winner || (winner.fromLevel || 0) <= levelOf(user), '더 높은 레벨의 해 효과가 적용 중이에요.');
        target.cardMarkers = (target.cardMarkers || []).filter(marker => marker.itemId !== 'sun-card');
        mark(target, card, user, now, now + WEEK, '아이템 사용마다 별 파편 1개 이전');
      }
      break;
    case 'moon-card': {
      const hasSun = !!sunWinner(user, now) || (user.effects || []).some(effect => effect.itemId === 'sun-card' && active(effect, now));
      if (hasSun) fail(user.starShards + 2 <= SHARDS.max, '별 파편 보상 2개를 더 담을 수 없어요.');
      user.cardMarkers = (user.cardMarkers || []).filter(marker => !['sun-card', 'moon-card'].includes(marker.itemId));
      user.effects = (user.effects || []).filter(effect => effect.itemId !== 'sun-card');
      if (hasSun) user.starShards += 2;
      mark(user, card, user, now, now + WEEK, '청소 면제 · 선생님 확인');
      break;
    }
  }
  syncGalaxyHoldings(user, now);
  for (const [id, p] of draft.players) Object.assign(room.players.get(id), p);
  if (card.id === 'asteroid-card') for (const [id, planet] of draft.planets) {
    if (planet.warnings) room.planets.get(id).warnings = planet.warnings;
  }
  return {message, targetIds: targets.map(p => p.id), ...(roll === undefined ? {} : {roll})};
}

// Read-only predicate for transaction scheduling. Unpayable rewards trigger one
// pendingGrant update, then no further writes until inventory/wallet space exists.
export function lv2ItemsDue(room, now = Date.now()) {
  validNow(now);
  for (const player of room.players.values()) {
    const anchors = player.lv2State?.galaxyNextAt || [];
    if (anchors.length !== Math.min(2, count(player, 'galaxy-card'))) return true;
    if (player.starShards < SHARDS.max && anchors.some(at => at <= now)) return true;
    for (const marker of player.cardMarkers || []) {
      if (!catalogueItem(marker.itemId)) continue;
      if (marker.itemId === 'moon-card' && player.avatar.blackStar) return true;
      if (marker.itemId === 'spaceman-card' && marker.remainingUses === 0) return true;
      if (active(marker, now)) continue;
      if (marker.itemId !== 'sun-rabbit-card' || !marker.pendingGrant || fits(player, 'star-card')) return true;
    }
  }
  return false;
}

// Run before generic card expiry pruning and persist whenever true is returned.
// Load validators must retain expired LV2 markers so offline expiry rewards run.
export function settleLv2Items(room, now = Date.now()) {
  validNow(now);
  let changed = false;
  for (const player of room.players.values()) {
    changed = syncGalaxyHoldings(player, now) || changed;
    const anchors = player.lv2State?.galaxyNextAt || [];
    // Bounded by 2 anchors, even after years offline. Full wallets retain debt.
    for (let i = 0; i < anchors.length; i++) {
      if (anchors[i] > now) continue;
      const due = Math.floor((now - anchors[i]) / WEEK) + 1;
      const paid = Math.min(due, Math.max(0, SHARDS.max - player.starShards));
      if (paid) { player.starShards += paid; anchors[i] += paid * WEEK; changed = true; }
    }
    const before = player.cardMarkers || [];
    const after = before.filter(marker => {
      if (!catalogueItem(marker.itemId)) return true;
      if (marker.itemId === 'moon-card' && player.avatar.blackStar) { changed = true; return false; }
      if (marker.itemId === 'spaceman-card' && marker.remainingUses === 0) { changed = true; return false; }
      if (active(marker, now)) return true;
      if (marker.itemId === 'sun-rabbit-card') {
        if (!fits(player, 'star-card')) {
          if (!marker.pendingGrant) { marker.pendingGrant = true; changed = true; }
          return true;
        }
        giveItem(player, 'star-card');
      }
      changed = true;
      return false;
    });
    if (after.length !== before.length) player.cardMarkers = after;
  }
  return changed;
}
