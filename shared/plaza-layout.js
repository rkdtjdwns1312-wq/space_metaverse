// 광장 바닥/벽/지도/행성 배치가 같은 도형을 사용합니다. 좌표는 서버가 확정합니다.
import {BRIDGE_WIDTH_SCALE} from './floor-geometry.js';
export const PLAZA_SCALE=.6;
export const plazaPoint=({x,y})=>({x:Math.round(x*PLAZA_SCALE),y:Math.round(y*PLAZA_SCALE)});
export const DEPARTMENT_RADIUS=36,DEPARTMENT_GAP=48,DEPARTMENT_SPACING=132;
export const PLAZA_LAYOUT=Object.freeze({width:3720,height:2640,wall:10,bridgeWidth:156*BRIDGE_WIDTH_SCALE,
  center:{x:1800,y:1320,rx:780,ry:480},
  islands:[
    {id:'assignment',name:'과제별서고',x:600,y:510,rx:432,ry:336,color:'#e9e2ff'},
    {id:'market',name:'별 시장',x:600,y:2100,rx:432,ry:336,color:'#fff0dc'},
    {id:'department',name:'부서행성 광장',x:2940,y:2070,rx:732,ry:504,color:'#e5f5ed'},
    {id:'black-hole',name:'블랙홀 입구',x:3090,y:510,rx:480,ry:336,color:'#e1dcf7'}
  ],
  gates:{west:{x:78,y:1320},east:{x:3642,y:1320},north:{x:1800,y:78},south:{x:1800,y:2562}}
});
export const DEPARTMENT_ZONE=PLAZA_LAYOUT.islands.find(i=>i.id==='department');
const ellipse=p=>Array.from({length:128},(_,i)=>{const a=i*Math.PI/64;return {x:p.x+p.rx*Math.cos(a),y:p.y+p.ry*Math.sin(a)};});
function bridge(a,b){const dx=b.x-a.x,dy=b.y-a.y,l=Math.hypot(dx,dy),nx=-dy/l*PLAZA_LAYOUT.bridgeWidth/2,ny=dx/l*PLAZA_LAYOUT.bridgeWidth/2;
  return [{x:a.x+nx,y:a.y+ny},{x:a.x-nx,y:a.y-ny},{x:b.x-nx,y:b.y-ny},{x:b.x+nx,y:b.y+ny}];}
export const PLAZA_POLYGONS=[ellipse(PLAZA_LAYOUT.center),...PLAZA_LAYOUT.islands.map(ellipse),
  ...[...PLAZA_LAYOUT.islands,...Object.entries(PLAZA_LAYOUT.gates).map(([direction,p])=>({x:p.x+(direction==='west'?-36:direction==='east'?36:0),y:p.y+(direction==='north'?-36:direction==='south'?36:0)}))].map(p=>bridge(PLAZA_LAYOUT.center,p))];
function inPolygon(p,poly){let inside=false;for(let i=0,j=poly.length-1;i<poly.length;j=i++){
  const a=poly[i],b=poly[j];if((a.y>p.y)!==(b.y>p.y)&&p.x<(b.x-a.x)*(p.y-a.y)/(b.y-a.y)+a.x)inside=!inside;}return inside;}
const cross=(a,b)=>a.x*b.y-a.y*b.x;
// 겹치는 원과 다리의 내부 선을 제거하여 연결부에는 보이지 않는 벽이 생기지 않습니다.
function outerEdges(){const result=[];
  for(const [index,poly] of PLAZA_POLYGONS.entries())for(let i=0;i<poly.length;i++){
    const a=poly[i],b=poly[(i+1)%poly.length],v={x:b.x-a.x,y:b.y-a.y},cuts=[0,1];
    for(const [j,other] of PLAZA_POLYGONS.entries())if(j!==index)for(let k=0;k<other.length;k++){
      const c=other[k],d=other[(k+1)%other.length],w={x:d.x-c.x,y:d.y-c.y},den=cross(v,w);if(Math.abs(den)<1e-8)continue;
      const delta={x:c.x-a.x,y:c.y-a.y},t=cross(delta,w)/den,u=cross(delta,v)/den;
      if(t>0&&t<1&&u>=0&&u<=1)cuts.push(t);
    }
    cuts.sort((x,y)=>x-y);
    for(let k=1;k<cuts.length;k++){const start=cuts[k-1],end=cuts[k];if(end-start<1e-7)continue;
      const mid=(start+end)/2,p={x:a.x+v.x*mid,y:a.y+v.y*mid};
      if(!PLAZA_POLYGONS.some((other,j)=>j!==index&&inPolygon(p,other)))result.push([{x:a.x+v.x*start,y:a.y+v.y*start},{x:a.x+v.x*end,y:a.y+v.y*end}]);
    }
  }return result;
}
export const PLAZA_EDGES=outerEdges();
function edgeDistance(p,a,b){const dx=b.x-a.x,dy=b.y-a.y,l=dx*dx+dy*dy,t=Math.max(0,Math.min(1,((p.x-a.x)*dx+(p.y-a.y)*dy)/(l||1)));return Math.hypot(p.x-a.x-t*dx,p.y-a.y-t*dy);}
export function onPlazaFloor(map,x,y,radius=0){
  if(map.id!=='space-plaza')return true;
  if(!Number.isFinite(x)||!Number.isFinite(y))return false;
  const p={x,y};return PLAZA_POLYGONS.some(poly=>inPolygon(p,poly))&&!PLAZA_EDGES.some(([a,b])=>edgeDistance(p,a,b)<radius+PLAZA_LAYOUT.wall/2);
}
export function departmentSite(x,y,radius=52){
  if(!Number.isFinite(x)||!Number.isFinite(y))return false;
  const z=DEPARTMENT_ZONE,margin=radius+24;
  return ((x-z.x)/(z.rx-margin))**2+((y-z.y)/(z.ry-margin))**2<1;
}
// 축소된 크기에서도 기존 최대48개(대기 신청 포함)를 수용하는 후보 자리입니다.
export function departmentSlots(){const z=DEPARTMENT_ZONE,points=[];
  for(let y=z.y-462;y<=z.y+462;y+=DEPARTMENT_SPACING)for(let x=z.x-660;x<=z.x+660;x+=DEPARTMENT_SPACING)if(departmentSite(x,y))points.push({x,y});
  return points.sort((a,b)=>a.y-b.y||a.x-b.x);
}
