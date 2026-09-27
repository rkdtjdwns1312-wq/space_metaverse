import test from 'node:test';
import assert from 'node:assert/strict';
import {MAP,RULES,STREET} from '../shared/config.js';
import {onParadiseFloor,isParadise} from '../shared/paradise-floor.js';
import {STREET_EDGES,STREET_LAYOUT,STREET_POLYGONS,onStreetFloor} from '../shared/street-layout.js';

test('오색별빛 쉼터 네 구역이 하나의 외곽 경계로 이어진다',()=>{
  assert.equal(STREET.width,1800);assert.equal(STREET.height,2000);
  assert.equal(STREET_LAYOUT.upper.rx,760);assert.equal(STREET_LAYOUT.lower.rx,680);
  assert.equal(isParadise(STREET.id),false);assert.equal(STREET_POLYGONS.length,4);assert.ok(STREET_EDGES.length>0);
  for(let x=STREET_LAYOUT.westGate.x;x<=STREET_LAYOUT.upper.x;x+=5)assert.ok(onStreetFloor(STREET,x,STREET_LAYOUT.upper.y,RULES.radius),`서쪽 다리 ${x}`);
  for(let y=STREET_LAYOUT.upper.y;y<=STREET_LAYOUT.lower.y;y+=5)assert.ok(onStreetFloor(STREET,STREET_LAYOUT.upper.x,y,RULES.radius),`중앙 다리 ${y}`);
  assert.ok(onParadiseFloor(STREET,STREET.spawn.x,STREET.spawn.y,RULES.radius));
  for(const object of STREET.objects)assert.ok(onStreetFloor(STREET,object.x,object.y,RULES.radius),`${object.id} 바닥 위치`);
  assert.equal(onStreetFloor(STREET,700,1175),false);
  assert.equal(onStreetFloor(STREET,900,100),false);
  assert.equal(onStreetFloor(STREET,900,1890),false);
  const returnGate=MAP.objects.find(o=>o.id==='gate-street');
  assert.deepEqual(returnGate.arrival,STREET.spawn);
  assert.equal(onStreetFloor(STREET,returnGate.arrival.x,returnGate.arrival.y,RULES.radius),true);
  assert.equal(onStreetFloor({...STREET,id:'unrelated-map'},NaN,NaN),true);
});

test('상점·조합기·오락기 5대가 위·아래 마당 배치에 포함된다',()=>{
  assert.deepEqual(STREET.objects.filter(o=>o.kind==='shop'||o.kind==='energy-shop').map(o=>[o.x,o.y]),[[580,350],[1180,367]]);
  assert.deepEqual(STREET.objects.filter(o=>o.kind==='arcade').map(o=>[o.x,o.y]),[[420,1600],[660,1600],[900,1600],[1140,1600],[1380,1600]]);
  assert.deepEqual(STREET.objects.find(o=>o.kind==='crafting')&&[STREET.objects.find(o=>o.kind==='crafting').x,STREET.objects.find(o=>o.kind==='crafting').y],[1430,650]);
  assert.equal(STREET.objects.find(o=>o.kind==='street-sign')?.name,'놀이터가는길');
  assert.deepEqual([STREET.objects.find(o=>o.kind==='street-sign').x,STREET.objects.find(o=>o.kind==='street-sign').y],[1100,1060]);
});
