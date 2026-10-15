// 문 뒤의 짧은 여백까지 바닥 그림을 연장합니다. 공유 충돌 도형은 변경하지 않습니다.
const key=p=>`${Math.round(p.x*1e6)},${Math.round(p.y*1e6)}`;
export function visualFloor(polygons,edges,map,gates){
  const replacements=new Map(),caps=[];
  for(const gate of gates){
    const horizontal=Math.abs(gate.x-map.width/2)>Math.abs(gate.y-map.height/2);
    const axis=horizontal?'x':'y',cross=horizontal?'y':'x',size=horizontal?map.width:map.height;
    const target=gate[axis]<size/2?0:size;
    const candidates=edges.filter(([a,b])=>Math.abs(a[axis]-b[axis])<1e-6&&Math.abs(a[cross]-b[cross])>64&&gate[cross]>=Math.min(a[cross],b[cross])-1&&gate[cross]<=Math.max(a[cross],b[cross])+1);
    candidates.sort(([a],[b])=>Math.abs(a[axis]-gate[axis])-Math.abs(b[axis]-gate[axis]));
    const cap=candidates[0];if(!cap||Math.abs(cap[0][axis]-gate[axis])>size*.15)continue;
    for(const p of cap)replacements.set(key(p),{...p,[axis]:target});
    caps.push({axis,target,from:cap[0][axis],min:Math.min(cap[0][cross],cap[1][cross]),max:Math.max(cap[0][cross],cap[1][cross])});
  }
  const point=p=>({...p,...replacements.get(key(p))});
  return {polygons:polygons.map(poly=>poly.map(point)),edges:edges.map(edge=>edge.map(point)),caps};
}
export function visualFloorPath(polygons){
  const path=new Path2D();
  for(const poly of polygons){path.moveTo(poly[0].x,poly[0].y);for(const p of poly.slice(1))path.lineTo(p.x,p.y);path.closePath();}
  return path;
}
const gateFloors=new WeakMap();
export function visualGateFloor(floor,map){
  if(!floor)return null;
  if(!gateFloors.has(floor)){
    const edges=floor.points.map((p,i)=>[p,floor.points[(i+1)%floor.points.length]]);
    const visual=visualFloor([floor.points],edges,map,map.objects.filter(o=>o.kind==='gate'));
    gateFloors.set(floor,{...floor,points:visual.polygons[0],visualCaps:visual.caps});
  }
  return gateFloors.get(floor);
}
