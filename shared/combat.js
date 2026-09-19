// 모든 별자리에 공통인 공격력. 아직 정하지 않은 단계는 임의의 숫자로 채우지 않습니다.
export const ATTACK_POWER=Object.freeze({2:1,3:2,4:3});
export const attackPowerOf=level=>Number.isInteger(level)&&Object.hasOwn(ATTACK_POWER,level)?ATTACK_POWER[level]:null;

export const ATTACK_VISUAL=Object.freeze({cooldownMs:450,durationMs:340,reach:62});
