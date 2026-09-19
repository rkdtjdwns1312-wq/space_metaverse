// 소행성 LV1 → 별자리 LV2/3/4 → 초월체 LV5의 임시 최대치입니다.
export const VITAL_LIMITS=Object.freeze({1:1,2:10,3:20,4:30,5:40});
export function vitalsOf(level){
  const max=VITAL_LIMITS[level];
  // 최초 입장·단계 변경 때의 최대치입니다. 전투 현재치는 server/vitals.js에서 유지합니다.
  return Number.isInteger(level)&&max?{hp:{current:max,max},mp:{current:max,max}}:null;
}
