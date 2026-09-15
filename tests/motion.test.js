import test from 'node:test';
import assert from 'node:assert/strict';
import {createMotionTrack,MOTION} from '../client/motion.js';

test('100ms 위치 수신 사이를 일정한 속도로 표시하고 60/120Hz 결과가 같다',()=>{
  for(const frame of [1000/60,1000/120]){
    const track=createMotionTrack();track.push(0,0,'plaza',0);
    let next=100,previous=null;
    for(let time=frame;time<1600;time+=frame){
      while(next<=time){track.push(next*.62,0,'plaza',next);next+=100;}
      const point=track.at(time);
      if(time>300&&previous)assert.ok(Math.abs((point.x-previous.x)/frame-.62)<1e-8);
      previous=point;
    }
  }
});

test('수신 간격이 흔들려도 역행하거나 서버 최종 위치를 넘어가지 않는다',()=>{
  const track=createMotionTrack(),packets=[0,120,190,320,390,520,610,690,810];
  let cursor=0,old=0,max=0;
  for(let time=0;time<1200;time+=10){
    while(cursor<packets.length&&packets[cursor]<=time){max=cursor*62;track.push(max,0,'plaza',packets[cursor++]);}
    const p=track.at(time);assert.ok(p.x>=old);assert.ok(p.x<=max);old=p.x;
  }
  assert.equal(old,496);
});

test('위치 통신이 끊기거나 벽에서 멈추면 더 나가지 않고 마지막 확정 좌표에서 멈춘다',()=>{
  const track=createMotionTrack();track.push(0,0,'plaza',0);track.push(62,0,'plaza',100);
  assert.equal(track.at(200).x,31);
  assert.equal(track.at(1000).x,62);assert.equal(track.at(10000).x,62);
});

test('다른 맵 및 먼 위치 이동은 이전 공간을 가로질러 미끄러지지 않는다',()=>{
  const track=createMotionTrack();track.push(100,100,'one',0);track.push(110,110,'two',100);
  assert.deepEqual(track.at(100),{x:110,y:110});
  track.push(900,700,'two',200);assert.deepEqual(track.at(200),{x:900,y:700});
});

test('긴 정지 뒤 출발은 정지 시간에 걸쳐 서서히 움직이지 않는다',()=>{
  const track=createMotionTrack();track.push(0,0,'plaza',0);track.push(0,0,'plaza',3000);
  track.push(62,0,'plaza',10000);
  assert.equal(track.at(10000).x,0);assert.equal(track.at(10100).x,31);
  assert.equal(track.at(10000+MOTION.delayMs).x,62);
});

test('잘못된 좌표와 순서가 뒤집힌 패킷은 현재 이동을 오염시키지 않는다',()=>{
  const track=createMotionTrack();track.push(0,0,'plaza',0);track.push(62,0,'plaza',100);
  track.push(NaN,0,'plaza',200);track.push(10,0,'plaza',50);
  assert.deepEqual(track.at(400),{x:62,y:0});
});
