import test from 'node:test';
import assert from 'node:assert/strict';
import {avatarFitsFloor,avatarFloorRadius,avatarCollisionShape,avatarPositionIsClear} from '../shared/avatar-boundary.js';
import {avatarSizeOf} from '../shared/avatar-size.js';
import {advance,arrivePosition,isFree} from '../server/world.js';
import {RULES,STATIC_MAPS,STREET,STREET_ID,ORIGIN_MAPS} from '../shared/config.js';
import {STREET_LAYOUT} from '../shared/street-layout.js';

const student=level=>({id:'student',role:'student',avatar:{level},connected:true,away:false,mapId:STREET_ID,
  x:STREET.spawn.x,y:STREET.spawn.y,input:{x:0,y:0,at:0},facing:{x:1,y:0},facingX:1});
const roomWith=player=>({players:new Map([[player.id,player]]),planets:new Map(),proposals:new Map(),unattended:true});

test('하반신 반경과 아래쪽 offset은 키의 1/4이고 전투 상호작용 수치는 유지된다',()=>{
  for(let level=1;level<=5;level++){
    const p={role:'student',avatar:{level}},r=avatarSizeOf(p)/4;
    assert.equal(avatarFloorRadius(p),r);assert.deepEqual(avatarCollisionShape(p),{halfWidth:r,offsetY:r,radius:r});
  }
  assert.equal(avatarFloorRadius({role:'teacher',avatar:{level:6}}),24);
  assert.equal(avatarFloorRadius({role:'student',avatar:{blackStar:true}}),13);
  assert.equal(RULES.radius,16,'전투·상호작용 기본 상수는 유지');
});

test('config에 등록된 모든 맵에서 큰 아바타 스폰은 안전하고 네 바깥 경계는 거부된다',()=>{
  const players=[1,2,3,4,5].map(level=>({role:'student',avatar:{level}}));
  players.push({role:'teacher',avatar:{level:6}});
  for(const map of Object.values(STATIC_MAPS))for(const player of players){
    const r=avatarFloorRadius(player),{x,y}=map.spawn;
    assert.ok(avatarFitsFloor(map,x,y,player),`${map.id} 스폰·r=${r}`);
    assert.equal(avatarFitsFloor(map,r-1,y,player),false,`${map.id} 왼쪽 경계·r=${r}`);
    assert.equal(avatarFitsFloor(map,map.width-r+1,y,player),false,`${map.id} 오른쪽 경계·r=${r}`);
    assert.equal(avatarFitsFloor(map,x,-1,player),false,`${map.id} 허리가 위쪽 경계를 넘음·r=${r}`);
    assert.equal(avatarFitsFloor(map,x,map.height-r*2+1,player),false,`${map.id} 발이 아래쪽 경계를 넘음·r=${r}`);
  }
});

test('오색별빛 쉼터의 출입 다리와 중앙 놀이터 다리에는 큰 아바타가 통과한다',()=>{
  const player={role:'student',avatar:{level:5}};
  const entrance={x:(STREET_LAYOUT.westGate.x+STREET.spawn.x)/2,y:STREET_LAYOUT.westGate.y};
  assert.ok(avatarFitsFloor(STREET,entrance.x,entrance.y,player),'서쪽 출입 다리 중앙');
  assert.ok(avatarFitsFloor(STREET,STREET_LAYOUT.upper.x,STREET_LAYOUT.upper.y+5,player),'중앙 놀이터 다리');
  assert.ok(avatarFitsFloor(STREET,STREET_LAYOUT.upper.x,710,player),'북쪽 발전소 다리');
});

test('반지름 16으로는 안전한 원형 바닥 가장자리라도 LV5 몸이 나가면 거부한다',()=>{
  const x=STREET_LAYOUT.lower.x,y=STREET_LAYOUT.lower.y+305;
  assert.equal(isFree(roomWith(student(1)),x,y,null,STREET_ID,false),true,'기존 충돌 반경 기준으로는 안전');
  assert.equal(avatarFitsFloor(STREET,x,y,student(1)),true,'LV1 몸은 바닥 안');
  assert.equal(avatarFitsFloor(STREET,x,y,student(5)),false,'LV5 몸은 하단 바닥 밖');
  assert.equal(isFree(roomWith(student(5)),x,y,'student',STREET_ID,false),false,'서버 바닥 판정은 LV5 크기를 사용');
});

test('경계 입력은 멈추고 진화 직후 커진 몸과 잘못된 현재 위치는 서버 틱에서 복구한다',()=>{
  const p=student(1),room=roomWith(p),x=STREET_LAYOUT.lower.x,y=STREET_LAYOUT.lower.y+305;
  Object.assign(p,{x,y,input:{x:0,y:1,at:100}});
  for(const now of [100,150,200]){
    p.input={x:0,y:1,at:now};advance(room,now);
    assert.equal(p.x,x);assert.ok(avatarFitsFloor(STREET,p.x,p.y,p),'하반신이 바닥 안에 남는다');
    assert.equal(avatarFitsFloor(STREET,p.x,p.y+8,p),false,'벽 직전까지 이동하고 멈춘다');
  }

  p.avatar.level=5;p.input={x:0,y:0,at:250};
  advance(room,250);
  assert.ok(isFree(room,p.x,p.y,p.id,STREET_ID,false),`진화 뒤 복구 좌표 ${p.x},${p.y}는 몸 전체가 바닥 안`);

  Object.assign(p,{x,y:2410,input:{x:0,y:0,at:300}});
  advance(room,300);
  assert.ok(isFree(room,p.x,p.y,p.id,STREET_ID,false),'입력이 없어도 다음 서버 틱에 잘못된 좌표를 복구');
});

test('안전하지 않은 출입 도착점은 플레이어 크기에 맞는 가까운 자리로 보정한다',()=>{
  const p=student(5),room=roomWith(p),point={x:STREET_LAYOUT.lower.x,y:STREET_LAYOUT.lower.y+340};
  assert.equal(avatarFitsFloor(STREET,point.x,point.y,p),false);
  const arrival=arrivePosition(room,STREET_ID,point,p);
  assert.notDeepEqual(arrival,point);
  assert.ok(isFree(room,arrival.x,arrival.y,p.id,STREET_ID,false));
});

test('별의 시작점 4 석상 충돌은 원화 플린스 발 위치에만 놓인다',()=>{
  const map=ORIGIN_MAPS[3],statue=map.objects.find(object=>object.kind==='goddess-statue'),p=student(1);
  assert.equal(statue.y,map.height/2,'요청574: 받침대가 신전 정중앙에 놓임');
  assert.ok(avatarPositionIsClear(map,statue.x,statue.y-80,p),'발밑 충돌점 바깥은 지나갈 수 있다');
  assert.equal(avatarPositionIsClear(map,statue.x,statue.y-24,p),false,'플린스 발 위치의 충돌 원은 막는다');
});
