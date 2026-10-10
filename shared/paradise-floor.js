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
// 1·2단계는 지도와 중앙 마당을 함께 넓힙니다. 3단계 보스 맵은 기존 크기를 유지합니다.
export function paradiseScale(id){
  if(id==='star-paradise')return PARADISE_SCALE*1.3;
  const stage=String(id).match(/^(?:sun-paradise(?:-([23]))?|moon-paradise-([123]))$/);
  return stage?[1.55*1.2,1.62*1.4,1.68][Number(stage[1]||stage[2]||1)-1]:PARADISE_SCALE;
}
export const paradisePoint=(p,scale=PARADISE_SCALE)=>({x:p.x*scale,y:p.y*scale});
export function enlargeParadise(map){
  const scale=paradiseScale(map.id);
  return Object.freeze({...map,width:map.width*scale,height:map.height*scale,paradiseScale:scale,
    spawn:paradisePoint(map.spawn,scale),
    vista:map.vista?Object.freeze({bodyX:map.vista.bodyX*scale,bodyY:map.vista.bodyY*scale,bodyRadius:map.vista.bodyRadius*scale}):undefined,
    objects:map.objects.map(o=>({...o,...paradisePoint(o,scale),arrival:isParadise(o.target)?paradisePoint(o.arrival,paradiseScale(o.target)):o.arrival}))});
}
const cache=new WeakMap();
export function paradiseFloor(map){
  if(!isParadise(map.id))return null;
  if(cache.has(map))return cache.get(map);
  const ratio=(map.paradiseScale||PARADISE_SCALE)/PARADISE_SCALE;
  const floor=gateFloorGeometry(map,{rx:PARADISE_FLOOR.rx*ratio,ry:PARADISE_FLOOR.ry*ratio,
    bridgeWidth:PARADISE_FLOOR.bridgeWidth*ratio,landing:PARADISE_FLOOR.landing*ratio});
  cache.set(map,floor);return floor;
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
