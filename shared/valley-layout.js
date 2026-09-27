// 은하수계곡의 충돌·배경 렌더링이 함께 쓰는 연속 바닥 도형입니다.
import {BRIDGE_WIDTH_SCALE} from './floor-geometry.js';
export const VALLEY_LAYOUT=Object.freeze({width:2400,height:1400,wall:10,bridgeWidth:160*BRIDGE_WIDTH_SCALE,
  center:Object.freeze({x:1200,y:420,rx:200,ry:145}),
  temples:Object.freeze([
    Object.freeze({id:'evolution',x:480,y:820,rx:350,ry:235}),
    Object.freeze({id:'growth',x:1920,y:820,rx:350,ry:235})
  ]),
  gate:Object.freeze({x:1200,y:90}),
  spawn:Object.freeze({x:1200,y:240})
});

const ellipse=p=>Array.from({length:128},(_,i)=>{const a=i*Math.PI/64;return {x:p.x+p.rx*Math.cos(a),y:p.y+p.ry*Math.sin(a)};});
function bridge(a,b){const dx=b.x-a.x,dy=b.y-a.y,length=Math.hypot(dx,dy),nx=-dy/length*VALLEY_LAYOUT.bridgeWidth/2,ny=dx/length*VALLEY_LAYOUT.bridgeWidth/2;
  return [{x:a.x+nx,y:a.y+ny},{x:a.x-nx,y:a.y-ny},{x:b.x-nx,y:b.y-ny},{x:b.x+nx,y:b.y+ny}];}
export const VALLEY_POLYGONS=[ellipse(VALLEY_LAYOUT.center),...VALLEY_LAYOUT.temples.map(ellipse),
  bridge(VALLEY_LAYOUT.center,{x:VALLEY_LAYOUT.gate.x,y:VALLEY_LAYOUT.gate.y-60}),
  ...VALLEY_LAYOUT.temples.map(p=>bridge(VALLEY_LAYOUT.center,p))];
function inPolygon(p,poly){let inside=false;for(let i=0,j=poly.length-1;i<poly.length;j=i++){
  const a=poly[i],b=poly[j];if((a.y>p.y)!==(b.y>p.y)&&p.x<(b.x-a.x)*(p.y-a.y)/(b.y-a.y)+a.x)inside=!inside;}return inside;}
const cross=(a,b)=>a.x*b.y-a.y*b.x;
// 겹치는 섬과 다리의 안쪽 선분을 걷어내 연결부에 벽이 생기지 않는 외곽만 남깁니다.
function outerEdges(){const result=[];
  for(const [index,poly] of VALLEY_POLYGONS.entries())for(let i=0;i<poly.length;i++){
    const a=poly[i],b=poly[(i+1)%poly.length],v={x:b.x-a.x,y:b.y-a.y},cuts=[0,1];
    for(const [j,other] of VALLEY_POLYGONS.entries())if(j!==index)for(let k=0;k<other.length;k++){
      const c=other[k],d=other[(k+1)%other.length],w={x:d.x-c.x,y:d.y-c.y},den=cross(v,w);if(Math.abs(den)<1e-8)continue;
      const delta={x:c.x-a.x,y:c.y-a.y},t=cross(delta,w)/den,u=cross(delta,v)/den;
      if(t>0&&t<1&&u>=0&&u<=1)cuts.push(t);
    }
    cuts.sort((x,y)=>x-y);
    for(let k=1;k<cuts.length;k++){const start=cuts[k-1],end=cuts[k];if(end-start<1e-7)continue;
      const mid=(start+end)/2,p={x:a.x+v.x*mid,y:a.y+v.y*mid};
      if(!VALLEY_POLYGONS.some((other,j)=>j!==index&&inPolygon(p,other)))result.push([{x:a.x+v.x*start,y:a.y+v.y*start},{x:a.x+v.x*end,y:a.y+v.y*end}]);
    }
  }return result;
}
export const VALLEY_EDGES=outerEdges();
function edgeDistance(p,a,b){const dx=b.x-a.x,dy=b.y-a.y,l=dx*dx+dy*dy,t=Math.max(0,Math.min(1,((p.x-a.x)*dx+(p.y-a.y)*dy)/(l||1)));return Math.hypot(p.x-a.x-t*dx,p.y-a.y-t*dy);}
export function onValleyFloor(map,x,y,radius=0){
  if(map.id!=='milky-valley')return true;
  if(!Number.isFinite(x)||!Number.isFinite(y)||!Number.isFinite(radius)||radius<0)return false;
  const p={x,y};return VALLEY_POLYGONS.some(poly=>inPolygon(p,poly))&&!VALLEY_EDGES.some(([a,b])=>edgeDistance(p,a,b)<radius+VALLEY_LAYOUT.wall/2);
}

// 남은 외곽 선분을 폐곡선으로 잇고 단일 Canvas 경로에 담습니다.
export function traceValleyFloor(ctx){
  ctx.beginPath();
  const key=p=>`${Math.round(p.x*1e6)},${Math.round(p.y*1e6)}`;
  const starts=new Map();
  VALLEY_EDGES.forEach((edge,index)=>{const k=key(edge[0]);if(!starts.has(k))starts.set(k,[]);starts.get(k).push(index);});
  const used=new Set();
  for(let first=0;first<VALLEY_EDGES.length;first++){
    if(used.has(first))continue;
    const start=VALLEY_EDGES[first][0];ctx.moveTo(start.x,start.y);let index=first,steps=0;
    while(!used.has(index)&&steps++<=VALLEY_EDGES.length){
      used.add(index);const [,end]=VALLEY_EDGES[index];ctx.lineTo(end.x,end.y);
      if(key(end)===key(start)){ctx.closePath();break;}
      index=(starts.get(key(end))||[]).find(candidate=>!used.has(candidate));
      if(index===undefined)throw new Error('은하수계곡 외곽 경로를 닫을 수 없습니다.');
    }
    if(steps>VALLEY_EDGES.length)throw new Error('은하수계곡 외곽 경로 연결이 순환했습니다.');
  }
  return ctx;
}
