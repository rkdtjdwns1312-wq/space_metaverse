import {avatarSizeOf} from './avatar-size.js';

// 시전 시각부터 쿨타임을 계산합니다. 노란별 폭발 피격과 빨간별·검은별 실패는 즉사이며 천칭 무적은 유지합니다.
export const SERENA_SKILLS=Object.freeze({
  yellow:Object.freeze({mana:10,cooldownMs:30000,durationMs:20000,intervalMs:2000,warningMs:2000,radius:55,burstMs:650,decisionMs:2000,chance:.4}),
  black:Object.freeze({mana:10,cooldownMs:30000,durationMs:10000,contacts:5,maxTargets:2,decisionMs:2000,chance:.4}),
  red:Object.freeze({mana:10,cooldownMs:60000,durationMs:5000,minFriends:1,maxFriends:2,burstMs:650,maxTargets:2,decisionMs:2000,chance:.4})
});
// 가로 지름이 캐릭터 그림의 6배인 바닥 타원입니다.
export const serenaRedRadii=player=>({radiusX:avatarSizeOf(player)*3,radiusY:avatarSizeOf(player)*1.8});
