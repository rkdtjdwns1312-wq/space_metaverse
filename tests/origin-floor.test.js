import test from 'node:test';
import assert from 'node:assert/strict';
import {ORIGIN_MAPS} from '../shared/config.js';
import {isParadise,onParadiseFloor} from '../shared/paradise-floor.js';
import {originFloor,onOriginFloor} from '../shared/origin-floor.js';

test('별의 시작점 세 맵은 20%씩 커지는 중앙 원형 마당과 문 연결 다리를 가진다',()=>{
  for(const [i,map] of ORIGIN_MAPS.entries()){
    assert.equal(isParadise(map.id),false,'낙원 판별에는 시작점이 섞이지 않음');
    const floor=originFloor(map);assert.ok(floor);
    assert.equal(floor.rx/map.width,.4);assert.equal(floor.ry/map.height,.32);
    assert.equal(onOriginFloor(map,map.spawn.x,map.spawn.y,24),true,`${map.id} 출현 위치`);
    assert.equal(onParadiseFloor(map,map.spawn.x,map.spawn.y,24),true,`${map.id} 공통 플레이어/몬스터 바닥 판정`);
    for(const gate of map.objects.filter(o=>o.kind==='gate')){
      for(let n=0;n<=100;n++){
        const t=n/100,x=floor.cx+(gate.x-floor.cx)*t,y=floor.cy+(gate.y-floor.cy)*t;
        assert.equal(onOriginFloor(map,x,y,24),true,`${map.id} ${gate.id} 다리 ${n}%`);
      }
      assert.equal(onOriginFloor(map,gate.x,gate.y,24),true,`${map.id} ${gate.id} 통과 위치`);
    }
    assert.equal(floor.rx/map.width,.4);
    if(i){
      assert.equal(map.width/ORIGIN_MAPS[i-1].width,1.2);
      assert.equal(map.height/ORIGIN_MAPS[i-1].height,1.2);
      assert.ok(Math.abs(floor.rx/originFloor(ORIGIN_MAPS[i-1]).rx-1.2)<1e-12);
      assert.ok(Math.abs(floor.ry/originFloor(ORIGIN_MAPS[i-1]).ry-1.2)<1e-12);
    }
  }
  assert.equal(onOriginFloor(ORIGIN_MAPS[0],0,0),false);
  assert.equal(onOriginFloor(ORIGIN_MAPS[0],NaN,100),false);
});
