import test from 'node:test';
import assert from 'node:assert/strict';
import {MAP,RULES,STREET,STAR_STATION,PLAYGROUND,STATIC_MAPS} from '../shared/config.js';
import {onParadiseFloor,isParadise} from '../shared/paradise-floor.js';
import {STREET_EDGES,STREET_LAYOUT,STREET_POLYGONS,onStreetFloor,migrateLegacyStreetPosition} from '../shared/street-layout.js';
import {avatarPositionIsClear} from '../shared/avatar-boundary.js';

test('쉼터와 발전소와 놀이터는 독립 바닥이며 모든 문과 도착점은 연결된다',()=>{
  assert.equal(STREET_POLYGONS.length,4);assert.ok(STREET_EDGES.length>0);
  for(const map of [STREET,STAR_STATION,PLAYGROUND]){
    assert.equal(isParadise(map.id),false);
    assert(onParadiseFloor(map,map.spawn.x,map.spawn.y,RULES.radius));
    for(const object of map.objects)assert(onStreetFloor(map,object.x,object.y,RULES.radius),map.id+' '+object.id);
    for(const gate of map.objects.filter(o=>o.kind==='gate')){
      const target=STATIC_MAPS[gate.target];
      for(const player of [{role:'student',avatar:{level:1}},{role:'student',avatar:{level:5}},{role:'teacher',avatar:{}}])assert(avatarPositionIsClear(target,gate.arrival.x,gate.arrival.y,player),map.id+' '+gate.id);
    }
  }
  assert.equal(onStreetFloor(STREET,900,530),false);assert.equal(onStreetFloor(STREET,900,2795),false);
  assert.equal(onStreetFloor(STAR_STATION,900,1690),false);assert.equal(onStreetFloor(PLAYGROUND,900,1690),false);
  for(const y of [1110,1250,2190,2350])assert.equal(migrateLegacyStreetPosition({mapId:STREET.id,x:900,y}).mapId,STREET.id);
  assert.equal(migrateLegacyStreetPosition({mapId:STREET.id,x:900,y:650}).mapId,STAR_STATION.id);
  assert.equal(migrateLegacyStreetPosition({mapId:STREET.id,x:900,y:2900}).mapId,PLAYGROUND.id);
  assert.deepEqual(MAP.objects.find(o=>o.id==='gate-street').arrival,STREET.spawn);
});

test('발전소·상점·조합기·오락기가 북·중앙·남쪽 마당에 배치된다',()=>{
  const stations=STAR_STATION.objects.filter(o=>o.kind.endsWith('-station'));
  assert.equal(stations.length,6);
  assert.deepEqual(stations.slice(0,2).map(o=>[o.x,o.y]),[[575,780],[1550,530]]);
  const top=stations.slice(2);assert(top[1].y<top[0].y&&top[1].y===top[2].y);
  for(const o of stations){assert(onStreetFloor(STAR_STATION,o.x,o.y,o.radius));assert(onStreetFloor(STAR_STATION,o.x,o.y+(o.kind==='art-station'?100:o.radius+60),30));}
  assert(STREET_LAYOUT.north.rx*STREET_LAYOUT.north.ry>720*300*1.5);
  assert.deepEqual(STREET.objects.filter(o=>o.kind==='shop'||o.kind==='energy-shop').map(o=>[o.x,o.y]),[[1290,1450],[1290,1980]]);
  assert.deepEqual(PLAYGROUND.objects.filter(o=>o.kind==='arcade').map(o=>[o.x,o.y]),[[300,2900],[500,2900],[700,2900],[900,2900],[1100,2900],[1300,2900],[1500,2900]]);
  assert.deepEqual(STREET.objects.find(o=>o.kind==='crafting')&&[STREET.objects.find(o=>o.kind==='crafting').x,STREET.objects.find(o=>o.kind==='crafting').y],[1450,1730]);
  assert.equal(STREET.objects.find(o=>o.id==='gate-station').target,STAR_STATION.id);
  assert.equal(STREET.objects.find(o=>o.id==='gate-playground').target,PLAYGROUND.id);
});

