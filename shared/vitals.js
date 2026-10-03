import {transformationBonus} from './transformation.js';
import {equipmentBonus} from './equipment.js';
import {constellationOf} from './constellations.js';
// 소행성 LV1 → 별자리 LV2/3/4 → 초월체 LV5의 임시 최대치입니다.
export const VITAL_LIMITS=Object.freeze({1:Object.freeze({hp:1,mp:1}),2:Object.freeze({hp:20,mp:20}),
  3:Object.freeze({hp:40,mp:30}),4:Object.freeze({hp:60,mp:40}),5:Object.freeze({hp:60,mp:40})});
import {isTeacher,TEACHER_AVATAR} from './teacher-avatar.js';
export function vitalsOf(level,player=null){
  if(isTeacher(player))return {hp:{current:TEACHER_AVATAR.hp,max:TEACHER_AVATAR.hp},mp:{current:TEACHER_AVATAR.mp,max:TEACHER_AVATAR.mp}};
  const base=VITAL_LIMITS[level],bonus=transformationBonus(player),gear=equipmentBonus(player);
  const type=level>=2?constellationOf(player?.avatar?.constellationId,level)?.type:null;
  const hpFactor=type==='수호계'?1.5:type==='공격계'?.5:1;
  const hp=Math.max(1,Math.round((base?.hp||0)*hpFactor)+bonus.hpBonus+gear.hp);
  const mp=Math.max(1,(base?.mp||0)+(type==='생산계'||type==='제작계'?10:0)+bonus.mpBonus+gear.mp);
  // 최초 입장·단계 변경 때의 최대치입니다. 전투 현재치는 server/vitals.js에서 유지합니다.
  return Number.isInteger(level)&&base?{hp:{current:hp,max:hp},mp:{current:mp,max:mp}}:null;
}
