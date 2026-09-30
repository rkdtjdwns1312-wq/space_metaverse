import {holdingUsed} from './holding-abilities.js';
// 생활 별자리 능력 전용. Q/E 전투 수치에는 사용하지 않습니다.
export const SUPERNOVA_IDS = Object.freeze(['supernova-alpha-card', 'supernova-beta-card']);
export const supernovaQuantity = (player, id) => player.inventory?.find(entry => entry.id === id)?.quantity || 0;

// Legacy saves have no acquisition history. Their inventory order is the deterministic
// migration baseline; every subsequent quantity increase is recorded by the roster sync.
export function supernovaHoldings(player) {
  const previous = player.lv3State?.supernovaHoldings || {};
  const order = [...(player.lv3State?.supernovaOrder || [])];
  const quantities = Object.fromEntries(SUPERNOVA_IDS.map(id => [id, supernovaQuantity(player, id)]));
  for (const entry of player.inventory || []) {
    if (!SUPERNOVA_IDS.includes(entry.id) || entry.quantity <= 0) continue;
    if (entry.quantity > (previous[entry.id] || 0) || !order.includes(entry.id)) {
      const index = order.indexOf(entry.id);
      if (index >= 0) order.splice(index, 1);
      order.push(entry.id);
    }
  }
  return {supernovaHoldings: quantities, supernovaOrder: order};
}

export function activeSupernova(player) {
  const {supernovaOrder} = supernovaHoldings(player);
  return [...supernovaOrder].reverse().find(id => supernovaQuantity(player, id) > 0) || null;
}

// One weekly activation covers the supernova family. Acquisition order still decides
// which held kind applies; switching never changes the separate ability use count.
export function activatedSupernova(player, now = Date.now()) {
  const activatedId = player.holdingState?.supernovaActiveId;
  return SUPERNOVA_IDS.includes(activatedId) && holdingUsed(player, activatedId, now)
    ? activeSupernova(player) : null;
}

export function lifeAbilityModifiers(player, now = Date.now()) {
  const active = activatedSupernova(player, now);
  return {activeSupernova: active, multiplier: active === SUPERNOVA_IDS[0] ? 2 : 1,
    weeklyLimit: active === SUPERNOVA_IDS[1] ? 2 : 1};
}

export function lifeAbilityUsage(state, week, modifiers) {
  const usedCount = state?.usedWeek === week ? (state.usedCount ?? 1) : 0;
  const remaining = Math.max(0, modifiers.weeklyLimit - usedCount);
  const awaitingCompletion = state?.pending?.week === week || (state?.markers || []).some(marker => marker.week === week);
  return {...modifiers, usedCount, remaining, used: remaining === 0,
    awaitingCompletion, canUse: remaining > 0 && !awaitingCompletion};
}

export const ALPHA_MANUAL_NOTE = '초신성 α: 원문에서 확정된 보상·제작 가치·복사 개수·경고 삭제·해제 보상 수치는 2배로 적용해요. LV·주사위 판정 조건은 그대로예요. 현실 효과와 미확정 지급량은 자동 실행하지 않으며 선생님이 원문을 확인해요.';

// Do not rewrite numbers in prose: dates, levels and dice faces are conditions.
export function lifeAbilityDescription(ability, multiplier = 1) {
  const original = ability.description + (ability.note ? ' ' + ability.note : '');
  if (multiplier !== 2) return original;
  let detail;
  switch (ability.mode) {
    case 'grant-one': detail = `별 파편 ${(ability.reward || 1) * 2}개 지급`; break;
    case 'dice-shards': detail = `주사위 1~6 보상 순서: ${(ability.rewards || [0,1,1,1,1,2]).map(n => n * 2).join(' / ')}개`; break;
    case 'dice-risk': detail = `홀수 보상 ${(ability.win || 3) * 2}개, 짝수 반납 ${(ability.loss || 1) * 2}개`; break;
    case 'shop-copy': detail = '기존 구매 조건을 만족하는 아이템 2개 복사'; break;
    case 'dice-item': detail = '주사위로 정한 기존 LV 한도 안에서 선택한 아이템 2개 제작'; break;
    case 'value-item': detail = `제작 가치가 주사위 눈의 ${ability.multiplier * 2}배. LV 한도와 선택 종류 수는 그대로`; break;
    case 'dice-difference': detail = '주사위 차이의 2배를 지급. 재도전 비용은 기존 별 2개'; break;
    case 'dice-triple': detail = '판정 조건은 그대로, 별 카드·뽑기 카드 보상 2장 또는 별 4개'; break;
    case 'warning-one': detail = '선택한 부서의 내 활성 경고 최대 2개 삭제'; break;
    case 'ban-two-days': detail = '기존 해제일에 별 2개 보상'; break;
    case 'sleep': detail = '나와 친구에게 각각 별 2개 지급'; break;
    default: return `원문: ${original}\n${ALPHA_MANUAL_NOTE}`;
  }
  return `원문: ${original}\n초신성 α 적용: ${detail}. LV·주사위 판정 조건은 그대로예요.`;
}
