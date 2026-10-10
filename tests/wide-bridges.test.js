import test from 'node:test';
import assert from 'node:assert/strict';
import {STATIC_MAPS,MAP,STREET,RULES} from '../shared/config.js';
import {PLAZA_LAYOUT as P} from '../shared/plaza-layout.js';
import {VALLEY_LAYOUT as V} from '../shared/valley-layout.js';
import {STREET_LAYOUT as S} from '../shared/street-layout.js';
import {PARADISE_FLOOR,paradiseFloor} from '../shared/paradise-floor.js';
import {originFloor,ORIGIN_FLOOR_RULES} from '../shared/origin-floor.js';
import {avatarFitsFloor} from '../shared/avatar-boundary.js';
import {advance,isFree} from '../server/world.js';

const avatar={id:'walker',role:'student',avatar:{level:5,constellationId:'sagittarius'},connected:true};
const point=(a,b,t)=>({x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t});
export const bridgeRoutes=[
  ...P.islands.map(z=>({map:MAP,a:P.center,b:z,end:.83})),
  ...Object.values(P.gates).map(g=>({map:MAP,a:P.center,b:g,end:1-80/Math.hypot(g.x-P.center.x,g.y-P.center.y)})),
  ...V.temples.map(z=>({map:STATIC_MAPS['milky-valley'],a:V.center,b:z,end:.78})),
  {map:STATIC_MAPS['milky-valley'],a:V.center,b:V.gate,end:.76},
  {map:STREET,a:S.upper,b:S.lower,end:.78},
  {map:STREET,a:S.upper,b:S.north,end:.78},
  {map:STREET,a:S.upper,b:S.westGate,end:.91},
];
for(const map of Object.values(STATIC_MAPS)){
  const f=paradiseFloor(map)||originFloor(map);if(!f)continue;
  for(const gate of map.objects.filter(o=>o.kind==='gate'))bridgeRoutes.push({map,a:{x:f.cx,y:f.cy},b:gate,end:1-70/Math.hypot(gate.x-f.cx,gate.y-f.cy)});
}

test('5개 맵 계열의 다리 폭은 이전보다 정확히40% 넓다',()=>{
  assert.equal(P.bridgeWidth,156*1.4);assert.equal(V.bridgeWidth,160*1.4);
  assert.equal(S.bridgeWidth,180*1.4);assert.equal(PARADISE_FLOOR.bridgeWidth,180*1.4);assert.equal(ORIGIN_FLOOR_RULES.bridgeWidth,.14*1.4);
});
test('LV5 몸 전체가 모든 직선·대각선 다리 및 원형 바닥 접합부에서 이어진다',()=>{
  for(const {map,a,b,end} of bridgeRoutes)for(let i=0;i<=100;i++){
    const p=point(a,b,end*i/100);assert.ok(avatarFitsFloor(map,p.x,p.y,avatar),`${map.id} ${JSON.stringify(b)} ${i}%`);
  }
});
test('실제 서버 이동으로 LV5가 양방향 연결부를 통과하며 옆 벽은 유지된다',()=>{
  for(const route of bridgeRoutes){
    const {map,a,b,end}=route,start=point(a,b,.30),finish=point(a,b,end);
    const p={...avatar,avatar:{...avatar.avatar},mapId:map.id,input:{x:0,y:0,at:0}};
    const room={players:new Map([[p.id,p]]),planets:new Map(),unattended:true};
    // 객체가 있는 섬의 한복판까지 가는 검사가 아니라 다리 양끝의 연결부 통행 검사입니다.
    for(const [from,to] of [[start,finish],[finish,start]]){
      Object.assign(p,from);let tick=0;
      for(;tick<350&&Math.hypot(p.x-to.x,p.y-to.y)>RULES.speed*RULES.tickMs/1000;tick++){
        const before={x:p.x,y:p.y};p.input={x:to.x-p.x,y:to.y-p.y,at:tick*RULES.tickMs};advance(room,tick*RULES.tickMs);
        assert.ok(avatarFitsFloor(map,p.x,p.y,p),`${map.id} 이동 중 바닥`);
        assert.ok(Math.hypot(p.x-before.x,p.y-before.y)<RULES.speed*RULES.tickMs/1000+1,'잘못된 위치 복구로 순간이동하지 않음');
      }
      assert.ok(tick<350,`${map.id} 다리 통행 실패 ${JSON.stringify({from,to,at:{x:p.x,y:p.y}})}`);
    }
  }
  const p={...avatar,mapId:MAP.id},room={players:new Map([[p.id,p]]),planets:new Map()};
  assert.equal(isFree(room,3100,P.center.y+P.bridgeWidth/2+10,p.id,MAP.id,false),false,'광장 동쪽 다리 바깥');
  assert.equal(avatarFitsFloor(STREET,S.upper.x+S.bridgeWidth/2+10,1695,p),false,'놀이터 다리 바깥');
  assert.equal(avatarFitsFloor(STREET,S.upper.x+S.bridgeWidth/2+10,710,p),false,'발전소 다리 바깥');
});
