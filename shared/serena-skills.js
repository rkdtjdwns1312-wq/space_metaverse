import {avatarSizeOf} from './avatar-size.js';

// 시전 시각부터 쿨타임을 계산합니다. 피해 배율은 방어·보호 효과 적용 전 공격력 기준입니다.
export const SERENA_SKILLS=Object.freeze({
  yellow:Object.freeze({mana:10,cooldownMs:30000,durationMs:20000,intervalMs:2000,warningMs:2000,radius:55,burstMs:650,decisionMs:2000,chance:.4}),
  black:Object.freeze({mana:10,cooldownMs:30000,durationMs:10000,contacts:5,maxTargets:2,decisionMs:2000,chance:.4}),
  red:Object.freeze({mana:10,cooldownMs:60000,durationMs:20000,intervalMs:2000,maxTargets:2,decisionMs:2000,chance:.4})
});
// 가로 지름이 캐릭터 그림의 6배인 바닥 타원입니다.
export const serenaRedRadii=player=>({radiusX:avatarSizeOf(player)*3,radiusY:avatarSizeOf(player)*1.8});
