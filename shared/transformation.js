import {constellationOf} from './constellations.js';

export const TRANSFORMATION=Object.freeze({ready:true,durationMs:30000,cooldownMs:300000});
const profile=(attackBonus,defenseBonus,hpBonus,mpBonus,skillCooldownFactor=1,skillAmountFactor=1)=>
  Object.freeze({attackBonus,defenseBonus,hpBonus,mpBonus,skillCooldownFactor,skillAmountFactor});
export const TRANSFORMATION_TYPES=Object.freeze({
  '생산계':profile(1,1,10,0,.5),
  '제작계':profile(2,0,20,20),
  '공격계':profile(3,-1,10,10),
  '수호계':profile(1,1,60,0),
  '특수계':profile(1,0,20,0,1,2)
});
const NONE=profile(0,0,0,0);
export const transformationProfile=player=>TRANSFORMATION_TYPES[constellationOf(player?.avatar?.constellationId)?.type]||NONE;
export const transformationBonus=player=>player?.role!=='teacher'&&player?.avatar?.level===5&&player?.transformation?.active?transformationProfile(player):NONE;

// Q/변신 자체의 재사용 시간·마나·횟수·사거리는 변경하지 않습니다.
// 앞으로 회복/효과 스킬도 이 공통 함수에 수치를 넘기면 같은 보정을 받습니다.
export function transformedSkill(player,spec){
  if(!spec)return spec;
  const bonus=transformationBonus(player),result={...spec};
  if(Number.isFinite(result.cooldownMs))result.cooldownMs*=bonus.skillCooldownFactor;
  for(const key of ['multiplier','healingAmount','effectAmount'])if(Number.isFinite(result[key]))result[key]*=bonus.skillAmountFactor;
  return result;
}
export function transformationDescription(player){
  if(player?.role==='teacher')return '30초 동안 선택한 별자리의 LV5 모습으로 변신해요. 평소에는 LV4 모습이에요. 마나 소모 없음 · 쿨타임 300초. 선생님의 체력·마나 999와 관리용 능력치는 그대로 유지돼요.';
  const b=transformationProfile(player),signed=n=>n>=0?`+${n}`:String(n);
  const extra=b.skillCooldownFactor===.5?' 일반 스킬 쿨타임 50% 감소.':b.skillAmountFactor===2?' 스킬 피해·회복·효과량 2배(마나 소모·쿨타임 유지).':'';
  return `30초 동안 LV5 모습으로 변신해요. 마나 소모 없음 · 쿨타임 300초. 공격력 ${signed(b.attackBonus)} · 방어력 ${signed(b.defenseBonus)}(최소 0) · 최대 체력 +${b.hpBonus} · 최대 마나 +${b.mpBonus}.${extra} 변신 시작 시 체력·마나를 모두 회복해요. 자동 회복은 10초마다 체력 최대치의 10%, 마나 2예요. 종료 시 원래 최대치로 돌아가며 초과 현재치만 제한해요.`;
}
