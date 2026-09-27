import {departmentSite,departmentSlots,DEPARTMENT_RADIUS,DEPARTMENT_GAP,plazaPoint} from '../shared/plaza-layout.js';
// 이전 파일은 이름·소속·규칙·실적·id를 그대로 두고 좌표만 한 번 이전합니다.
// 복원은 메모리에서 하며 기존 저장의 원자적 쓰기/롤백 절차를 그대로 사용합니다.
export function relocateDepartments(room){
  const bodies=[...room.planets.values(),...room.proposals.values()],placed=[];
  const needsMove=[];let resized=false;
  const separation=DEPARTMENT_RADIUS*2+DEPARTMENT_GAP;
  for(const body of bodies){
    // 이전 반경60 자료만 한번 축소합니다. 반경은 외형 설정이며 사용자 저장 내용이 아닙니다.
    if(body.radius!==DEPARTMENT_RADIUS){Object.assign(body,plazaPoint(body),{radius:DEPARTMENT_RADIUS});resized=true;}
    if(departmentSite(body.x,body.y)&&placed.every(p=>Math.hypot(p.x-body.x,p.y-body.y)>=separation))placed.push(body);
    else needsMove.push(body);
  }
  for(const body of needsMove){
    const slot=departmentSlots().find(p=>placed.every(other=>Math.hypot(p.x-other.x,p.y-other.y)>=separation));
    if(!slot){
      // 임의 배치와 정렬 후보가 충돌하면 전체를 안전한 50개 자리로 재배치합니다.
      const slots=departmentSlots();if(bodies.length>slots.length)throw new Error('부서행성 이전 공간이 부족합니다. 원본 저장을 보존했습니다.');
      bodies.forEach((p,i)=>Object.assign(p,slots[i]));return true;
    }
    Object.assign(body,slot);placed.push(body);
  }
  return resized||needsMove.length>0;
}
