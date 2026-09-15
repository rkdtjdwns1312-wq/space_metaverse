import { PROGRESSION } from '../shared/config.js';

function invalid(message) {
  throw new TypeError(message);
}

function validateAvatar(avatar) {
  if (!avatar || typeof avatar !== 'object' || Array.isArray(avatar)) invalid('avatar must be an object');
  if (!Number.isInteger(avatar.level) || avatar.level < 1 || avatar.level > PROGRESSION.maxLevel) invalid('avatar.level must be an integer from 1 to 6');
  if (!Number.isSafeInteger(avatar.xp) || avatar.xp < 0) invalid('avatar.xp must be a non-negative safe integer');
}

// 서버의 보상 처리에서만 호출할 순수 함수입니다. 입력을 바꾸지 않으므로 호출자는
// store.transact 안에서 반환값을 player.avatar에 배정해야 저장 실패 시에도 안전합니다.
// 경험치 지급 활동과 별자리 그림 선택은 후속 단계에서 연결합니다.
export function gainExperience(avatar, amount) {
  validateAvatar(avatar);
  if (!Number.isSafeInteger(amount) || amount < 0) invalid('amount must be a non-negative safe integer');
  if (avatar.xp > Number.MAX_SAFE_INTEGER - amount) invalid('experience total exceeds safe integer range');

  const result = structuredClone(avatar);
  if (result.level === PROGRESSION.transcendentLevel) {
    result.form = 'transcendent';
    result.xp = 0;
    return result;
  }

  result.xp += amount;
  while (result.level < PROGRESSION.maxLevel) {
    const threshold = PROGRESSION.nextLevelXp[result.level - 1];
    if (result.xp < threshold) break;
    result.xp -= threshold;
    result.level += 1;
  }
  if (result.level === PROGRESSION.transcendentLevel) {
    result.form = 'transcendent';
    result.xp = 0;
  }
  return result;
}
