import test from 'node:test';
import assert from 'node:assert/strict';
import {onPlazaFloor,plazaLayoutOf,PLAZA_LAYOUT} from '../shared/plaza-layout.js';

// Independent exhaustive reference from before broad-phase optimization.
function reference(map,x,y,radius){
  const l=plazaLayoutOf(map);if(!l)return true;if(!Number.isFinite(x)||!Number.isFinite(y))return false;
  const inside=poly=>{let result=false;for(let i=0,j=poly.length-1;i<poly.length;j=i++){
    const a=poly[i],b=poly[j];if((a.y>y)!==(b.y>y)&&x<(b.x-a.x)*(y-a.y)/(b.y-a.y)+a.x)result=!result;
  }return result;};
  return l.polygons.some(inside)&&!l.edges.some(([a,b])=>{
    const dx=b.x-a.x,dy=b.y-a.y,t=Math.max(0,Math.min(1,((x-a.x)*dx+(y-a.y)*dy)/(dx*dx+dy*dy||1)));
    return Math.hypot(x-a.x-t*dx,y-a.y-t*dy)<radius+PLAZA_LAYOUT.wall/2;
  });
}
for(const id of ['space-plaza','assignment-archive','star-market','department-plaza'])test(id+' retains exact floor/gate boundaries across levels',()=>{
  const map={id},l=plazaLayoutOf(map),v=l.viewBounds;
  const points=[];
  for(let y=v.y-10;y<=v.y+v.height+10;y+=43)for(let x=v.x-10;x<=v.x+v.width+10;x+=47)points.push([x,y]);
  for(const [a,b] of l.edges)for(const offset of [-50,-6,0,6,50])points.push([(a.x+b.x)/2+offset,(a.y+b.y)/2+offset]);
  for(const radius of [0,8,32,54.08])for(const [x,y] of points)assert.equal(onPlazaFloor(map,x,y,radius),reference(map,x,y,radius),`${id} ${x},${y} r${radius}`);
  assert.equal(onPlazaFloor(map,NaN,0),false);
});
