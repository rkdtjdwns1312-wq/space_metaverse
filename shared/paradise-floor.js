// 낙원의 바닥 외곽선 하나를 서버 충돌, 실제 맵, 작은 지도에서 함께 사용합니다.
// 쿼터뷰의 원형 공간은 타원으로 보이며, 문이 있는 방향에만 곧은 다리가 붙습니다.
import {onPlazaFloor} from './plaza-layout.js';
import {onValleyFloor} from './valley-layout.js';
export const PARADISE_SCALE=1.5;
export const PARADISE_FLOOR=Object.freeze({rx:660,ry:370,bridgeWidth:180,landing:55,wallWidth:12});
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
  const cx=map.width/2,cy=map.height/2,{rx,ry,bridgeWidth,landing}=PARADISE_FLOOR,half=bridgeWidth/2;
  const bridges=map.objects.filter(o=>o.kind==='gate').map(o=>{
    const horizontal=Math.abs(o.x-cx)>Math.abs(o.y-cy);
    const direction=horizontal?(o.x>cx?0:2):(o.y>cy?1:3);
    return {direction,angle:direction*Math.PI/2,end:Math.abs(horizontal?o.x-cx:o.y-cy)+landing,
      gap:Math.asin(half/(horizontal?ry:rx))};
  }).sort((a,b)=>a.direction-b.direction);
  const points=[];
  const arc=(start,end)=>{const steps=Math.max(1,Math.ceil((end-start)/(Math.PI/96)));
    for(let i=0;i<=steps;i++){const a=start+(end-start)*i/steps;points.push({x:cx+rx*Math.cos(a),y:cy+ry*Math.sin(a)});}};
  let previous=-Math.PI/4;
  for(const b of bridges){
    arc(previous,b.angle-b.gap);
    const dx=Math.cos(b.angle),dy=Math.sin(b.angle);
    // 다리 양 옆과 문 뒤 착지 공간을 외곽선에 넣어 접합부를 가로막는 벽이 생기지 않습니다.
    for(const side of [-1,1])points.push({x:cx+dx*b.end-dy*half*side,y:cy+dy*b.end+dx*half*side});
    previous=b.angle+b.gap;
  }
  arc(previous,Math.PI*7/4);
  const floor={cx,cy,rx,ry,half,bridges,points};cache.set(map,floor);return floor;
}
function distanceToEdge(x,y,a,b){
  const dx=b.x-a.x,dy=b.y-a.y,len=dx*dx+dy*dy;
  const t=len?Math.max(0,Math.min(1,((x-a.x)*dx+(y-a.y)*dy)/len)):0;
  return Math.hypot(x-a.x-t*dx,y-a.y-t*dy);
}
export function onParadiseFloor(map,x,y,radius=0){
  const floor=paradiseFloor(map);if(!floor)return true;
  if(!Number.isFinite(x)||!Number.isFinite(y))return false;
  const {points}=floor;let inside=false;
  for(let i=0,j=points.length-1;i<points.length;j=i++){
    const a=points[j],b=points[i];
    // 발밑 충돌 반경과 낮은 난간 두께만큼 안쪽에 머무르게 합니다.
    if(distanceToEdge(x,y,a,b)<radius+PARADISE_FLOOR.wallWidth/2)return false;
    if((a.y>y)!==(b.y>y)&&x<(b.x-a.x)*(y-a.y)/(b.y-a.y)+a.x)inside=!inside;
  }
  return inside;
}
// 다리 모서리에서 두 서버 좌표 사이를 보간할 때 배경을 가로지르지 않게 보정합니다.
export function floorRenderPoint(map,point,fallback,radius=0){
  return onParadiseFloor(map,point.x,point.y,radius)&&onPlazaFloor(map,point.x,point.y,radius)&&onValleyFloor(map,point.x,point.y,radius)?point:fallback;
}
