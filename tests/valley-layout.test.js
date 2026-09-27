import test from 'node:test';
import assert from 'node:assert/strict';
import {MAP,PLAZA_ID,RULES,VALLEY,VALLEY_ID,STATIC_MAPS,createAvatar} from '../shared/config.js';
import {VALLEY_LAYOUT as L,onValleyFloor,traceValleyFloor,VALLEY_EDGES} from '../shared/valley-layout.js';
import {floorRenderPoint} from '../shared/paradise-floor.js';
import {arrivePosition,isFree} from '../server/world.js';
import {evolutionInfo,growthInfo} from '../server/evolution.js';

const room=()=>({players:new Map(),planets:new Map(),proposals:new Map(),unattended:true});
const map={id:VALLEY_ID,width:VALLEY.width,height:VALLEY.height};
test('은하수계곡 공유 규격과 중앙·신전·문을 잇는 모든 바닥 구간',()=>{
  assert.deepEqual([VALLEY.width,VALLEY.height],[2400,1400]);
  assert.deepEqual(L.center,{x:1200,y:420,rx:200,ry:145});
  assert.deepEqual(L.gate,{x:1200,y:90});assert.deepEqual(L.spawn,{x:1200,y:240});
  assert.deepEqual(L.temples.map(({x,y,rx,ry})=>({x,y,rx,ry})),[
    {x:480,y:820,rx:350,ry:235},{x:1920,y:820,rx:350,ry:235}
  ]);
  for(const to of [L.gate,...L.temples])for(let t=0;t<=1;t+=.005){
    const x=L.center.x+(to.x-L.center.x)*t,y=L.center.y+(to.y-L.center.y)*t;
    assert.ok(onValleyFloor(map,x,y,RULES.radius),JSON.stringify({to,t,x,y}));
  }
  assert.ok(onValleyFloor(map,L.spawn.x,L.spawn.y,RULES.radius));
  assert.ok(VALLEY_EDGES.length>200);
  assert.equal(onValleyFloor(map,1200+L.bridgeWidth/2+RULES.radius+4,150,RULES.radius),false,'수직다리 옆');
  assert.equal(onValleyFloor(map,1200+L.bridgeWidth/2+RULES.radius+4,240,RULES.radius),false,'다리 옆');
  assert.equal(onValleyFloor(map,0,0,RULES.radius),false,'계곡 외부');
  assert.equal(onValleyFloor(map,NaN,0),false);
  assert.equal(isFree(room(),L.center.x,L.center.y,null,VALLEY_ID,false),true);
  assert.equal(isFree(room(),1200+L.bridgeWidth/2+RULES.radius+4,150,null,VALLEY_ID,false),false,'서버 이동도 다리 바깥을 거부');
});

test('Canvas 공유 외곽 경로는 내부 접합선을 제외한 폐곡선으로 그려진다',()=>{
  const commands=[];const ctx={beginPath(){commands.push(['begin']);},moveTo(x,y){commands.push(['move',x,y]);},lineTo(x,y){commands.push(['line',x,y]);},closePath(){commands.push(['close']);}};
  assert.equal(traceValleyFloor(ctx),ctx);
  assert.equal(commands[0][0],'begin');assert.ok(commands.some(c=>c[0]==='move'));assert.ok(commands.some(c=>c[0]==='line'));
  assert.ok(commands.some(c=>c[0]==='close'),'경계 선분을 폐곡선으로 연결');
  assert.equal(commands.filter(c=>c[0]==='move').length,commands.filter(c=>c[0]==='close').length,'모든 외곽 루프 폐쇄');
  assert.equal(floorRenderPoint(map,{x:1200,y:240},'fallback',RULES.radius).x,1200);
  assert.equal(floorRenderPoint(map,{x:0,y:0},'fallback',RULES.radius),'fallback');
});

test('광장↔은하수계곡 문 도착은 양방향으로 각 공유 바닥 안에 놓인다',()=>{
  const fromPlaza=MAP.objects.find(o=>o.id==='gate-valley'),toPlaza=VALLEY.objects.find(o=>o.id==='gate-plaza');
  assert.equal(fromPlaza.target,VALLEY_ID);assert.equal(toPlaza.target,PLAZA_ID);
  assert.deepEqual(fromPlaza.arrival,L.spawn);
  const valleyArrival=arrivePosition(room(),VALLEY_ID,fromPlaza.arrival);
  assert.ok(onValleyFloor(map,valleyArrival.x,valleyArrival.y,RULES.radius));
  const plazaArrival=arrivePosition(room(),PLAZA_ID,toPlaza.arrival);
  assert.ok(isFree(room(),plazaArrival.x,plazaArrival.y,null,PLAZA_ID,false));
  for(const [source,target] of [[MAP,VALLEY],[VALLEY,MAP]]){
    const gate=source.objects.find(o=>o.target===target.id);
    assert.ok(gate&&gate.arrival);assert.ok(STATIC_MAPS[target.id]);
  }
});

test('진화·성장 제단 배치와 서버 상호작용 권한/거리 검증을 유지한다',()=>{
  const evolution=VALLEY.objects.find(o=>o.id==='evolution-star'),growth=VALLEY.objects.find(o=>o.id==='growth-star');
  assert.deepEqual([evolution.x,evolution.y,evolution.radius,evolution.kind],[480,780,65,'evolution']);
  assert.deepEqual([growth.x,growth.y,growth.radius,growth.kind],[1920,780,65,'growth']);
  const student={id:'student',role:'student',mapId:VALLEY_ID,x:evolution.x,y:evolution.y,avatar:createAvatar(),starShards:5};
  const r=room();r.players.set(student.id,student);
  assert.ok(evolutionInfo(r,student).options.length>0);
  student.x=growth.x;student.y=growth.y;assert.equal(growthInfo(r,student).maxBuy,5);
  student.mapId=PLAZA_ID;
  assert.throws(()=>growthInfo(r,student),/은하수계곡/);
  student.mapId=VALLEY_ID;student.x=1200;student.y=420;
  assert.throws(()=>evolutionInfo(r,student),/진화의 별 가까이/);
});
