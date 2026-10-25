import test from 'node:test';
import assert from 'node:assert/strict';
import {createLocomotionClock} from '../client/constellation-locomotion.js';
import {walkPoseRegistration} from '../client/walk-pose-sheet.js';

test('뱀주인자리 Lv4는 왼쪽 진행 방향에 맞춘 8포즈 시트를 사용한다',()=>{
  const pose=walkPoseRegistration('ophiuchus',4);
  assert.equal(pose.source,'/assets/avatars/walk-poses/ophiuchus-lv4-v2.png');
  assert.equal(pose.columns,4);
  assert.equal(pose.rows,2);
  assert.deepEqual(pose.sourceHip,[.5,.69]);
  assert.deepEqual(pose.targetHip,[.5,.77]);
});

test('헤라클레스 Lv4는 새 방향 정렬 보행 시트를 사용한다',()=>{
  const pose=walkPoseRegistration('hercules',4);
  assert.equal(pose.source,'/assets/avatars/walk-poses/hercules-lv4-v2.png');
  assert.equal(pose.columns,4);
  assert.equal(pose.rows,2);
});

test('이동 좌표가 바뀌면 걷기 프레임이 진행한다',()=>{
  const clock=createLocomotionClock();
  assert.deepEqual(clock.sample('p','aries:2',0,0,0),{index:0,moving:false});
  assert.deepEqual(clock.sample('p','aries:2',1,0,20),{index:0,moving:true});
  assert.deepEqual(clock.sample('p','aries:2',2,0,130),{index:1,moving:true});
  assert.deepEqual(clock.sample('p','aries:2',3,0,240),{index:2,moving:true});
});

test('같은 시각의 이동 경로라면 이동 속도와 무관하게 같은 주기 위상이다',()=>{
  const at=(speed,time)=>{
    const clock=createLocomotionClock();clock.sample('p','leo:3',0,0,0);
    let result;
    for(let t=100;t<=time;t+=100)result=clock.sample('p','leo:3',speed*t/100,0,t,100);
    return result;
  };
  assert.deepEqual(at(.2,350),at(3,350));
  assert.deepEqual(at(.2,350),{index:2,moving:true});
});

test('이동을 멈춘 뒤 160ms가 지나면 idle 프레임으로 복귀한다',()=>{
  const clock=createLocomotionClock();
  clock.sample('p','cancer:2',0,0,0);
  assert.equal(clock.sample('p','cancer:2',1,0,0).moving,true);
  assert.deepEqual(clock.sample('p','cancer:2',1,0,159),{index:1,moving:true});
  assert.deepEqual(clock.sample('p','cancer:2',1,0,160),{index:0,moving:false});
});

test('reduced motion은 이동 상태에서도 모션 프레임을 억제한다',()=>{
  const clock=createLocomotionClock();
  clock.sample('p','pisces:4',0,0,0);
  assert.deepEqual(clock.sample('p','pisces:4',1,0,20,100,true),{index:0,moving:false});
  assert.deepEqual(clock.sample('p','pisces:4',2,0,120,100,false),{index:1,moving:true});
});

test('240px 초과 순간이동은 새 idle 기준점으로 초기화한다',()=>{
  const clock=createLocomotionClock();
  clock.sample('p','ophiuchus:3',0,0,0);
  clock.sample('p','ophiuchus:3',1,0,20);
  assert.deepEqual(clock.sample('p','ophiuchus:3',242,0,40),{index:0,moving:false});
  assert.deepEqual(clock.sample('p','ophiuchus:3',243,0,60),{index:0,moving:true});
});

test('별자리/레벨 key 변경은 이전 위상을 이어받지 않는다',()=>{
  const clock=createLocomotionClock();
  clock.sample('p','aries:2',0,0,0);
  clock.sample('p','aries:2',1,0,20);
  assert.deepEqual(clock.sample('p','aries:3',2,0,200),{index:0,moving:false});
  assert.deepEqual(clock.sample('p','aries:3',3,0,220),{index:0,moving:true});
});

test('clear와 retain으로 제거된 플레이어는 다시 나타나도 이전 걷기 잔상이 없다',()=>{
  const clock=createLocomotionClock();
  clock.sample('keep','taurus:4',0,0,0);clock.sample('keep','taurus:4',1,0,20);
  clock.sample('drop','leo:2',0,0,0);clock.sample('drop','leo:2',1,0,20);
  clock.retain(['keep']);
  assert.deepEqual(clock.sample('drop','leo:2',2,0,220),{index:0,moving:false});
  assert.deepEqual(clock.sample('keep','taurus:4',2,0,40),{index:0,moving:true});
  assert.deepEqual(clock.sample('keep','taurus:4',3,0,150),{index:1,moving:true});
  clock.clear();
  assert.deepEqual(clock.sample('keep','taurus:4',4,0,170),{index:0,moving:false});
});
