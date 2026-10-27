import test from 'node:test';
import assert from 'node:assert/strict';
import {STREET_LAYOUT as L,STREET_POLYGONS,STREET_EDGES,onStreetFloor,streetFloorContains} from '../shared/street-layout.js';

// Independent pre-optimization reference: exercise random points and both sides
// of every edge, rather than merely repeating the bounding-box implementation.
function inside(x,y,poly){let hit=false;for(let i=0,j=poly.length-1;i<poly.length;j=i++){const a=poly[j],b=poly[i];if((a.y>y)!==(b.y>y)&&x<(b.x-a.x)*(y-a.y)/(b.y-a.y)+a.x)hit=!hit;}return hit;}
function contains(x,y){return STREET_POLYGONS.some(p=>inside(x,y,p));}
function distance(x,y,a,b){const dx=b.x-a.x,dy=b.y-a.y,length=dx*dx+dy*dy,t=Math.max(0,Math.min(1,((x-a.x)*dx+(y-a.y)*dy)/(length||1)));return Math.hypot(x-a.x-t*dx,y-a.y-t*dy);}
function reference(x,y,r){return Number.isFinite(x)&&Number.isFinite(y)&&contains(x,y)&&!STREET_EDGES.some(([a,b])=>distance(x,y,a,b)<r+L.wallWidth/2);}
test('street broad-phase bounds preserve legacy floor results for seeded points and every edge contact',()=>{
  let seed=491826;const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
  const points=Array.from({length:10000},()=>[random()*(L.width+400)-200,random()*(L.height+400)-200,[0,8,16,32,64,120][Math.floor(random()*6)]]);
  for(const [a,b] of STREET_EDGES){const dx=b.x-a.x,dy=b.y-a.y,length=Math.hypot(dx,dy)||1,mx=(a.x+b.x)/2,my=(a.y+b.y)/2;
    for(const r of [0,8,32,64])for(const side of [-1,1])for(const epsilon of [-1e-7,0,1e-7]){
      const offset=side*(r+L.wallWidth/2+epsilon);points.push([mx-dy/length*offset,my+dx/length*offset,r]);
    }
  }
  for(const [x,y,r] of points){assert.equal(streetFloorContains(x,y),contains(x,y),`contain ${x},${y}`);assert.equal(onStreetFloor(L,x,y,r),reference(x,y,r),`clearance ${x},${y},${r}`);}
});
