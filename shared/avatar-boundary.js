import {avatarSizeOf} from './avatar-size.js';
import {onParadiseFloor} from './paradise-floor.js';
import {onPlazaFloor} from './plaza-layout.js';
import {onValleyFloor} from './valley-layout.js';

// 물체/전투 판정은 기존 크기, 바닥 외곽만 실제 몸 그림의 반지름을 씁니다.
export function avatarFloorRadius(player){
  if(!player)return 16;
  if(player.role!=='teacher'&&player.avatar?.blackStar)return 26;
  return Math.ceil(avatarSizeOf(player)/2)+2;
}
export function avatarFitsFloor(map,x,y,player){
  const r=avatarFloorRadius(player);
  return Number.isFinite(x)&&Number.isFinite(y)&&x>=r&&y>=r&&x<=map.width-r&&y<=map.height-r&&
    onParadiseFloor(map,x,y,r)&&onPlazaFloor(map,x,y,r)&&onValleyFloor(map,x,y,r);
}
