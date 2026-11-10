// 광장 바닥/벽/지도/행성 배치가 같은 도형을 사용합니다. 좌표는 서버가 확정합니다.
import {BRIDGE_WIDTH_SCALE} from './floor-geometry.js';
export const PLAZA_SCALE=.6;
export const plazaPoint=({x,y})=>({x:Math.round(x*PLAZA_SCALE),y:Math.round(y*PLAZA_SCALE)});
export const DEPARTMENT_RADIUS=36,DEPARTMENT_GAP=48,DEPARTMENT_SPACING=132;
export const PLAZA_VIEW_BOUNDS=Object.freeze({x:840,y:660,width:1920,height:1310});
export const PLAZA_LAYOUT=Object.freeze({width:2760,height:1970,wall:10,bridgeWidth:156*BRIDGE_WIDTH_SCALE,
  center:{x:1800,y:1320,rx:780,ry:480},
  islands:[
    {id:'assignment',name:'과제별서고',x:600,y:510,rx:432,ry:336,color:'#e9e2ff'},
    {id:'market',name:'별 시장',x:600,y:2100,rx:432,ry:336,color:'#fff0dc'},
    {id:'department',name:'부서행성 광장',x:2940,y:2070,rx:732,ry:504,color:'#e5f5ed'},
    {id:'black-hole',name:'블랙홀 입구',x:3090,y:510,rx:480,ry:336,color:'#e1dcf7'}
  ],
  gates:{west:{x:930,y:1320},east:{x:2670,y:1320},north:{x:1800,y:810},south:{x:1800,y:1870}}
});
export const DEPARTMENT_ZONE=PLAZA_LAYOUT.islands.find(i=>i.id==='department');
// Small destinations at the ends of four diagonal branches, separate from the
// saved coordinates of the full satellite maps above.
export const PLAZA_GATE_LANDINGS=Object.freeze([
 {id:'assignment',x:1020,y:850,rx:150,ry:150},
 {id:'black-hole',x:2580,y:850,rx:150,ry:150},
 {id:'department',x:2580,y:1790,rx:150,ry:150},
 {id:'market',x:1020,y:1790,rx:150,ry:150}
].map(Object.freeze));
const ellipse=p=>Array.from({length:128},(_,i)=>{const a=i*Math.PI/64;return {x:p.x+p.rx*Math.cos(a),y:p.y+p.ry*Math.sin(a)};});
function bridge(a,b,width=PLAZA_LAYOUT.bridgeWidth){const dx=b.x-a.x,dy=b.y-a.y,l=Math.hypot(dx,dy),nx=-dy/l*width/2,ny=dx/l*width/2;
  return [{x:a.x+nx,y:a.y+ny},{x:a.x-nx,y:a.y-ny},{x:b.x-nx,y:b.y-ny},{x:b.x+nx,y:b.y+ny}];}
export const PLAZA_POLYGONS=[ellipse(PLAZA_LAYOUT.center),
  ...Object.entries(PLAZA_LAYOUT.gates).map(([direction,p])=>bridge(PLAZA_LAYOUT.center,{
    x:direction==='west'?PLAZA_VIEW_BOUNDS.x:direction==='east'?PLAZA_VIEW_BOUNDS.x+PLAZA_VIEW_BOUNDS.width:p.x,
    y:direction==='north'?PLAZA_VIEW_BOUNDS.y:direction==='south'?PLAZA_VIEW_BOUNDS.y+PLAZA_VIEW_BOUNDS.height:p.y
  })),...PLAZA_GATE_LANDINGS.flatMap(z=>[bridge(PLAZA_LAYOUT.center,z,156),ellipse(z)])];
function inPolygon(p,poly){let inside=false;for(let i=0,j=poly.length-1;i<poly.length;j=i++){
  const a=poly[i],b=poly[j];if((a.y>p.y)!==(b.y>p.y)&&p.x<(b.x-a.x)*(p.y-a.y)/(b.y-a.y)+a.x)inside=!inside;}return inside;}
