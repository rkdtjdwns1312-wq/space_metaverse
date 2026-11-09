// 오색별빛 쉼터: 북쪽 발전소와 아래로 넓힌 중앙·남쪽 섬을 분리된 다리로 잇습니다.
import {BRIDGE_WIDTH_SCALE} from './floor-geometry.js';
export const STREET_LAYOUT=Object.freeze({
  id:'star-street',width:1800,height:3300,wallWidth:10,bridgeWidth:180*BRIDGE_WIDTH_SCALE,
  north:Object.freeze({x:900,y:530,rx:870,ry:490}),
  upper:Object.freeze({x:900,y:1690,rx:760,ry:570}),
  lower:Object.freeze({x:900,y:2795,rx:800,ry:355}),
  // 과학·교양 발전소 사이 위쪽에 입구와 연결 길을 둡니다.
  entrance:Object.freeze({x:900,y:80,rx:140,ry:85}),
  entranceBridge:Object.freeze({x:900,top:0,bottom:250,halfWidth:70}),
  northGate:Object.freeze({x:900,y:80}),northArrival:Object.freeze({x:900,y:200}),
  westGate:Object.freeze({x:80,y:1690}),spawn:Object.freeze({x:260,y:1690})
});
// 중앙 쉼터의 장식과 충돌 판정은 같은 좌표를 사용합니다.
export const STREET_PARK=Object.freeze({
  fountain:Object.freeze({x:850,y:1740,scale:2.4,rx:94*2.4,ry:39*2.4}),
  beds:Object.freeze([])
});
export const STAR_STATION_LAYOUT=Object.freeze({...STREET_LAYOUT,id:'star-station',spawn:{x:900,y:900},viewBounds:{x:0,y:0,width:1800,height:1160},islands:[STREET_LAYOUT.entrance,STREET_LAYOUT.north],routeLabels:[]});
export const PLAYGROUND_LAYOUT=Object.freeze({...STREET_LAYOUT,id:'star-playground',spawn:{x:900,y:2510},viewBounds:{x:0,y:2320,width:1800,height:980},islands:[STREET_LAYOUT.lower],routeLabels:[]});
const shelterLayout=Object.freeze({...STREET_LAYOUT,viewBounds:{x:0,y:1020,width:1800,height:1450},islands:[STREET_LAYOUT.upper],routeLabels:[{text:'별 발전소 가는길',x:900,y:1200},{text:'놀이터 가는길',x:900,y:2220}]});
const layouts=Object.freeze({'star-street':shelterLayout,'star-station':STAR_STATION_LAYOUT,'star-playground':PLAYGROUND_LAYOUT});
export const streetLayoutOf=value=>layouts[typeof value==='string'?value:value?.id]||null;
export const isStarlightStreet=id=>Boolean(streetLayoutOf(id));
export function migrateLegacyStreetPosition(location){
  if(!location)return location;
  const {mapId,x,y}=location;
  return {mapId:mapId==='star-street'&&!streetFloorContains(x,y)?(y<1120?'star-station':y>2260?'star-playground':mapId):mapId,x,y};
}
function ellipse(z,steps=160){return Array.from({length:steps},(_,i)=>{const a=i*Math.PI*2/steps;return {x:z.x+z.rx*Math.cos(a),y:z.y+z.ry*Math.sin(a)};});}
const half=STREET_LAYOUT.bridgeWidth/2;
const rect=(left,top,right,bottom)=>[{x:left,y:top},{x:right,y:top},{x:right,y:bottom},{x:left,y:bottom}];
const polygonsById={
  'star-street':[ellipse(STREET_LAYOUT.upper),rect(900-half,1060,900+half,1170),rect(900-half,2215,900+half,2430),rect(40,1690-half,180,1690+half)],
  'star-station':[ellipse(STREET_LAYOUT.entrance),rect(830,0,970,250),ellipse(STREET_LAYOUT.north),rect(900-half,970,900+half,1130)],
  'star-playground':[ellipse(STREET_LAYOUT.lower),rect(900-half,2360,900+half,2485)]
};
export const STREET_POLYGONS=Object.freeze(polygonsById['star-street']);
function inPolygon(p,poly){let inside=false;for(let i=0,j=poly.length-1;i<poly.length;j=i++){
  const a=poly[j],b=poly[i];if((a.y>p.y)!==(b.y>p.y)&&p.x<(b.x-a.x)*(p.y-a.y)/(b.y-a.y)+a.x)inside=!inside;
}return inside;}
const cross=(a,b)=>a.x*b.y-a.y*b.x;
function outerEdges(polygons){const edges=[];
  for(const [index,poly] of polygons.entries())for(let i=0;i<poly.length;i++){
    const a=poly[i],b=poly[(i+1)%poly.length],v={x:b.x-a.x,y:b.y-a.y},cuts=[0,1];
    for(const [j,other] of polygons.entries())if(j!==index)for(let k=0;k<other.length;k++){
      const c=other[k],d=other[(k+1)%other.length],w={x:d.x-c.x,y:d.y-c.y},den=cross(v,w);if(Math.abs(den)<1e-8)continue;
      const delta={x:c.x-a.x,y:c.y-a.y},t=cross(delta,w)/den,u=cross(delta,v)/den;
      if(t>0&&t<1&&u>=0&&u<=1)cuts.push(t);
    }
    cuts.sort((x,y)=>x-y);
    for(let k=1;k<cuts.length;k++){
      const start=cuts[k-1],end=cuts[k];if(end-start<1e-7)continue;
      const t=(start+end)/2,p={x:a.x+v.x*t,y:a.y+v.y*t};
      if(!polygons.some((other,j)=>j!==index&&inPolygon(p,other)))edges.push([{x:a.x+v.x*start,y:a.y+v.y*start},{x:a.x+v.x*end,y:a.y+v.y*end}]);
    }
  }
  return edges;
}
const geometries=Object.fromEntries(Object.entries(polygonsById).map(([id,polygons])=>{
const edges=outerEdges(polygons);
// Reject distant polygons/edges before ray casting or measuring a segment.
// These bounds only skip impossible candidates; the original exact tests below
// still decide every contact, including bridge joins and large-avatar margins.
const polygonBounds=polygons.map(poly=>({poly,minX:Math.min(...poly.map(p=>p.x)),maxX:Math.max(...poly.map(p=>p.x)),minY:Math.min(...poly.map(p=>p.y)),maxY:Math.max(...poly.map(p=>p.y))}));
const edgeBounds=edges.map(([a,b])=>({a,b,minX:Math.min(a.x,b.x),maxX:Math.max(a.x,b.x),minY:Math.min(a.y,b.y),maxY:Math.max(a.y,b.y)}));
return [id,Object.freeze({polygons:Object.freeze(polygons),edges:Object.freeze(edges),polygonBounds,edgeBounds})];
}));
export const streetGeometryOf=value=>geometries[typeof value==='string'?value:value?.id]||null;
export const STREET_EDGES=geometries['star-street'].edges;
function edgeDistance(p,a,b){const dx=b.x-a.x,dy=b.y-a.y,l=dx*dx+dy*dy,t=Math.max(0,Math.min(1,((p.x-a.x)*dx+(p.y-a.y)*dy)/(l||1)));return Math.hypot(p.x-a.x-t*dx,p.y-a.y-t*dy);}
export function streetFloorContains(x,y,mapOrId='star-street'){const p={x,y};return Boolean(streetGeometryOf(mapOrId)?.polygonBounds.some(b=>x>=b.minX&&x<=b.maxX&&y>=b.minY&&y<=b.maxY&&inPolygon(p,b.poly)));}
export function onStreetFloor(map,x,y,radius=0){
  const geometry=streetGeometryOf(map);if(!geometry)return true;
  if(!Number.isFinite(x)||!Number.isFinite(y))return false;
  const p={x,y},margin=radius+STREET_LAYOUT.wallWidth/2;
  return streetFloorContains(x,y,map)&&!geometry.edgeBounds.some(b=>x>=b.minX-margin&&x<=b.maxX+margin&&y>=b.minY-margin&&y<=b.maxY+margin&&edgeDistance(p,b.a,b.b)<margin);
}
