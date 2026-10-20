import {MONSTER_BODY_GEOMETRY} from './monster-geometry.js';

export const BOSS_MANA=Object.freeze({max:50,regenMs:10000,regenFraction:.1});
// 비용·쿨타임·반경은 사용자 답변에 따라 이 규격만 조정합니다. 쿨타임은 시전 시작 기준.
export const NOKSERA_HORN_BURST=Object.freeze({kind:'noksera-horn-burst',mana:15,cooldownMs:20000,decisionMs:2000,chance:.4,
  warningMs:3000,radiusWidths:1.5,damageMultiplier:2,durationMs:800});
// 사용자 지정 몸폭: collision radius × 원화 draw-width 배율 (192 × 2.05).
export const nokseraHornRadius=monster=>monster.radius*MONSTER_BODY_GEOMETRY.noksera.width*NOKSERA_HORN_BURST.radiusWidths;

export const NOKSERA_MOON_PHASE=Object.freeze({kind:'noksera-moon-phase',mana:25,cooldownMs:60000,
  decisionMs:2000,chance:.4,castMs:2000,waxMs:7000,fullMs:6000,waneMs:7000});
export function nokseraMoonTimeline(begin){
  const startsAt=begin+NOKSERA_MOON_PHASE.castMs,fullStartsAt=startsAt+NOKSERA_MOON_PHASE.waxMs;
  const fullEndsAt=fullStartsAt+NOKSERA_MOON_PHASE.fullMs;
  return {kind:NOKSERA_MOON_PHASE.kind,startsAt,fullStartsAt,fullEndsAt,endsAt:fullEndsAt+NOKSERA_MOON_PHASE.waneMs};
}
export const nokseraFullMoon=(monster,now)=>monster.typeId==='noksera'&&monster.hp>0&&!monster.moonCast&&
  monster.moonAura?.mapId===monster.mapId&&now>=monster.moonAura.fullStartsAt&&now<monster.moonAura.fullEndsAt;

export const LEOON_ROAR=Object.freeze({kind:'leoon-roar',mana:10,cooldownMs:15000,decisionMs:2000,chance:.4,
  glowMs:1000,warningMs:2000,damageMultiplier:2,areas:5,areaRadiusFactor:.58,ringRadiusFactor:1.25,durationMs:800});
export const LEOON_CHARGE=Object.freeze({kind:'leoon-charge',mana:20,cooldownMs:30000,decisionMs:2500,chance:.35,
  stompMs:900,warningMs:2000,dashMs:700,repeats:3,stomps:3,damageMultiplier:2,
  distanceFactor:3.4,halfWidthFactor:.48,durationMs:700});
