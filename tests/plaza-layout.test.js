import test from 'node:test';
import assert from 'node:assert/strict';
import {PLAZA_LAYOUT as L,departmentSlots,departmentSite,onPlazaFloor,PLAZA_EDGES} from '../shared/plaza-layout.js';
import {MAP,PLAZA_ID,STATIC_MAPS,PLANET,RULES} from '../shared/config.js';
import {placementFree,isFree,advance} from '../server/world.js';
import {relocateDepartments} from '../server/plaza-migration.js';
const room=()=>({players:new Map(),planets:new Map(),proposals:new Map(),unattended:true});
test('광장 중앙과 대각선 네 원형 구역·네 방향 출입구가 끊김 없이 연결된다',()=>{
  assert.equal(MAP.width,6200);assert.equal(MAP.height,4400);
  for(const to of [...L.islands,...Object.values(L.gates)])for(let t=0;t<=1;t+=.01)
    assert.ok(onPlazaFloor(MAP,L.center.x+(to.x-L.center.x)*t,L.center.y+(to.y-L.center.y)*t,RULES.radius),JSON.stringify({to,t}));
  assert.ok(L.islands.find(i=>i.id==='assignment').x<L.center.x);
  for(const source of Object.values(STATIC_MAPS))for(const g of source.objects||[])if(g.target===PLAZA_ID)assert.ok(isFree(room(),g.arrival.x,g.arrival.y,null,PLAZA_ID,false),source.id);
});
test('본광장·다리 테두리 밖을 서버가 차단하고 매 틱 이동에도 반영한다',()=>{
  assert.equal(onPlazaFloor(MAP,30,30,16),false);assert.equal(onPlazaFloor(MAP,3000+150,400,16),false);
  const r=room(),p={id:'s',role:'student',mapId:PLAZA_ID,x:3110,y:400,connected:true,input:{x:1,y:0,at:100},avatar:{level:2},facing:{x:0,y:1}};r.players.set(p.id,p);
  assert.equal(isFree(r,p.x,p.y,null,PLAZA_ID,false),false);p.x=3090;
  for(let i=0;i<20;i++){p.input.at=100+i;advance(r,100+i);assert.ok(onPlazaFloor(MAP,p.x,p.y,16));}
  assert.ok(PLAZA_EDGES.length>500);
});
test('48개 부서행성을 전용 공간에 간격 보장하여 배치하며 다른 구역은 금지한다',()=>{
  const r=room(),slots=departmentSlots();assert.ok(slots.length>=48);
  for(const [i,pt] of slots.slice(0,48).entries()){assert.equal(placementFree(r,pt.x,pt.y),true);r.planets.set(String(i),{...pt,radius:PLANET.radius});}
  for(const z of [L.center,...L.islands.filter(i=>i.id!=='department')])assert.equal(placementFree(r,z.x,z.y),false);
  assert.equal(departmentSite(6120,3450),false);
});
test('기존 행성/신청 좌표만 이전하고 id·규칙·실적·투표·재실행 결과를 보존한다',()=>{
  const r=room();for(let i=0;i<48;i++)r.planets.set(String(i),{id:String(i),x:100+i*20,y:100,radius:60,name:'별'+i,rules:['약속'],work:{text:'실적',balance:5},rename:{votes:new Map([['학생',true]])}});
  const before=[...r.planets.values()].map(({x,y,...rest})=>structuredClone(rest));assert.equal(relocateDepartments(r),true);
  for(const p of r.planets.values())assert.equal(departmentSite(p.x,p.y),true);
  assert.deepEqual([...r.planets.values()].map(({x,y,...rest})=>rest),before);
  assert.equal(relocateDepartments(r),false);
});
test('유효한 새 행성 자리는 유지하며 대기 신청도 중복 없이 이전한다',()=>{
  const r=room(),keep={id:'keep',...departmentSlots()[0],radius:60,rules:['유지']};r.planets.set(keep.id,keep);
  r.proposals.set('pending',{id:'pending',playerId:'s',x:600,y:300,name:'신청',radius:60});
  const before=structuredClone(keep);assert.equal(relocateDepartments(r),true);assert.deepEqual(keep,before);
  const moved=r.proposals.get('pending');assert.equal(departmentSite(moved.x,moved.y),true);assert.ok(Math.hypot(moved.x-keep.x,moved.y-keep.y)>=200);
  assert.equal(moved.playerId,'s');assert.equal(relocateDepartments(r),false);
});
