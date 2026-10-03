import {ITEM_USE, SHARDS, SHOP} from '../shared/config.js';
import {LV3_ITEMS} from '../shared/lv3-items.js';
import {ensure} from './rooms.js';
import {hasMoonProtectionFrom,addCardMarker, hasCardStatus, hasItemImmunity} from './item-cards.js';
import {activeItemBlocks} from './constellation-abilities.js';
import {collectSunTax, hasLv2ItemBlock} from './lv2-item-effects.js';
import {clearBlackStar} from './warnings.js';
import {weekStart} from './temple.js';
import {SUPERNOVA_IDS, activatedSupernova, supernovaHoldings} from '../shared/supernova-life.js';

const WEEK = 7 * 86_400_000;
const SUPERNOVAS = SUPERNOVA_IDS;
const count = (p, id) => p.inventory.find(e => e.id === id)?.quantity || 0;
const level = p => p.role === 'teacher' ? ITEM_USE.teacherLevel : p.avatar.level;
const validTime = now => ensure(Number.isSafeInteger(now) && now >= 0 && now <= Number.MAX_SAFE_INTEGER - WEEK, '사용 시각이 올바르지 않습니다.');

// 할인 이력은 카드를 팔거나 다시 사도 지우지 않습니다. 재접속도 횟수를 복구하지 않습니다.
export function validateLv3State(value) {
  if (value === undefined) return {clusterNextAt: [], supernovaUsed: {}};
  const anchors = value?.clusterNextAt, used = value?.supernovaUsed;
  if (!Array.isArray(anchors) || anchors.length > 2 || anchors.some(n => !Number.isSafeInteger(n) || n < 0) ||
      !used || typeof used !== 'object' || Array.isArray(used) || Object.entries(used).some(([id, date]) =>
        !SUPERNOVAS.includes(id) || typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date) ||
        !Number.isFinite(Date.parse(date)) || weekStart(Date.parse(date)) !== date)) {
    throw new Error('LV3 아이템 저장 데이터가 올바르지 않습니다.');
  }
  const holdings = value.supernovaHoldings, order = value.supernovaOrder;
  if ((holdings === undefined) !== (order === undefined) || (holdings !== undefined && (
    !holdings || typeof holdings !== 'object' || Array.isArray(holdings) ||
    Object.entries(holdings).some(([id, n]) => !SUPERNOVAS.includes(id) || !Number.isSafeInteger(n) || n < 0 || n > SHOP.maxStack) ||
    !Array.isArray(order) || order.length > 2 || new Set(order).size !== order.length || order.some(id => !SUPERNOVAS.includes(id)))))
    throw new Error('LV3 아이템 저장 데이터가 올바르지 않습니다.');
  return {clusterNextAt: [...anchors], supernovaUsed: {...used},
    ...(holdings === undefined ? {} : {supernovaHoldings: {...holdings}, supernovaOrder: [...order]})};
}

export function availableSupernovas(player, now = Date.now()) {
  if (level(player) < 3 || hasCardStatus(player, 'little-sun-card', now) || hasLv2ItemBlock(player, now) || activeItemBlocks(player, now).length) return [];
  const active = activatedSupernova(player, now);
  return active && !Object.values(player.lv3State?.supernovaUsed || {}).includes(weekStart(now)) ? [active] : [];
}
export function consumeSupernovas(player, ids, now = Date.now()) {
  if (!ids.length) return;
  player.lv3State ??= validateLv3State();
  for (const id of ids) player.lv3State.supernovaUsed[id] = weekStart(now);
}

// 은하단 예약 시각은 호환용으로 보존하며 자동 보상은 지급하지 않습니다.
export function syncLv3Holdings(player, now = Date.now()) {
  validTime(now);
  const supernovaChanged = syncSupernovaHoldings(player);
  return supernovaChanged;
}
export function syncSupernovaHoldings(player) {
  const tracking = supernovaHoldings(player);
  if (!player.lv3State?.supernovaHoldings && !tracking.supernovaOrder.length) return false;
  if (JSON.stringify(player.lv3State?.supernovaHoldings) === JSON.stringify(tracking.supernovaHoldings) &&
      JSON.stringify(player.lv3State?.supernovaOrder) === JSON.stringify(tracking.supernovaOrder)) return false;
  player.lv3State = {...(player.lv3State || validateLv3State()), ...tracking};
  return true;
}
export function lv3ItemsDue(room, now = Date.now()) {
  return false;
}
export function settleLv3Items(room, now = Date.now()) {
  validTime(now);
  let changed = false;
  for (const player of room.players.values()) {
    changed = syncLv3Holdings(player, now) || changed;
  }
  return changed;
}