const cross=(a,b)=>a.x*b.y-a.y*b.x;
// 겹치는 원과 다리의 내부 선을 제거하여 연결부에는 보이지 않는 벽이 생기지 않습니다.
function outerEdges(polygons=PLAZA_POLYGONS){const result=[];
  for(const [index,poly] of polygons.entries())for(let i=0;i<poly.length;i++){
    const a=poly[i],b=poly[(i+1)%poly.length],v={x:b.x-a.x,y:b.y-a.y},cuts=[0,1];
    for(const [j,other] of polygons.entries())if(j!==index)for(let k=0;k<other.length;k++){
      const c=other[k],d=other[(k+1)%other.length],w={x:d.x-c.x,y:d.y-c.y},den=cross(v,w);if(Math.abs(den)<1e-8)continue;
      const delta={x:c.x-a.x,y:c.y-a.y},t=cross(delta,w)/den,u=cross(delta,v)/den;
      if(t>0&&t<1&&u>=0&&u<=1)cuts.push(t);
    }
    cuts.sort((x,y)=>x-y);
    for(let k=1;k<cuts.length;k++){const start=cuts[k-1],end=cuts[k];if(end-start<1e-7)continue;
      const mid=(start+end)/2,p={x:a.x+v.x*mid,y:a.y+v.y*mid};
      if(!polygons.some((other,j)=>j!==index&&inPolygon(p,other)))result.push([{x:a.x+v.x*start,y:a.y+v.y*start},{x:a.x+v.x*end,y:a.y+v.y*end}]);
    }
  }return result;
}
export const PLAZA_EDGES=outerEdges();
function edgeDistance(p,a,b){const dx=b.x-a.x,dy=b.y-a.y,l=dx*dx+dy*dy,t=Math.max(0,Math.min(1,((p.x-a.x)*dx+(p.y-a.y)*dy)/(l||1)));return Math.hypot(p.x-a.x-t*dx,p.y-a.y-t*dy);}
export function onPlazaFloor(map,x,y,radius=0){
  const layout=plazaLayoutOf(map);if(!layout)return true;
  if(!Number.isFinite(x)||!Number.isFinite(y))return false;
  const p={x,y};return layout.polygons.some(poly=>inPolygon(p,poly))&&!layout.edges.some(([a,b])=>edgeDistance(p,a,b)<radius+PLAZA_LAYOUT.wall/2);
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

// Preserve satellite coordinates and existing department data.
export const ASSIGNMENT_ID='assignment-archive',MARKET_ID='star-market',DEPARTMENT_ID='department-plaza';
export const PLAZA_AREA_IDS=Object.freeze({assignment:ASSIGNMENT_ID,market:MARKET_ID,department:DEPARTMENT_ID});
export const PLAZA_ROUTES=Object.freeze([
 {id:'assignment',name:'과제별 서고',x:1020,y:880,labelBelow:true,target:ASSIGNMENT_ID,arrival:{x:600,y:700},returnGate:{x:780,y:730},back:{x:1110,y:900}},
 {id:'market',name:'별 시장',x:1020,y:1820,target:MARKET_ID,arrival:{x:800,y:2050},returnGate:{x:900,y:1950},back:{x:1110,y:1740}},
 {id:'department',name:'부서 행성 광장',x:2580,y:1820,target:DEPARTMENT_ID,arrival:{x:2850,y:1680},returnGate:{x:2874,y:1620},back:{x:2490,y:1740}},
 {id:'black-hole',name:'블랙홀',x:2580,y:885,labelBelow:true,target:'black-hole',arrival:{x:600,y:390},back:{x:2490,y:900}}
]);
const mainLayout={...PLAZA_LAYOUT,islands:[],gateLandings:PLAZA_GATE_LANDINGS,polygons:PLAZA_POLYGONS,edges:PLAZA_EDGES,viewBounds:PLAZA_VIEW_BOUNDS};
const satelliteLayouts=Object.fromEntries(PLAZA_LAYOUT.islands.filter(z=>PLAZA_AREA_IDS[z.id]).map(z=>{
 const polygons=[ellipse(z)];return [PLAZA_AREA_IDS[z.id],{...PLAZA_LAYOUT,width:z.x+z.rx+80,height:z.y+z.ry+100,center:null,islands:[z],gates:{},polygons,edges:outerEdges(polygons),viewBounds:{x:z.x-z.rx-80,y:z.y-z.ry-100,width:z.rx*2+160,height:z.ry*2+200}}];
}));
export function plazaLayoutOf(map){return (typeof map==='string'?map:map?.id)==='space-plaza'?mainLayout:satelliteLayouts[typeof map==='string'?map:map?.id]||null;}
export function migrateLegacyPlazaPosition(position){
 if(position?.mapId!=='space-plaza')return position;
 // A new southeast landing overlaps the historical department ellipse. Valid
 // current plaza saves must stay here instead of migrating into that old map.
 if(onPlazaFloor({id:'space-plaza'},position.x,position.y))return position;
 const zone=PLAZA_LAYOUT.islands.find(z=>PLAZA_AREA_IDS[z.id]&&((position.x-z.x)/z.rx)**2+((position.y-z.y)/z.ry)**2<=1);
 if(zone)return {...position,mapId:PLAZA_AREA_IDS[zone.id]};
 const dx=position.x-1800,dy=position.y-1320;
 const point=Math.abs(dx)/780>Math.abs(dy)/480?{x:dx<0?1050:2550,y:1320}:{x:1800,y:dy<0?890:1750};
 return {...position,...point};
}