test('쉼터 공원 분수를 돌아가는 통로·상점 진입로가 열리고 발전소 중심 여유가 늘어난다',()=>{
  const old={ 'math-station':[300,600], 'english-station':[1500,600], 'history-station':[550,370], 'science-station':[900,290], 'culture-station':[1250,370] };
  for(const o of STAR_STATION.objects.filter(o=>Object.hasOwn(old,o.id))){
    assert(Math.hypot(o.x-900,o.y-530)>300,o.id+' 중앙에서 멀어짐');
  }
  const shop=STREET.objects.find(o=>o.kind==='shop'),craft=STREET.objects.find(o=>o.kind==='crafting'),energy=STREET.objects.find(o=>o.kind==='energy-shop');
  assert(shop.y<craft.y&&craft.y<energy.y);assert(craft.x>shop.x&&craft.x>energy.x);
  const walker={role:'student',avatar:{level:2,constellationId:'aries'}};
  for(let x=900;x<=1150;x+=10)assert(avatarPositionIsClear(STREET,x,1160,walker),`북쪽 접근 ${x}`);
  for(let y=1160;y<=1280;y+=10)assert(avatarPositionIsClear(STREET,1150,y,walker),`북쪽 접근 ${y}`);
  for(let x=1050;x<=1330;x+=10)assert(avatarPositionIsClear(STREET,x,1280,walker),`위 화단 우회 ${x}`);
  for(let y=1280;y<=1400;y+=10)assert(avatarPositionIsClear(STREET,1380,y,walker),`분수 오른쪽 열린 통로 ${y}`);
  for(let x=1380;x<=1550;x+=10)assert(avatarPositionIsClear(STREET,x,1470,walker),`상점 동쪽 우회 ${x}`);
  for(let y=1470;y<=1850;y+=10)assert(avatarPositionIsClear(STREET,1550,y,walker),`조합기 동쪽 우회 ${y}`);
  for(let x=1380;x<=1550;x+=10)assert(avatarPositionIsClear(STREET,x,1850,walker),`조합기 남쪽 우회 ${x}`);
  for(let y=1850;y<=2010;y+=10)assert(avatarPositionIsClear(STREET,1410,y,walker),`에너지 상점 동쪽 우회 ${y}`);
  for(let x=1390;x<=1410;x+=10)assert(avatarPositionIsClear(STREET,x,2010,walker),`에너지 상점 남쪽 통과 ${x}`);
  for(let y=2010;y<=2070;y+=10)assert(avatarPositionIsClear(STREET,1390,y,walker),`에너지 상점 남쪽 우회 ${y}`);
  for(let x=1150;x<=1390;x+=10)assert(avatarPositionIsClear(STREET,x,2070,walker),`아래쪽 분수 우회 ${x}`);
  for(let y=2200;y<=2250;y+=10)assert(avatarPositionIsClear(STREET,900,y,walker),`남쪽 출구 ${y}`);
  for(let y=1590;y<=1910;y+=10)assert(avatarPositionIsClear(STREET,440,y,walker),`왼쪽 화단과 분수 사이 통로 ${y}`);
  for(const o of [shop,craft,energy]){
    assert(onStreetFloor(STREET,o.x,o.y+o.radius+45,20),o.id+' 입구');
    assert(avatarPositionIsClear(STREET,o.x,o.y+o.radius+45,walker),o.id+' 진입로가 열려 있다');
  }
});

test('밤맵 입구는 과학·교양 사이 위쪽이며 모든 아바타의 왕복 통로가 열린다',()=>{
 const science=STAR_STATION.objects.find(o=>o.kind==='science-station'),culture=STAR_STATION.objects.find(o=>o.kind==='culture-station'),gate=STAR_STATION.objects.find(o=>o.id==='gate-sleeping-stars');
 assert(science.x<gate.x&&gate.x<culture.x);assert(gate.y<science.y&&gate.y<culture.y);
 assert.deepEqual([gate.x,gate.y],[STREET_LAYOUT.entrance.x,STREET_LAYOUT.entrance.y]);
 for(const p of [...Array.from({length:5},(_,i)=>({role:'student',avatar:{level:i+1}})),{role:'teacher',avatar:{}}]){
  for(let y=400;y>=gate.y;y-=5)assert(avatarPositionIsClear(STAR_STATION,gate.x,y,p),'입구 세로 통로 '+y);
  assert(avatarPositionIsClear(STAR_STATION,STREET_LAYOUT.northArrival.x,STREET_LAYOUT.northArrival.y,p));
 }
});
