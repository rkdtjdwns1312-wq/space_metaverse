import {constellationOf} from './constellations.js';
// LV5가 최종 초월체입니다. 단계별 기본값에 계열 보정을 적용합니다.
export const ATTACK_POWER=Object.freeze({2:1,3:2,4:3,5:4});
export const ATTACK_MODIFIERS=Object.freeze({'수호계':-2,'제작계':-1,'생산계':-1,'공격계':1,'특수계':0});
export function attackPowerOf(level,constellationId){
  // LV1은 아직 공격을 배우지 않은 상태입니다. 미지원 단계에는 보정을 적용하지 않습니다.
  if(!Number.isInteger(level)||!Object.hasOwn(ATTACK_POWER,level))return null;
  const type=constellationOf(constellationId,level)?.type;
  return Math.max(1,ATTACK_POWER[level]+(ATTACK_MODIFIERS[type]??0));
}
export const DEFENSE_POWER=Object.freeze({1:0,2:0,3:1,4:2,5:3});
export const DEFENSE_MODIFIERS=Object.freeze({'생산계':-1,'제작계':-1,'공격계':0,'특수계':0,'수호계':1});
export function defensePowerOf(level,constellationId){
  if(!Number.isInteger(level)||level<2||!Object.hasOwn(DEFENSE_POWER,level))return 0;
  const base=DEFENSE_POWER[level]??0,type=constellationOf(constellationId,level)?.type;
  return Math.max(0,base+(DEFENSE_MODIFIERS[type]??0));
}
export const damageAfterDefense=(power,defense)=>Math.max(1,power-defense);

export const SKILL_COOLDOWN_MS=450;
export const ATTACK_VISUAL=Object.freeze({cooldownMs:1000,durationMs:340,reach:62});
