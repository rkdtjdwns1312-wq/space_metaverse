import test from 'node:test';
import assert from 'node:assert/strict';
import {MAP,RULES,STREET} from '../shared/config.js';
import {onParadiseFloor,isParadise} from '../shared/paradise-floor.js';
import {STREET_EDGES,STREET_LAYOUT,STREET_POLYGONS,onStreetFloor} from '../shared/street-layout.js';

test('오색별빛 쉼터의 발전소·상점·놀이터가 하나의 외곽 경계로 이어진다',()=>{
  assert.equal(STREET.width,1800);assert.equal(STREET.height,2700);
  assert.equal(STREET_LAYOUT.upper.rx,760);assert.equal(STREET_LAYOUT.lower.rx,800);
  assert.equal(isParadise(STREET.id),false);assert.equal(STREET_POLYGONS.length,6);assert.ok(STREET_EDGES.length>0);
  for(let x=STREET_LAYOUT.westGate.x;x<=STREET_LAYOUT.upper.x;x+=5)assert.ok(onStreetFloor(STREET,x,STREET_LAYOUT.upper.y,RULES.radius),`서쪽 다리 ${x}`);
  for(let y=STREET_LAYOUT.north.y;y<=STREET_LAYOUT.upper.y;y+=5)assert.ok(onStreetFloor(STREET,STREET_LAYOUT.upper.x,y,RULES.radius),`발전소 다리 ${y}`);
  for(let y=STREET_LAYOUT.upper.y;y<=STREET_LAYOUT.lower.y;y+=5)assert.ok(onStreetFloor(STREET,STREET_LAYOUT.upper.x,y,RULES.radius),`중앙 다리 ${y}`);
  assert.ok(onParadiseFloor(STREET,STREET.spawn.x,STREET.spawn.y,RULES.radius));
  for(const object of STREET.objects)assert.ok(onStreetFloor(STREET,object.x,object.y,RULES.radius),`${object.id} 바닥 위치`);
  assert.equal(onStreetFloor(STREET,700,1695),false);
  assert.equal(onStreetFloor(STREET,900,20),false);
  assert.equal(onStreetFloor(STREET,900,2650),false);
  const returnGate=MAP.objects.find(o=>o.id==='gate-street');
  assert.deepEqual(returnGate.arrival,STREET.spawn);
  assert.equal(onStreetFloor(STREET,returnGate.arrival.x,returnGate.arrival.y,RULES.radius),true);
  assert.equal(onStreetFloor({...STREET,id:'unrelated-map'},NaN,NaN),true);
});

test('발전소·상점·조합기·오락기가 북·중앙·남쪽 마당에 배치된다',()=>{
  assert.deepEqual(STREET.objects.filter(o=>o.kind==='math-station'||o.kind==='english-station').map(o=>[o.x,o.y]),[[545,400],[1255,400]]);
  assert.deepEqual(STREET.objects.filter(o=>o.kind==='shop'||o.kind==='energy-shop').map(o=>[o.x,o.y]),[[580,870],[1180,887]]);
  assert.deepEqual(STREET.objects.filter(o=>o.kind==='arcade').map(o=>[o.x,o.y]),[[300,2120],[500,2120],[700,2120],[900,2120],[1100,2120],[1300,2120],[1500,2120]]);
  assert.deepEqual(STREET.objects.find(o=>o.kind==='crafting')&&[STREET.objects.find(o=>o.kind==='crafting').x,STREET.objects.find(o=>o.kind==='crafting').y],[1430,1170]);
  assert.equal(STREET.objects.find(o=>o.kind==='street-sign')?.name,'놀이터가는길');
  assert.deepEqual([STREET.objects.find(o=>o.kind==='street-sign').x,STREET.objects.find(o=>o.kind==='street-sign').y],[1100,1580]);
  assert.equal(STREET.objects.find(o=>o.id==='station-sign')?.name,'별 발전소 가는길');
});
