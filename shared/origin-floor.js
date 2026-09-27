import {gateFloorGeometry,insideGateFloor,BRIDGE_WIDTH_SCALE} from './floor-geometry.js';

export const ORIGIN_FLOOR_RULES=Object.freeze({rx:.40,ry:.32,bridgeWidth:.14*BRIDGE_WIDTH_SCALE,landing:.06,wallWidth:12});
export const isStarOrigin=id=>/^star-origin-[123]$/.test(id||'');
const cache=new WeakMap();
export function originFloor(map){
  if(!isStarOrigin(map?.id))return null;
  if(cache.has(map))return cache.get(map);
  const r=ORIGIN_FLOOR_RULES;
  const floor=gateFloorGeometry(map,{rx:map.width*r.rx,ry:map.height*r.ry,bridgeWidth:map.width*r.bridgeWidth,landing:Math.min(map.width,map.height)*r.landing});
  cache.set(map,floor);return floor;
}
export function onOriginFloor(map,x,y,radius=0){
  const floor=originFloor(map);return floor?insideGateFloor(floor,x,y,radius,ORIGIN_FLOOR_RULES.wallWidth):true;
}
