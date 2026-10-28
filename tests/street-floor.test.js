import test from 'node:test';
import assert from 'node:assert/strict';
import {MAP,RULES,STREET} from '../shared/config.js';
import {onParadiseFloor,isParadise} from '../shared/paradise-floor.js';
import {STREET_EDGES,STREET_LAYOUT,STREET_POLYGONS,onStreetFloor} from '../shared/street-layout.js';
import {avatarPositionIsClear} from '../shared/avatar-boundary.js';

test('오색별빛 쉼터의 발전소·상점·놀이터가 하나의 외곽 경계로 이어진다',()=>{
  assert.equal(STREET.width,1800);assert.equal(STREET.height,3300);
  assert.equal(STREET_LAYOUT.upper.rx,760);assert.equal(STREET_LAYOUT.lower.rx,800);
  assert.equal(isParadise(STREET.id),false);assert.equal(STREET_POLYGONS.length,6);assert.ok(STREET_EDGES.length>0);
  for(let x=STREET_LAYOUT.westGate.x;x<=STREET_LAYOUT.upper.x;x+=5)assert.ok(onStreetFloor(STREET,x,STREET_LAYOUT.upper.y,RULES.radius),`서쪽 다리 ${x}`);
  for(let y=STREET_LAYOUT.north.y;y<=STREET_LAYOUT.upper.y;y+=5)assert.ok(onStreetFloor(STREET,STREET_LAYOUT.upper.x,y,RULES.radius),`북쪽 발전소 다리 ${y}`);
  for(let y=STREET_LAYOUT.upper.y;y<=STREET_LAYOUT.lower.y;y+=5)assert.ok(onStreetFloor(STREET,STREET_LAYOUT.upper.x,y,RULES.radius),`중앙·남쪽 다리 ${y}`);
  assert.ok(onParadiseFloor(STREET,STREET.spawn.x,STREET.spawn.y,RULES.radius));
  for(const object of STREET.objects)assert.ok(onStreetFloor(STREET,object.x,object.y,RULES.radius),`${object.id} 바닥 위치`);
  assert.equal(STREET_LAYOUT.upper.y-STREET_LAYOUT.upper.ry-STREET_LAYOUT.north.y-STREET_LAYOUT.north.ry,100,'북쪽과 중앙 섬 사이에 분명한 간격이 있다');
  assert.equal(STREET_LAYOUT.lower.y-STREET_LAYOUT.lower.ry-STREET_LAYOUT.upper.y-STREET_LAYOUT.upper.ry,180,'중앙과 남쪽 섬 사이에 분명한 간격이 있다');
  assert.equal(onStreetFloor(STREET,600,1070),false,'북쪽 다리 옆은 바닥으로 채우지 않는다');
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
  assert.deepEqual(stations.slice(0,2).map(o=>[o.x,o.y]),[[250,650],[1550,650]]);
  const top=stations.slice(2);assert(top[1].y<top[0].y&&top[1].y<top[2].y);
  for(const o of stations){assert(onStreetFloor(STREET,o.x,o.y,o.radius));assert(onStreetFloor(STREET,o.x,o.y+o.radius+60,30));}
  assert(STREET_LAYOUT.north.rx*STREET_LAYOUT.north.ry>720*300*1.5);
  assert.deepEqual(STREET.objects.filter(o=>o.kind==='shop'||o.kind==='energy-shop').map(o=>[o.x,o.y]),[[1290,1450],[1290,1980]]);
  assert.deepEqual(STREET.objects.filter(o=>o.kind==='arcade').map(o=>[o.x,o.y]),[[300,2900],[500,2900],[700,2900],[900,2900],[1100,2900],[1300,2900],[1500,2900]]);
  assert.deepEqual(STREET.objects.find(o=>o.kind==='crafting')&&[STREET.objects.find(o=>o.kind==='crafting').x,STREET.objects.find(o=>o.kind==='crafting').y],[1450,1730]);
  assert.equal(STREET.objects.find(o=>o.kind==='street-sign')?.name,'놀이터가는길');
  assert.deepEqual([STREET.objects.find(o=>o.kind==='street-sign').x,STREET.objects.find(o=>o.kind==='street-sign').y],[900,2350]);
  assert.equal(STREET.objects.find(o=>o.id==='station-sign')?.name,'별 발전소 가는길');
});

test('쉼터 공원 분수를 돌아가는 통로·상점 진입로가 열리고 발전소 중심 여유가 늘어난다',()=>{
  const old={ 'math-station':[300,600], 'english-station':[1500,600], 'history-station':[550,370], 'science-station':[900,290], 'culture-station':[1250,370] };
  for(const o of STREET.objects.filter(o=>o.kind.endsWith('-station'))){
    assert(Math.hypot(o.x-900,o.y-530)>Math.hypot(old[o.id][0]-900,old[o.id][1]-480),o.id+' 중앙에서 멀어짐');
  }
  const shop=STREET.objects.find(o=>o.kind==='shop'),craft=STREET.objects.find(o=>o.kind==='crafting'),energy=STREET.objects.find(o=>o.kind==='energy-shop');
  assert(shop.y<craft.y&&craft.y<energy.y);assert(craft.x>shop.x&&craft.x>energy.x);
  const walker={role:'student',avatar:{level:2,constellationId:'aries'}};
  for(let y=1160;y<=1280;y+=10)assert(avatarPositionIsClear(STREET,900,y,walker),`북쪽 접근 ${y}`);
  for(let x=900;x<=1060;x+=10)assert(avatarPositionIsClear(STREET,x,1280,walker),`위 화단 우회 ${x}`);
  for(let y=1280;y<=2200;y+=10)assert(avatarPositionIsClear(STREET,1060,y,walker),`분수 오른쪽 열린 통로 ${y}`);
  for(let x=900;x<=1060;x+=10)assert(avatarPositionIsClear(STREET,x,2200,walker),`아래 화단 우회 ${x}`);
  for(let y=2200;y<=2250;y+=10)assert(avatarPositionIsClear(STREET,900,y,walker),`남쪽 출구 ${y}`);
  for(let y=1590;y<=1910;y+=10)assert(avatarPositionIsClear(STREET,670,y,walker),`왼쪽 화단과 분수 사이 통로 ${y}`);
  for(const o of [shop,craft,energy]){
    assert(onStreetFloor(STREET,o.x,o.y+o.radius+45,20),o.id+' 입구');
  }
});
