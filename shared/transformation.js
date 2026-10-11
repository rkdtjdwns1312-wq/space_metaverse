import {constellationOf} from './constellations.js';
import {equipmentBonus} from './equipment.js';

export const TRANSFORMATION=Object.freeze({ready:true,durationMs:30000,cooldownMs:120000});
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

export const transformationCooldownMs=(player,base=TRANSFORMATION.cooldownMs)=>Math.round(base*(1-Math.min(1,Math.max(0,equipmentBonus(player).allCooldownReduction))));
// Q 일반 공격·마나·횟수·사거리는 변경하지 않습니다.
// 앞으로 회복/효과 스킬도 이 공통 함수에 수치를 넘기면 같은 보정을 받습니다.
export function transformedSkill(player,spec){
  if(!spec)return spec;
  const bonus=transformationBonus(player),result={...spec};
  if(Number.isFinite(result.cooldownMs)){
    // 일반 E(공용 정의는 slot 생략, 사수 E는 0)만 장비 재사용 감소를 받습니다.
    // 보석의 모든 스킬 감소는 별도 슬롯에도 적용, 서버는 시전 때 종료 시각을 저장합니다.
    const ordinaryE=result.slot===undefined||result.slot===0;
    const gear=equipmentBonus(player);
    const equipmentFactor=1-Math.min(1,Math.max(0,gear.allCooldownReduction+(ordinaryE?gear.cooldownReduction:0)));
    result.cooldownMs=Math.round(result.cooldownMs*bonus.skillCooldownFactor*equipmentFactor);
  }
  for(const key of ['multiplier','healingAmount','effectAmount'])if(Number.isFinite(result[key]))result[key]*=bonus.skillAmountFactor;
  return result;
}
export function transformationDescription(player){
  return '30초동안 별자리 근원의 초월적인 모습으로 돌아갑니다. 능력치가 크게 상승하게 되고 특수한 효과를 부여받습니다.\n쿨타임: '+transformationCooldownMs(player)/1000+'초';
}
