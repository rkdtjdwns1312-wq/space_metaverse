import test from 'node:test';
import assert from 'node:assert/strict';
import {MAP,RULES,STREET} from '../shared/config.js';
import {onParadiseFloor,isParadise} from '../shared/paradise-floor.js';
import {STREET_EDGES,STREET_LAYOUT,STREET_POLYGONS,onStreetFloor} from '../shared/street-layout.js';

test('오색별빛 쉼터의 발전소·상점·놀이터가 하나의 외곽 경계로 이어진다',()=>{
  assert.equal(STREET.width,1800);assert.equal(STREET.height,3300);
  assert.equal(STREET_LAYOUT.upper.rx,760);assert.equal(STREET_LAYOUT.lower.rx,800);
  assert.equal(isParadise(STREET.id),false);assert.equal(STREET_POLYGONS.length,6);assert.ok(STREET_EDGES.length>0);
  for(let x=STREET_LAYOUT.westGate.x;x<=STREET_LAYOUT.upper.x;x+=5)assert.ok(onStreetFloor(STREET,x,STREET_LAYOUT.upper.y,RULES.radius),`서쪽 다리 ${x}`);
  for(let y=STREET_LAYOUT.north.y;y<=STREET_LAYOUT.upper.y;y+=5)assert.ok(onStreetFloor(STREET,STREET_LAYOUT.upper.x,y,RULES.radius),`북쪽 발전소 다리 ${y}`);
  for(let y=STREET_LAYOUT.upper.y;y<=STREET_LAYOUT.lower.y;y+=5)assert.ok(onStreetFloor(STREET,STREET_LAYOUT.upper.x,y,RULES.radius),`중앙·남쪽 다리 ${y}`);
  assert.ok(onParadiseFloor(STREET,STREET.spawn.x,STREET.spawn.y,RULES.radius));
  for(const object of STREET.objects)assert.ok(onStreetFloor(STREET,object.x,object.y,RULES.radius),`${object.id} 바닥 위치`);
  assert.equal(STREET_LAYOUT.upper.y-STREET_LAYOUT.upper.ry-STREET_LAYOUT.north.y-STREET_LAYOUT.north.ry,200,'북쪽과 중앙 섬 사이에 분명한 간격이 있다');
  assert.equal(STREET_LAYOUT.lower.y-STREET_LAYOUT.lower.ry-STREET_LAYOUT.upper.y-STREET_LAYOUT.upper.ry,180,'중앙과 남쪽 섬 사이에 분명한 간격이 있다');
  assert.equal(onStreetFloor(STREET,600,950),false,'북쪽 다리 옆은 바닥으로 채우지 않는다');
  assert.equal(onStreetFloor(STREET,150,2350),false,'남쪽 다리 옆은 바닥으로 채우지 않는다');
  assert.equal(onStreetFloor(STREET,900,20),false);
  assert.equal(onStreetFloor(STREET,900,3290),false);
  const returnGate=MAP.objects.find(o=>o.id==='gate-street');
  assert.deepEqual(returnGate.arrival,STREET.spawn);
  assert.equal(onStreetFloor(STREET,returnGate.arrival.x,returnGate.arrival.y,RULES.radius),true);
  assert.equal(onStreetFloor({...STREET,id:'unrelated-map'},NaN,NaN),true);
});

test('발전소·상점·조합기·오락기가 북·중앙·남쪽 마당에 배치된다',()=>{
  const stations=STREET.objects.filter(o=>o.kind.endsWith('-station'));
  assert.equal(stations.length,5);
  assert.deepEqual(stations.slice(0,2).map(o=>[o.x,o.y]),[[300,600],[1500,600]]);
  const top=stations.slice(2);assert(top[1].y<top[0].y&&top[1].y<top[2].y);
  for(const o of stations){assert(onStreetFloor(STREET,o.x,o.y,o.radius));assert(onStreetFloor(STREET,o.x,o.y+o.radius+60,30));}
  assert(STREET_LAYOUT.north.rx*STREET_LAYOUT.north.ry>720*300*1.5);
  assert.deepEqual(STREET.objects.filter(o=>o.kind==='shop'||o.kind==='energy-shop').map(o=>[o.x,o.y]),[[580,1590],[1180,1607]]);
  assert.deepEqual(STREET.objects.filter(o=>o.kind==='arcade').map(o=>[o.x,o.y]),[[300,2900],[500,2900],[700,2900],[900,2900],[1100,2900],[1300,2900],[1500,2900]]);
  assert.deepEqual(STREET.objects.find(o=>o.kind==='crafting')&&[STREET.objects.find(o=>o.kind==='crafting').x,STREET.objects.find(o=>o.kind==='crafting').y],[1430,1840]);
  assert.equal(STREET.objects.find(o=>o.kind==='street-sign')?.name,'놀이터가는길');
  assert.deepEqual([STREET.objects.find(o=>o.kind==='street-sign').x,STREET.objects.find(o=>o.kind==='street-sign').y],[900,2350]);
  assert.equal(STREET.objects.find(o=>o.id==='station-sign')?.name,'별 발전소 가는길');
});
