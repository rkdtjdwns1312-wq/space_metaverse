// 오색별빛 쉼터: 북쪽 발전소와 아래로 넓힌 중앙·남쪽 섬을 분리된 다리로 잇습니다.
import {BRIDGE_WIDTH_SCALE} from './floor-geometry.js';
export const STREET_LAYOUT=Object.freeze({
  id:'star-street',width:1800,height:3300,wallWidth:10,bridgeWidth:180*BRIDGE_WIDTH_SCALE,
  north:Object.freeze({x:900,y:530,rx:870,ry:490}),
  upper:Object.freeze({x:900,y:1690,rx:760,ry:570}),
  lower:Object.freeze({x:900,y:2795,rx:800,ry:355}),
  westGate:Object.freeze({x:80,y:1690}),spawn:Object.freeze({x:260,y:1690})
});
// 중앙 쉼터의 장식과 충돌 판정은 같은 좌표를 사용합니다.
export const STREET_PARK=Object.freeze({
  fountain:Object.freeze({x:850,y:1740,rx:94,ry:39}),
  beds:Object.freeze([
    Object.freeze({x:555,y:1510,rx:95,ry:49,seed:1}),
    Object.freeze({x:1115,y:1535,rx:91,ry:48,seed:2}),
    Object.freeze({x:560,y:1945,rx:95,ry:49,seed:3}),
    Object.freeze({x:1110,y:1920,rx:91,ry:48,seed:4})
  ])
});
export const isStarlightStreet=id=>id===STREET_LAYOUT.id;
function ellipse(z,steps=160){return Array.from({length:steps},(_,i)=>{const a=i*Math.PI*2/steps;return {x:z.x+z.rx*Math.cos(a),y:z.y+z.ry*Math.sin(a)};});}
const half=STREET_LAYOUT.bridgeWidth/2;
const rect=(left,top,right,bottom)=>[{x:left,y:top},{x:right,y:top},{x:right,y:bottom},{x:left,y:bottom}];
export const STREET_POLYGONS=Object.freeze([
  ellipse(STREET_LAYOUT.north),
  rect(STREET_LAYOUT.north.x-half,STREET_LAYOUT.north.y+STREET_LAYOUT.north.ry-35,STREET_LAYOUT.north.x+half,STREET_LAYOUT.upper.y-STREET_LAYOUT.upper.ry+35),
  ellipse(STREET_LAYOUT.upper),
  rect(STREET_LAYOUT.upper.x-half,STREET_LAYOUT.upper.y+STREET_LAYOUT.upper.ry-45,STREET_LAYOUT.upper.x+half,STREET_LAYOUT.lower.y-STREET_LAYOUT.lower.ry+45),
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
// Reject distant polygons/edges before ray casting or measuring a segment.
// These bounds only skip impossible candidates; the original exact tests below
// still decide every contact, including bridge joins and large-avatar margins.
const polygonBounds=STREET_POLYGONS.map(poly=>({poly,minX:Math.min(...poly.map(p=>p.x)),maxX:Math.max(...poly.map(p=>p.x)),minY:Math.min(...poly.map(p=>p.y)),maxY:Math.max(...poly.map(p=>p.y))}));
const edgeBounds=STREET_EDGES.map(([a,b])=>({a,b,minX:Math.min(a.x,b.x),maxX:Math.max(a.x,b.x),minY:Math.min(a.y,b.y),maxY:Math.max(a.y,b.y)}));
function edgeDistance(p,a,b){const dx=b.x-a.x,dy=b.y-a.y,l=dx*dx+dy*dy,t=Math.max(0,Math.min(1,((p.x-a.x)*dx+(p.y-a.y)*dy)/(l||1)));return Math.hypot(p.x-a.x-t*dx,p.y-a.y-t*dy);}
export function streetFloorContains(x,y){const p={x,y};return polygonBounds.some(b=>x>=b.minX&&x<=b.maxX&&y>=b.minY&&y<=b.maxY&&inPolygon(p,b.poly));}
export function onStreetFloor(map,x,y,radius=0){
  if(map?.id!=='star-street')return true;
  if(!Number.isFinite(x)||!Number.isFinite(y))return false;
  const p={x,y},margin=radius+STREET_LAYOUT.wallWidth/2;
  return streetFloorContains(x,y)&&!edgeBounds.some(b=>x>=b.minX-margin&&x<=b.maxX+margin&&y>=b.minY-margin&&y<=b.maxY+margin&&edgeDistance(p,b.a,b.b)<margin);
}
