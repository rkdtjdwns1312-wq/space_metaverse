import test from 'node:test';
import assert from 'node:assert/strict';
import {advance} from '../server/world.js';
import {STATIC_MAPS,STREET_ID,RULES} from '../shared/config.js';
import {avatarFitsFloor,avatarRenderPoint} from '../shared/avatar-boundary.js';
import {createMotionTrack} from '../client/motion.js';
import {equipmentBonus} from '../shared/equipment.js';

// 실제 50ms 서버 이동 → 정확한 좌표의 100ms 위치 패킷 → 10ms 렌더.
// 최신 서버 좌표로 fallback하던 구현은 모서리에서 한 프레임에 70~80px 튄다.
for(const mapId of ['space-plaza',STREET_ID,'moon-garden','star-origin-1']){
  for(const level of [1,5])test(`${mapId} LV${level}: 외곽 24방향 이동은 보간 중 순간이동·바닥 이탈 없이 멈춘다`,()=>{
    const map=STATIC_MAPS[mapId];
    for(let direction=0;direction<24;direction++){
      const p={id:'p',role:'student',avatar:{level},mapId,...map.spawn,connected:true,
        equipmentSlots:level===5?['meteor-boots',null,null]:[],input:{x:0,y:0,at:0}};
      const room={players:new Map([['p',p]]),planets:new Map(),monsters:new Map(),unattended:true};
      const track=createMotionTrack(),speed=RULES.speed*(1+equipmentBonus(p).speed);
      let previous=null,latest={x:p.x,y:p.y};
      for(let t=0;t<6500;t+=50){
        p.input={x:t<6000?Math.cos(direction*Math.PI/12):0,y:t<6000?Math.sin(direction*Math.PI/12):0,at:t};
        const before={x:p.x,y:p.y};advance(room,t);
        assert.ok(Math.hypot(p.x-before.x,p.y-before.y)<=speed*.05+1e-7,'서버 위치 복구 점프 없음');
        if(t%100===0){
          latest={x:p.x,y:p.y};
          track.push(latest.x,latest.y,mapId,t);
        }
        for(let time=t;time<t+50;time+=10){
          const limit=speed*.01+.1;
          const point=avatarRenderPoint(map,track.at(time),latest,p,[],previous,limit);
          assert.ok(avatarFitsFloor(map,point.x,point.y,p),`바닥 이탈: 방향${direction}, 시간${time}`);
          if(previous)assert.ok(Math.hypot(point.x-previous.x,point.y-previous.y)<=limit+1e-7,
            `렌더 점프: 방향${direction}, 시간${time}`);
          previous=point;
        }
      }
      assert.ok(Math.hypot(previous.x-latest.x,previous.y-latest.y)<.2,'멈춘 서버 좌표까지 수렴');
    }
  });
}

test('물체 모서리의 보간은 최신 서버 위치로 건너뛰지 않고 프레임 이동량 안에서 미끄러진다',()=>{
  const map={id:'test',width:1000,height:1000,objects:[{x:500,y:500,radius:20}]};
  const p={role:'student',avatar:{level:1}},previous={x:470,y:492};
  const point=avatarRenderPoint(map,{x:500,y:492},{x:540,y:492},p,[],previous,6.3);
  assert.ok(Math.hypot(point.x-previous.x,point.y-previous.y)<=6.3);
  assert.ok(point.x<480,'반대편 최신 위치로 순간이동하지 않음');
});

test('맵 입장과 먼 서버 재배치는 이전 화면 위치를 계속 따라가지 않는다',()=>{
  const map={id:'test',width:1000,height:1000,objects:[]},p={role:'student',avatar:{level:1}};
  const target={x:800,y:800};
  assert.deepEqual(avatarRenderPoint(map,target,target,p,[],null,6.3),target);
  assert.deepEqual(avatarRenderPoint(map,target,target,p,[],{x:100,y:100},6.3),target);
});
