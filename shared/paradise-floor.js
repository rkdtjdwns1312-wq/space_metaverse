// 낙원의 바닥 외곽선 하나를 서버 충돌, 실제 맵, 작은 지도에서 함께 사용합니다.
// 쿼터뷰의 원형 공간은 타원으로 보이며, 문이 있는 방향에만 곧은 다리가 붙습니다.
import {onPlazaFloor} from './plaza-layout.js';
import {onValleyFloor} from './valley-layout.js';
import {gateFloorGeometry,insideGateFloor,BRIDGE_WIDTH_SCALE} from './floor-geometry.js';
import {isStarOrigin,onOriginFloor} from './origin-floor.js';
import {onStreetFloor,isStarlightStreet} from './street-layout.js';
export const PARADISE_SCALE=1.5;
export const PARADISE_FLOOR=Object.freeze({rx:660,ry:370,bridgeWidth:180*BRIDGE_WIDTH_SCALE,landing:55,wallWidth:12});
export const isParadise=id=>id==='moon-garden'||id==='star-paradise'||/^sun-paradise(?:-[23])?$/.test(id)||/^moon-paradise-[123]$/.test(id);
export const paradisePoint=p=>({x:p.x*PARADISE_SCALE,y:p.y*PARADISE_SCALE});
export function enlargeParadise(map){
  return Object.freeze({...map,width:map.width*PARADISE_SCALE,height:map.height*PARADISE_SCALE,
    spawn:paradisePoint(map.spawn),
    vista:map.vista?Object.freeze({bodyX:map.vista.bodyX*PARADISE_SCALE,bodyY:map.vista.bodyY*PARADISE_SCALE,bodyRadius:map.vista.bodyRadius*PARADISE_SCALE}):undefined,
    objects:map.objects.map(o=>({...o,...paradisePoint(o),arrival:isParadise(o.target)?paradisePoint(o.arrival):o.arrival}))});
}
const cache=new WeakMap();
export function paradiseFloor(map){
  if(!isParadise(map.id))return null;
  if(cache.has(map))return cache.get(map);
  const floor=gateFloorGeometry(map,PARADISE_FLOOR);cache.set(map,floor);return floor;
}
export function onParadiseFloor(map,x,y,radius=0){
  if(isStarOrigin(map?.id))return onOriginFloor(map,x,y,radius);
  if(isStarlightStreet(map?.id))return onStreetFloor(map,x,y,radius);
  const floor=paradiseFloor(map);if(!floor)return true;
  return insideGateFloor(floor,x,y,radius,PARADISE_FLOOR.wallWidth);
}
// 다리 모서리에서 두 서버 좌표 사이를 보간할 때 배경을 가로지르지 않게 보정합니다.
export function floorRenderPoint(map,point,fallback,radius=0){
  return onParadiseFloor(map,point.x,point.y,radius)&&onPlazaFloor(map,point.x,point.y,radius)&&onValleyFloor(map,point.x,point.y,radius)?point:fallback;
}
