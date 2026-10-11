import {equipmentBonus} from './equipment.js';

// E의 피해만 보정합니다. Q(강화 Q 포함), 공격력 버프, 회복은 사용하지 않습니다.
// 지연 피해는 시전 당시 배율을 상태에 저장하고, 실제 피해 총량에 한 번 적용합니다.
export const skillDamageFactor=player=>1+Math.max(0,equipmentBonus(player).skillDamage||0);
export const skillDamage=(power,factor=1)=>Math.round(power*factor);
