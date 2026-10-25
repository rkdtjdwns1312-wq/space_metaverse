import test from 'node:test';
import assert from 'node:assert/strict';
import {MONSTER_TYPES} from '../shared/monsters.js';
import {ORIGIN_MAPS,STATIC_MAPS} from '../shared/config.js';
import {onOriginFloor} from '../shared/origin-floor.js';
import {monstersOf,monsterViews,moveMonsters,MONSTER_RULES} from '../server/monsters.js';

function assertNoOverlap(room, message) {
  const alive=monsterViews(room).filter(monster=>monster.alive&&monster.mapId==='star-origin-3');
  for(const monster of alive) for(const other of alive) {
    if(monster.id>=other.id || monster.mapId!==other.mapId) continue;
    const distance=Math.hypot(monster.x-other.x,monster.y-other.y);
    assert.ok(distance>=monster.radius+other.radius+10-1e-9,
      `${message}: ${monster.id}/${other.id} distance=${distance}`);
  }
}

test('별의 시작점 3 몬스터는 반경과 그림 크기가 기존의 정확히 절반이다',()=>{
  const room={};const list=monsterViews(room);
  const level3=list.filter(monster=>monster.mapId==='star-origin-3'&&MONSTER_TYPES.find(type=>type.id===monster.typeId)?.level===3);
  assert.equal(level3.length,5);
  assert.ok(level3.every(monster=>monster.radius===96));
  assert.ok(level3.every(monster=>monster.radius===MONSTER_RULES.radius*4));
});

test('별의 시작점 맵은 전체가 20% 커진 뒤 단계마다 1.2배씩 커지고 문과 귀환 좌표가 실제 크기를 따른다',()=>{
  for(const [index,map] of ORIGIN_MAPS.entries()){
    assert.ok(Math.abs(map.width-1440*1.2**index)<1e-9);
    assert.ok(Math.abs(map.height-1080*1.2**index)<1e-9);
  }
  for(const map of ORIGIN_MAPS){
    const back=map.objects.find(object=>object.id==='gate-back');
    assert.equal(back.x,map.width/2);assert.equal(back.y,map.height-80*(map.width/1200));
    for(const object of map.objects.filter(item=>item.kind==='gate')){
      assert.ok(object.x>=object.radius&&object.x<=map.width-object.radius);
      assert.ok(object.y>=object.radius&&object.y<=map.height-object.radius);
      const target=STATIC_MAPS[object.target];
      assert.ok(target,'문 목적지 맵이 존재해야 합니다.');
      assert.ok(object.arrival.x>=0&&object.arrival.x<=target.width);
      assert.ok(object.arrival.y>=0&&object.arrival.y<=target.height);
      if(object.id==='gate-next') {
        assert.equal(object.arrival.x,target.width/2);
        assert.equal(object.arrival.y,target.height-160*(target.width/1200));
      } else if(object.target.startsWith('star-origin-')) {
        assert.equal(object.arrival.x,target.width/2);
        assert.equal(object.arrival.y,175*(target.width/1200));
      }
    }
  }
});

test('3구역은 초기화와 장시간 이동 중 살아있는 몬스터가 겹치지 않는다',()=>{
  const room={};monstersOf(room,0);assertNoOverlap(room,'초기화');
  for(let now=0;now<=120000;now+=50) {
    moveMonsters(room,now,()=>0.125);
    assertNoOverlap(room,`이동 ${now}ms`);
  }
});

test('세 맵의 몬스터 배치가 실제 맵 경계 안이고 안전 간격을 지킨다',()=>{
  const room={};const list=monsterViews(room);
  for(const map of ORIGIN_MAPS){
    const monsters=list.filter(monster=>monster.mapId===map.id);
    assert.equal(monsters.length,map.id==='star-origin-4'?0:5);
    for(const monster of monsters){
      assert.ok(onOriginFloor(map,monster.x,monster.y,monster.radius),`${monster.id} must spawn on the round floor`);
      assert.ok(monster.x>=Math.max(120,monster.radius));
      assert.ok(monster.x<=map.width-Math.max(120,monster.radius));
      assert.ok(monster.y>=Math.max(190,monster.radius));
      assert.ok(monster.y<=map.height-Math.max(190,monster.radius));
    }
    for(const monster of monsters) for(const other of monsters)
      if(monster.id<other.id) assert.ok(Math.hypot(monster.x-other.x,monster.y-other.y)>=monster.radius+other.radius+10);
  }
});

test('별의 시작점 4는 왕복 문과 발밑 석상 충돌 지점만 두고 보스·자동 몬스터를 만들지 않는다',()=>{
  const map=ORIGIN_MAPS[3],back=map.objects.find(object=>object.id==='gate-back'),statue=map.objects.find(object=>object.kind==='goddess-statue');
  assert.equal(back.target,'star-origin-3');
  assert.deepEqual(map.objects.filter(object=>object.id==='gate-next'),[]);
  assert.deepEqual([statue.x,statue.y,statue.radius],[map.width/2,map.height/2,58]);
  const room={},spawns=monsterViews(room).filter(monster=>monster.mapId===map.id);
  assert.deepEqual(spawns,[]);
});

test('처치 몬스터가 다른 살아있는 몬스터와 겹치는 위치에서는 리스폰하지 않는다',()=>{
  const room={};const monsters=monstersOf(room,0);
  const defeated=monsters.get('star-dragon-1');
  const blocker=monsters.get('star-phoenix-1');
  defeated.hp=0;defeated.respawnAt=10000;
  blocker.x=defeated.spawnX;blocker.y=defeated.spawnY;
  moveMonsters(room,10000,()=>0);
  assert.equal(defeated.hp,0);
  assertNoOverlap(room,'겹치는 리스폰 보류');
  blocker.x=864;blocker.y=648;
  moveMonsters(room,10001,()=>0);
  assert.equal(defeated.hp,defeated.maxHp);
  assertNoOverlap(room,'리스폰 후');
});
