import {constellationOf} from './constellations.js';
import {isTeacher,TEACHER_AVATAR} from './teacher-avatar.js';
import {avatarSizeOf} from './avatar-size.js';
// LV5가 최종 초월체입니다. 단계별 기본값에 계열 보정을 적용합니다.
export const ATTACK_POWER=Object.freeze({2:1,3:2,4:3,5:4});
export const ATTACK_MODIFIERS=Object.freeze({'수호계':-2,'제작계':-1,'생산계':-1,'공격계':1,'특수계':0});
export function attackPowerOf(level,constellationId,player=null){
  if(isTeacher(player))return TEACHER_AVATAR.attackPower;
  // LV1은 아직 공격을 배우지 않은 상태입니다. 미지원 단계에는 보정을 적용하지 않습니다.
  if(!Number.isInteger(level)||!Object.hasOwn(ATTACK_POWER,level))return null;
  const type=constellationOf(constellationId,level)?.type;
  return Math.max(1,ATTACK_POWER[level]+(ATTACK_MODIFIERS[type]??0));
}
export const DEFENSE_POWER=Object.freeze({1:0,2:0,3:1,4:2,5:3});
export const DEFENSE_MODIFIERS=Object.freeze({'생산계':-1,'제작계':-1,'공격계':-1,'특수계':0,'수호계':1});
export function defensePowerOf(level,constellationId,player=null){
  if(isTeacher(player))return TEACHER_AVATAR.defensePower;
  if(!Number.isInteger(level)||level<2||!Object.hasOwn(DEFENSE_POWER,level))return 0;
  const base=DEFENSE_POWER[level]??0,type=constellationOf(constellationId,level)?.type;
  return Math.max(0,base+(DEFENSE_MODIFIERS[type]??0));
}
export const damageAfterDefense=(power,defense)=>Math.max(1,power-defense);

export const SKILL_COOLDOWN_MS=450;
export const ATTACK_VISUAL=Object.freeze({cooldownMs:1000,durationMs:340,reach:62,hitRadius:36});
// LV2(80px)의 기존 타격 거리62를 기준으로, 몸 중심에서의 거리를 크기에 비례시킵니다.
// 타격 반경도 같은 배율을 적용하며 스킬은 몸 가장자리에서 출발합니다.
export function attackGeometryOf(player){
  const size=avatarSizeOf(player),scale=size/80;
  return {reach:ATTACK_VISUAL.reach*scale,radius:ATTACK_VISUAL.hitRadius*scale,originOffset:size/2};
}
