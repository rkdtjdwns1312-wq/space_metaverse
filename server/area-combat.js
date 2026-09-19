import {RULES} from '../shared/config.js';
import {ensureVitals,damagePlayer} from './vitals.js';

// 공격/향후 스킬에서 공유하는 서버 원형 판정. 클라이언트 대상 목록은 사용하지 않습니다.
export function playersInArea(room,{mapId,x,y,radius,sourceId=null,excludeTeachers=false}){
  return [...room.players.values()].filter(p=>p.id!==sourceId&&p.connected&&!p.away&&
    !(excludeTeachers&&p.role==='teacher')&&!p.avatar?.blackStar&&p.mapId===mapId&&ensureVitals(p)?.hp>0&&
    Math.hypot(p.x-x,p.y-y)<=radius+RULES.radius);
}
export function damagePlayersInArea(room,area,power,now){
  return playersInArea(room,area).map(p=>({targetId:p.id,...damagePlayer(p,power,now)}));
}
