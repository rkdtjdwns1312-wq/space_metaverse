import {equipmentBonus} from './equipment.js';
import {transformedSkill} from './transformation.js';

// 지속형 E만 명시적으로 사용합니다. 서버는 시전 때 반환값을 종료 시각이나
// 예약된 타격에 저장하므로, 발동 뒤 장착/해제로 남은 시간이 바뀌지 않습니다.
// 쿨다운, 주기, 횟수 상한, 투사체/공격 연출, 초월 시간은 보정하지 않습니다.
export function sustainedSkill(player,spec,durationKeys=['durationMs']){
  const result=transformedSkill(player,spec);
  const durationMs=Math.max(0,equipmentBonus(player).durationMs||0);
  for(const key of durationKeys)if(Number.isFinite(result[key]))result[key]+=durationMs;
  return result;
}
