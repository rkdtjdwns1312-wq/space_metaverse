import test from 'node:test';
import assert from 'node:assert/strict';
import {STATIC_MAPS,RULES,MAP,GARDEN,PARADISE_MAPS,MOON_PARADISE_MAPS,STAR_PARADISE} from '../shared/config.js';
import {paradiseFloor,onParadiseFloor,floorRenderPoint,paradiseScale} from '../shared/paradise-floor.js';
import {isFree,advance,arrivePosition,spawnInside} from '../server/world.js';
const maps=[GARDEN,...PARADISE_MAPS,...MOON_PARADISE_MAPS,STAR_PARADISE];
const room=()=>({players:new Map(),planets:new Map(),unattended:true});
test('낙원8맵 중앙 공간 확대·모든 문과 입장 좌표가 바닥 안에 연결된다',()=>{
  for(const map of maps){
    const f=paradiseFloor(map);assert.equal(map.width,1200*paradiseScale(map.id));assert.equal(map.height,760*paradiseScale(map.id));
    assert.ok(f.rx*f.ry>425*190*3,'기존 가장 큰 중앙 공간보다 면적3배 이상');
    assert.ok(onParadiseFloor(map,map.spawn.x,map.spawn.y,RULES.radius));
    for(const gate of map.objects){
      for(let t=0;t<=100;t++)assert.ok(onParadiseFloor(map,f.cx+(gate.x-f.cx)*t/100,f.cy+(gate.y-f.cy)*t/100,RULES.radius),map.id+' '+gate.id+' 다리 연결');
      const target=STATIC_MAPS[gate.target];assert.ok(isFree(room(),gate.arrival.x,gate.arrival.y,null,target.id));
    }
  }
  const arrival=MAP.objects.find(o=>o.target===GARDEN.id).arrival;
  assert.ok(onParadiseFloor(GARDEN,arrival.x,arrival.y,RULES.radius));
});
test('태양·달의 낙원 1은 20%, 2는 40% 넓고 보스 맵은 기존 크기를 유지한다',()=>{
  for(const prefix of ['sun-paradise','moon-paradise']){
    const ids=[prefix==='sun-paradise'?prefix:prefix+'-1',prefix+'-2',prefix+'-3'];
    for(const [index,original] of [1.55,1.62,1.68].entries()){
      const map=STATIC_MAPS[ids[index]],scale=original*[1.2,1.4,1][index],floor=paradiseFloor(map);
      assert.equal(paradiseScale(map.id),scale);
      assert.equal(map.width,1200*scale);assert.equal(map.height,760*scale);
      assert.ok(Math.abs(floor.rx-660*scale/1.5)<1e-9);
      assert.ok(Math.abs(floor.ry-370*scale/1.5)<1e-9);
    }
  }
  assert.equal(paradiseScale(STAR_PARADISE.id),1.5*1.3);
  assert.ok(Math.abs(STAR_PARADISE.width-1200*1.5*1.3)<1e-9);
  assert.ok(Math.abs(STAR_PARADISE.height-760*1.5*1.3)<1e-9);
  assert.equal(paradiseFloor(STAR_PARADISE).rx,660*1.3);
  assert.equal(paradiseFloor(STAR_PARADISE).ry,370*1.3);
});
test('낙원 원형 벽과 다리 양쪽은 안팎 모두 이동 금지, 다리 접합부는 열린다',()=>{
  for(const map of maps){
    const f=paradiseFloor(map),r=room();
    for(const b of f.bridges){
      const dx=Math.cos(b.angle),dy=Math.sin(b.angle),distance=((b.direction%2?f.ry:f.rx)+b.end)/2;
      assert.ok(isFree(r,f.cx+dx*distance,f.cy+dy*distance,null,map.id));
      for(const side of [-1,1]){
        assert.equal(isFree(r,f.cx+dx*distance-dy*(f.half+10)*side,f.cy+dy*distance+dx*(f.half+10)*side,null,map.id),false);
        assert.equal(isFree(r,f.cx+dx*distance-dy*(f.half-4)*side,f.cy+dy*distance+dx*(f.half-4)*side,null,map.id),false,'아바타 발밑 반경 보호');
      }
    }
    for(const a of [Math.PI/4,Math.PI*3/4,Math.PI*5/4,Math.PI*7/4])assert.equal(isFree(r,f.cx+f.rx*1.08*Math.cos(a),f.cy+f.ry*1.08*Math.sin(a),null,map.id),false);
  }
});
test('서버 연속·대각선 입력으로 벽이나 다리 옆을 뚫을 수 없다',()=>{
  for(const map of maps){
    const f=paradiseFloor(map),r=room();
    const p={id:'student',connected:true,mapId:map.id,avatar:{level:2},role:'student'};r.players.set(p.id,p);
    for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1],[1,1],[-1,-1],[1,-1],[-1,1]]){
      Object.assign(p,{x:f.cx,y:f.cy});
      for(let tick=0;tick<100;tick++){p.input={x:dx,y:dy,at:tick*50};advance(r,tick*50);assert.ok(isFree(r,p.x,p.y,p.id,map.id,false));}
      const end={x:p.x,y:p.y};p.input.at=5000;advance(r,5000);assert.deepEqual({x:p.x,y:p.y},end,'경계에서 정지');
    }
    for(const b of f.bridges){
      const d=((b.direction%2?f.ry:f.rx)+b.end)/2,dx=Math.cos(b.angle),dy=Math.sin(b.angle);
      Object.assign(p,{x:f.cx+dx*d,y:f.cy+dy*d});
      for(let tick=0;tick<20;tick++){p.input={x:-dy,y:dx,at:tick*50};advance(r,tick*50);assert.ok(isFree(r,p.x,p.y,p.id,map.id,false),'다리 옆 경계');}
    }
  }
});
test('친구 호출·붐비는 입장도 바닥 내부에 배치하고 낙원 외 맵은 영향 없다',()=>{
  for(const map of maps){
    const r=room();
    for(let i=0;i<30;i++){const p=arrivePosition(r,map.id,map.objects[0]);assert.ok(onParadiseFloor(map,p.x,p.y,RULES.radius));r.players.set(String(i),{...p,id:String(i),mapId:map.id});}
    const spawn=spawnInside(r,map.id);assert.ok(onParadiseFloor(map,spawn.x,spawn.y,RULES.radius));
  }
  assert.ok(isFree(room(),MAP.spawn.x,MAP.spawn.y,null,MAP.id));
  assert.ok(onParadiseFloor(MAP,MAP.spawn.x,MAP.spawn.y));
});
test('다리 모서리 보간이 바깥으로 나가면 확정된 안전 좌표를 그린다',()=>{
  const safe=GARDEN.spawn,outside={x:40,y:40};
  assert.equal(floorRenderPoint(GARDEN,outside,safe,RULES.radius),safe);
  const inside={x:900,y:570};assert.equal(floorRenderPoint(GARDEN,inside,safe,RULES.radius),inside);
});
