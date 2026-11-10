import {gateFloorGeometry,insideGateFloor,BRIDGE_WIDTH_SCALE} from './floor-geometry.js';
import {isSleepingStars} from './sleeping-stars.js';

export const ORIGIN_FLOOR_RULES=Object.freeze({rx:.40,ry:.32,bridgeWidth:.14*BRIDGE_WIDTH_SCALE,landing:.06,wallWidth:12});
export const isStarOrigin=id=>/^star-origin-[1234]$/.test(id||'');
export const hasOriginFloor=id=>isStarOrigin(id)||isSleepingStars(id);
const cache=new WeakMap();
// Only the sleeping maps use this fixed meteor outline. Expand outward so the
// established boss arena and every bridge's usable width remain available.
function meteorFloor(floor,map){
  const base=floor.points.filter((p,i,all)=>!i||Math.hypot(p.x-all[i-1].x,p.y-all[i-1].y)>1e-6);
  if(Math.hypot(base[0].x-base.at(-1).x,base[0].y-base.at(-1).y)<1e-6)base.pop();
  const cap=(a,b)=>Math.abs(a.x-b.x)<1e-6&&Math.abs(a.y-b.y)>floor.half&&Math.abs(a.x-floor.cx)>floor.rx||Math.abs(a.y-b.y)<1e-6&&Math.abs(a.x-b.x)>floor.half&&Math.abs(a.y-floor.cy)>floor.ry;
  const locked=new Set();
  for(let i=0;i<base.length;i++){
    const a=base[i],b=base[(i+1)%base.length];if(!cap(a,b))continue;
    const axis=Math.abs(a.x-b.x)<1e-6?'x':'y',size=axis==='x'?map.width:map.height;
    a[axis]=b[axis]=a[axis]<size/2?0:size;locked.add(i);locked.add((i+1)%base.length);
  }
  const normal=(a,b)=>{const length=Math.hypot(b.x-a.x,b.y-a.y);return {x:(b.y-a.y)/length,y:(a.x-b.x)/length};};
  const normals=base.map((p,i)=>normal(p,base[(i+1)%base.length]));
  const amplitude=Math.min(map.width,map.height)*.014,points=[];
  for(let i=0;i<base.length;i++){
    const a=base[i],b=base[(i+1)%base.length],n=normals[i],length=Math.hypot(b.x-a.x,b.y-a.y);
    const isCap=locked.has(i)&&locked.has((i+1)%base.length)&&cap(a,b),steps=isCap?1:Math.max(1,Math.ceil(length/40));
    for(let j=0;j<steps;j++){
      const t=j/steps,x=a.x+(b.x-a.x)*t,y=a.y+(b.y-a.y)*t;
      const wave=.58+.22*Math.sin(x*.019+y*.013)+.13*Math.sin(x*.047-y*.031)+.07*Math.cos(x*.091+y*.073);
      const taper=Math.min(1,locked.has(i)?t*length/80:1,locked.has((i+1)%base.length)?(1-t)*length/80:1);
      const previous=normals[(i+base.length-1)%base.length],nx=j?n.x:(previous.x+n.x)/2,ny=j?n.y:(previous.y+n.y)/2;
      points.push({x:x+nx*amplitude*wave*taper,y:y+ny*amplitude*wave*taper});
    }
  }
  return {...floor,points};
}
export function originFloor(map){
  if(!hasOriginFloor(map?.id))return null;
  if(cache.has(map))return cache.get(map);
  const r=ORIGIN_FLOOR_RULES;
  const base=gateFloorGeometry(map,{rx:map.width*r.rx,ry:map.height*r.ry,bridgeWidth:map.width*r.bridgeWidth,landing:Math.min(map.width,map.height)*r.landing});
  const floor=isSleepingStars(map.id)?meteorFloor(base,map):base;
  cache.set(map,floor);return floor;
}
export function onOriginFloor(map,x,y,radius=0){
  const floor=originFloor(map);return floor?insideGateFloor(floor,x,y,radius,ORIGIN_FLOOR_RULES.wallWidth):true;
}
