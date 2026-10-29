import test from 'node:test';
import assert from 'node:assert/strict';
import {visualFloor,visualGateFloor} from '../client/visual-floor.js';
import {STATIC_MAPS} from '../shared/config.js';
import {PLAZA_LAYOUT,PLAZA_POLYGONS,PLAZA_EDGES} from '../shared/plaza-layout.js';
import {STREET_LAYOUT,STREET_POLYGONS,STREET_EDGES} from '../shared/street-layout.js';
import {VALLEY_LAYOUT,VALLEY_POLYGONS,VALLEY_EDGES} from '../shared/valley-layout.js';
import {paradiseFloor} from '../shared/paradise-floor.js';
import {originFloor} from '../shared/origin-floor.js';

function checkCaps(visual,count){
  assert.equal(visual.caps.length,count);
  for(const cap of visual.caps){
    const cross=cap.axis==='x'?'y':'x';
    assert.ok(visual.edges.some(([a,b])=>a[cap.axis]===cap.target&&b[cap.axis]===cap.target&&Math.min(a[cross],b[cross])===cap.min&&Math.max(a[cross],b[cross])===cap.max),'바닥 전체 폭이 화면 가장자리까지 이어져야 합니다.');
  }
}
for(const [name,map,polygons,edges,gates] of [
  ['광장',PLAZA_LAYOUT,PLAZA_POLYGONS,PLAZA_EDGES,Object.values(PLAZA_LAYOUT.gates)],
  ['쉼터',STREET_LAYOUT,STREET_POLYGONS,STREET_EDGES,[STREET_LAYOUT.westGate]],
  ['계곡',VALLEY_LAYOUT,VALLEY_POLYGONS,VALLEY_EDGES,[VALLEY_LAYOUT.gate]],
])test(`${name}: 문 뒤 바닥 전체 폭만 연장하며 공유 논리 도형과 내부 접합은 보존`,()=>{
  const before=JSON.stringify({polygons,edges}),v=visualFloor(polygons,edges,map,gates);
  checkCaps(v,gates.length);assert.equal(JSON.stringify({polygons,edges}),before);
  for(let i=0;i<edges.length;i++)for(let j=0;j<2;j++){
    const p=edges[i][j];
    if(!v.caps.some(c=>Math.abs(p[c.axis]-c.from)<1e-6))assert.deepEqual(v.edges[i][j],p);
  }
});
test('낙원·태초 모든 문: 전체 폭 연장, 원본 및 캐시 보존',()=>{
  let checked=0;
  for(const map of Object.values(STATIC_MAPS)){
    const floor=originFloor(map)||paradiseFloor(map);if(!floor)continue;
    const before=JSON.stringify(floor),v=visualGateFloor(floor,map);
    checkCaps({caps:v.visualCaps,edges:v.points.map((p,i)=>[p,v.points[(i+1)%v.points.length]])},map.objects.filter(o=>o.kind==='gate').length);
    assert.equal(JSON.stringify(floor),before);assert.equal(visualGateFloor(floor,map),v);checked++;
  }
  assert.equal(checked,16);
});
