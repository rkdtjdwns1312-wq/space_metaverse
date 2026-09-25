import test from 'node:test';
import assert from 'node:assert/strict';
import { RULES, PLAZA_ID, createAvatar } from '../shared/config.js';
import { advance } from '../server/world.js';

function fixture({x=300,y=300,facingX=1,facing={x:1,y:0}}={}) {
  const player={id:'p',role:'teacher',connected:true,away:false,mapId:PLAZA_ID,x,y,
    facingX,facing:{...facing},input:{x:0,y:0,at:0},avatar:createAvatar()};
  const room={unattended:false,players:new Map([[player.id,player]]),planets:new Map()};
  return {room,player};
}

function move(room,player,x,y,now=1000) {
  player.input={x,y,at:now};
  advance(room,now);
}

test('수평 facingX는 좌우 실제 이동에서만 바뀌고 수직·정지·벽 막힘에서는 유지된다',()=>{
  const {room,player}=fixture();
  move(room,player,-1,0);assert.equal(player.facingX,-1);
  move(room,player,0,-1,1010);assert.equal(player.facingX,-1);
  move(room,player,0,0,1020);assert.equal(player.facingX,-1);

  player.x=RULES.radius;
  move(room,player,-1,0,1030);assert.equal(player.facingX,-1,'벽에 막힌 좌 입력은 방향을 바꾸지 않는다');
  player.x=300;
  move(room,player,1,0,1040);assert.equal(player.facingX,1);
});

test('대각 이동은 실제 수평 변위의 부호를 저장하고 공격 방향 벡터는 정규화된 채 유지한다',()=>{
  const {room,player}=fixture({facingX:-1});
  move(room,player,-1,1);
  assert.equal(player.facingX,-1);
  assert.ok(player.facing.x<0);
  assert.ok(player.facing.y>0);
  assert.ok(Math.abs(Math.hypot(player.facing.x,player.facing.y)-1)<1e-12);

  move(room,player,0,1,1010);
  assert.equal(player.facingX,-1,'수직 이동은 마지막 좌우 방향을 보존한다');
  assert.ok(Math.abs(Math.hypot(player.facing.x,player.facing.y)-1)<1e-12);
});

test('facingX는 이동 엔진만 갱신하며 좌표 순간이동은 값을 바꾸지 않는다',()=>{
  const {room,player}=fixture({facingX:-1});
  player.x=500;player.y=400;
  assert.equal(player.facingX,-1);
  assert.deepEqual(player.facing,{x:1,y:0});
});
