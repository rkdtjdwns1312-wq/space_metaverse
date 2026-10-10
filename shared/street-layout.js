// 오색별빛 쉼터: 큰 상점 마당과 작은 놀이 마당을 짧은 다리로 이어 한 바닥으로 씁니다.
import {BRIDGE_WIDTH_SCALE} from './floor-geometry.js';
export const STREET_LAYOUT=Object.freeze({
  id:'star-street',width:1800,height:2000,wallWidth:10,bridgeWidth:180*BRIDGE_WIDTH_SCALE,
  upper:Object.freeze({x:900,y:650,rx:760,ry:490}),
  lower:Object.freeze({x:900,y:1550,rx:800,ry:355}),
  westGate:Object.freeze({x:80,y:650}),spawn:Object.freeze({x:260,y:650})
});
export const isStarlightStreet=id=>id===STREET_LAYOUT.id;
function ellipse(z,steps=160){return Array.from({length:steps},(_,i)=>{const a=i*Math.PI*2/steps;return {x:z.x+z.rx*Math.cos(a),y:z.y+z.ry*Math.sin(a)};});}
const half=STREET_LAYOUT.bridgeWidth/2;
const rect=(left,top,right,bottom)=>[{x:left,y:top},{x:right,y:top},{x:right,y:bottom},{x:left,y:bottom}];
export const STREET_POLYGONS=Object.freeze([
  ellipse(STREET_LAYOUT.upper),
  rect(STREET_LAYOUT.upper.x-half,1100,STREET_LAYOUT.upper.x+half,1250),
  ellipse(STREET_LAYOUT.lower),
  rect(40,STREET_LAYOUT.westGate.y-half,180,STREET_LAYOUT.westGate.y+half)
]);
function inPolygon(p,poly){let inside=false;for(let i=0,j=poly.length-1;i<poly.length;j=i++){
  const a=poly[j],b=poly[i];if((a.y>p.y)!==(b.y>p.y)&&p.x<(b.x-a.x)*(p.y-a.y)/(b.y-a.y)+a.x)inside=!inside;
}return inside;}
const cross=(a,b)=>a.x*b.y-a.y*b.x;
function outerEdges(){const edges=[];
  for(const [index,poly] of STREET_POLYGONS.entries())for(let i=0;i<poly.length;i++){
    const a=poly[i],b=poly[(i+1)%poly.length],v={x:b.x-a.x,y:b.y-a.y},cuts=[0,1];
    for(const [j,other] of STREET_POLYGONS.entries())if(j!==index)for(let k=0;k<other.length;k++){
      const c=other[k],d=other[(k+1)%other.length],w={x:d.x-c.x,y:d.y-c.y},den=cross(v,w);if(Math.abs(den)<1e-8)continue;
      const delta={x:c.x-a.x,y:c.y-a.y},t=cross(delta,w)/den,u=cross(delta,v)/den;
      if(t>0&&t<1&&u>=0&&u<=1)cuts.push(t);
    }
    cuts.sort((x,y)=>x-y);
    for(let k=1;k<cuts.length;k++){
      const start=cuts[k-1],end=cuts[k];if(end-start<1e-7)continue;
      const t=(start+end)/2,p={x:a.x+v.x*t,y:a.y+v.y*t};
      if(!STREET_POLYGONS.some((other,j)=>j!==index&&inPolygon(p,other)))edges.push([{x:a.x+v.x*start,y:a.y+v.y*start},{x:a.x+v.x*end,y:a.y+v.y*end}]);
    }
  }
  return edges;
}
export const STREET_EDGES=outerEdges();
function edgeDistance(p,a,b){const dx=b.x-a.x,dy=b.y-a.y,l=dx*dx+dy*dy,t=Math.max(0,Math.min(1,((p.x-a.x)*dx+(p.y-a.y)*dy)/(l||1)));return Math.hypot(p.x-a.x-t*dx,p.y-a.y-t*dy);}
export function streetFloorContains(x,y){const p={x,y};return STREET_POLYGONS.some(poly=>inPolygon(p,poly));}
export function onStreetFloor(map,x,y,radius=0){
  if(map?.id!=='star-street')return true;
  if(!Number.isFinite(x)||!Number.isFinite(y))return false;
  const p={x,y};return streetFloorContains(x,y)&&!STREET_EDGES.some(([a,b])=>edgeDistance(p,a,b)<radius+STREET_LAYOUT.wallWidth/2);
}