export function useLv3Item(room, actor, item, data = {}, now = Date.now()) {
  validTime(now);
  const card = LV3_ITEMS.find(c => c.id === (typeof item === 'string' ? item : item?.id));
  ensure(card?.usable, '이 아이템의 사용 효과는 준비 중이에요.');
  ensure(room.players.get(actor.id) === actor && actor.connected, '먼저 교실에 입장해주세요.');
  ensure(count(actor, card.id) > 0, '가방에 그 물건이 없어요.');
  ensure(level(actor) >= 3, '캐릭터의 lv보다 높은 아이템으로 사용할 수 없습니다');
  ensure(!hasCardStatus(actor, 'little-sun-card', now), '자외선 상태에서는 아이템을 사용할 수 없어요.');
  ensure(!hasLv2ItemBlock(actor, now) && !activeItemBlocks(actor, now).length, '지금은 아이템을 사용할 수 없어요.');
  ensure(now - (actor.lastItemUseAt ?? 0) >= ITEM_USE.cooldownMs, '조금 천천히 써요.');
  let ids = Array.isArray(data.targetIds) ? data.targetIds : [data.targetId, data.secondTargetId].filter(id => id !== undefined);
  if (card.targets === 'self' && !ids.length) ids = [actor.id];
  if (card.targets === 'self-and-two') ids = [actor.id, ...ids];
  const expected = card.targets === 'pair' ? 2 : card.targets === 'self-and-two' ? 3 : 1;
  ensure(ids.length === expected && new Set(ids).size === expected && ids.every(id => typeof id === 'string'), '서로 다른 사용 대상을 골라주세요.');
  if (card.targets === 'self') ensure(ids[0] === actor.id, '이 물건은 나에게만 쓸 수 있어요.');
  const targets = ids.map(id => room.players.get(id));
  ensure(targets.every(p => p && (p.connected || p.role === 'student')), '그 친구는 지금 없어요.');
  if (expected > 1) ensure(targets.every(p => p.role === 'student'), '학생 친구를 골라주세요.');
  for (const target of targets) {
    ensure(level(actor) >= level(target), '나보다 레벨이 높은 친구에게는 쓸 수 없어요.');
    ensure(!hasMoonProtectionFrom(target,actor,now) && !hasItemImmunity(target, now), '꼬마 달 보호 중인 친구는 타인이 사용하는 효과의 대상이 되지 않아요.');
  }

  // 보상 공간 부족, 사용료 실패 등이 나면 원본을 그대로 보존합니다.
  const draft = {...room, players: new Map([...room.players].map(([id, p]) => [id, structuredClone(p)])),
    planets: new Map([...room.planets].map(([id, p]) => [id, structuredClone(p)]))};
  const user = draft.players.get(actor.id);
  collectSunTax(draft, user, now);
  settleLv3Items(draft, now);
  user.inventory.find(e => e.id === card.id).quantity--;
  user.inventory = user.inventory.filter(e => e.quantity > 0);
  user.lastItemUseAt = now;
  let message;
  if (card.id === 'space-station-card' || card.id === 'great-spaceship-card') {
    for (const id of ids) {
      const target = draft.players.get(id);
      const note = card.id === 'space-station-card'
        ? `책상·급식 자리 교체: ${targets.map(p => p.nickname).join(' / ')} · 전체 자리 변경 때 종료`
        : `급식 자리: ${actor.nickname} · 앞 ${targets[1].nickname} · 뒤 ${targets[2].nickname} · 줄 밀림 면제`;
      Object.assign(addCardMarker(target, card, user, null, note), {at: now, fromLevel: level(user)});
    }
    message = '자리 변경을 기록했어요. 실제 자리와 효과 종료는 선생님이 확인해요.';
  } else if (card.id === 'galaxy-cluster-card' || card.id === 'rabbit-princess-card' || SUPERNOVAS.includes(card.id)) {
    const amount = card.id === 'galaxy-cluster-card' ? 2 : 1;
    const owned = user.inventory.find(e => e.id === 'star-card');
    ensure((owned?.quantity || 0) + amount <= SHOP.maxStack && (owned || user.inventory.length < SHOP.maxKinds), '별 카드를 받을 가방 공간이 부족해요.');
    if (owned) owned.quantity += amount;
    else user.inventory.push({id: 'star-card', quantity: amount});
    message = `별 카드 ${amount}장을 인벤토리에 지급했어요.`;
  } else if (card.id === 'comet-card') {
    for (const p of draft.players.values()) if (p.role === 'student' && p.avatar.blackStar) clearBlackStar(draft, p);
    for (const planet of draft.planets.values()) for (const entry of planet.warnings?.entries || []) entry.active = false;
    message = '모든 부서의 경고와 친구들의 검은별을 해제했어요.';
  } else if (card.id === 'alien-creature-card') {
    const startsAt = now + 86_400_000;
    Object.assign(addCardMarker(user, card, user, startsAt + 12 * 3_600_000,
      '사용 하루 뒤 포식 시작 · 12시간 동안 선생님이 아이템을 골라 먹일 수 있어요.'), {startsAt, at: now, fromLevel: level(user)});
    message = '에일리언을 사용했어요. 하루 뒤부터 12시간 동안 포식 상태가 됩니다.';
  } else ensure(false, '이 아이템의 사용 효과는 준비 중이에요.');
  syncLv3Holdings(user, now);
  for (const [id, p] of draft.players) Object.assign(room.players.get(id), p);
  for (const [id, p] of draft.planets) Object.assign(room.planets.get(id), p);
  return {message, targetIds: ids};
}
