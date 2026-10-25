import test from 'node:test';
import assert from 'node:assert/strict';
import {MAP,ORIGIN_MAPS,STAR_ORIGIN,UNIVERSE_MAP_LAYOUT,STATIC_MAPS} from '../shared/config.js';
import {isParadise,onParadiseFloor} from '../shared/paradise-floor.js';
import {originFloor,onOriginFloor} from '../shared/origin-floor.js';

test('별의 시작점 네 맵은 20%씩 커지는 중앙 원형 마당과 문 연결 다리를 가진다',()=>{
  assert.deepEqual([STAR_ORIGIN.baseWidth,STAR_ORIGIN.baseHeight],[1440,1080]);
  assert.deepEqual(MAP.objects.find(o=>o.id==='gate-origin').arrival,ORIGIN_MAPS[0].spawn);
  for(const [i,map] of ORIGIN_MAPS.entries()){
    assert.equal(isParadise(map.id),false,'낙원 판별에는 시작점이 섞이지 않음');
    const floor=originFloor(map);assert.ok(floor);
    const originalFactor=1.2**i;
    assert.ok(Math.abs(map.width-1200*originalFactor*1.2)<1e-9);
    assert.ok(Math.abs(map.height-900*originalFactor*1.2)<1e-9);
    assert.ok(Math.abs(floor.rx-480*originalFactor*1.2)<1e-9);
    assert.ok(Math.abs(floor.ry-288*originalFactor*1.2)<1e-9);
    assert.equal(floor.rx/map.width,.4);assert.equal(floor.ry/map.height,.32);
    assert.equal(onOriginFloor(map,map.spawn.x,map.spawn.y,24),true,`${map.id} 출현 위치`);
    assert.equal(onParadiseFloor(map,map.spawn.x,map.spawn.y,24),true,`${map.id} 공통 플레이어/몬스터 바닥 판정`);
    for(const gate of map.objects.filter(o=>o.kind==='gate')){
      const oldGateY=gate.id==='gate-next'?80*originalFactor:900*originalFactor-80*originalFactor;
      assert.ok(Math.abs(gate.y-oldGateY*1.2)<1e-9,`${map.id} ${gate.id} 문 좌표`);
      for(let n=0;n<=100;n++){
        const t=n/100,x=floor.cx+(gate.x-floor.cx)*t,y=floor.cy+(gate.y-floor.cy)*t;
        assert.equal(onOriginFloor(map,x,y,24),true,`${map.id} ${gate.id} 다리 ${n}%`);
      }
      assert.equal(onOriginFloor(map,gate.x,gate.y,24),true,`${map.id} ${gate.id} 통과 위치`);
    }
    assert.equal(floor.rx/map.width,.4);
    if(i){
      assert.ok(Math.abs(map.width/ORIGIN_MAPS[i-1].width-1.2)<1e-12);
      assert.ok(Math.abs(map.height/ORIGIN_MAPS[i-1].height-1.2)<1e-12);
      assert.ok(Math.abs(floor.rx/originFloor(ORIGIN_MAPS[i-1]).rx-1.2)<1e-12);
      assert.ok(Math.abs(floor.ry/originFloor(ORIGIN_MAPS[i-1]).ry-1.2)<1e-12);
    }
  }
  assert.equal(onOriginFloor(ORIGIN_MAPS[0],0,0),false);
  assert.equal(onOriginFloor(ORIGIN_MAPS[0],NaN,100),false);
});

test('전체 지도 선택 칸은 6행 안에서 중복되지 않고 모두 등록 맵을 가리킨다',()=>{
  const occupied=new Set();
  for(const {id,row,column} of UNIVERSE_MAP_LAYOUT){
    const slot=`${row}:${column}`;
    assert.ok(!occupied.has(slot),`지도 칸 중복 ${slot} (${id})`);occupied.add(slot);
    assert.ok(row>=1&&row<=6&&column>=1&&column<=5,`${id}의 그리드 위치`);
    assert.ok(STATIC_MAPS[id],`${id}가 선택 가능한 맵으로 등록됨`);
  }
  assert.equal(UNIVERSE_MAP_LAYOUT.find(item=>item.id==='space-plaza').row,5);
  assert.deepEqual(UNIVERSE_MAP_LAYOUT.filter(item=>item.id.startsWith('star-origin-')).map(item=>[item.id,item.row]),[
    ['star-origin-4',1],['star-origin-3',2],['star-origin-2',3],['star-origin-1',4]
  ]);
});
