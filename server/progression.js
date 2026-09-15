import { PROGRESSION } from '../shared/config.js';

function invalid(message) {
  throw new TypeError(message);
}

function validateAvatar(avatar) {
  if (!avatar || typeof avatar !== 'object' || Array.isArray(avatar)) invalid('avatar must be an object');
  if (!Number.isInteger(avatar.level) || avatar.level < 1 || avatar.level > PROGRESSION.maxLevel) invalid('avatar.level must be an integer from 1 to 6');
  if (!Number.isSafeInteger(avatar.xp) || avatar.xp < 0) invalid('avatar.xp must be a non-negative safe integer');
  if (avatar.level < PROGRESSION.transcendentLevel && avatar.xp > PROGRESSION.nextLevelXp[avatar.level - 1]) invalid('avatar.xp must not exceed the current level requirement');
}

// 서버의 보상 처리에서만 호출할 순수 함수입니다. 입력을 바꾸지 않으므로 호출자는
// store.transact 안에서 반환값을 player.avatar에 배정해야 저장 실패 시에도 안전합니다.
// 성장의 별 구매 등 서버 보상 처리에서 사용하며, 자동으로 레벨을 올리지 않습니다.
export function gainExperience(avatar, amount) {
  validateAvatar(avatar);
  if (!Number.isSafeInteger(amount) || amount < 0) invalid('amount must be a non-negative safe integer');

  const result = structuredClone(avatar);
  if (result.level === PROGRESSION.transcendentLevel) {
    result.form = 'transcendent';
    result.xp = 0;
    return result;
  }

  const threshold = PROGRESSION.nextLevelXp[result.level - 1];
  result.xp += Math.min(amount, threshold - result.xp);
  return result;
}

// 경험치를 모두 채운 뒤 사용자가 진화를 확인했을 때만 한 단계 올립니다.
export function evolveAvatar(avatar) {
  validateAvatar(avatar);
  if (avatar.level === PROGRESSION.transcendentLevel) invalid('avatar is already transcendent');
  const threshold = PROGRESSION.nextLevelXp[avatar.level - 1];
  if (avatar.xp < threshold) invalid('avatar does not have enough experience');
  const result = structuredClone(avatar);
  result.level += 1;
  result.xp = 0;
  result.form = result.level === PROGRESSION.transcendentLevel ? 'transcendent' : 'constellation';
  return result;
}
