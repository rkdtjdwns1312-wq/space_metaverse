// 임시 단계별 최대치입니다. 미지정인 LV5/초월체에는 임의 수치를 부여하지 않습니다.
export const VITAL_LIMITS=Object.freeze({1:1,2:10,3:20,4:30});
export function vitalsOf(level){
  const max=VITAL_LIMITS[level];
  // 현재 몬스터의 반격·마나 소비는 없으므로 모두 충전된 상태로 시작합니다.
  return Number.isInteger(level)&&max?{hp:{current:max,max},mp:{current:max,max}}:null;
}
