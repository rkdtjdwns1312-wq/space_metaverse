import {onParadiseFloor} from './paradise-floor.js';
import {onOriginFloor} from './origin-floor.js';

// AI 추적과 끼임 탈출 모두 같은 보스 안전 바닥/문 주변 여백을 지킵니다.
export function monsterMovementTerrainBlocked(map,monster,x,y){
  return !onParadiseFloor(map,x,y,monster.radius)||
    (['serena','dark-star','star-record','forgotten-constellation'].includes(monster.typeId)&&!onOriginFloor(map,x,y,monster.radius))||
    x<Math.max(120,monster.radius)||x>map.width-Math.max(120,monster.radius)||
    y<Math.max(190,monster.radius)||y>map.height-Math.max(190,monster.radius);
}
