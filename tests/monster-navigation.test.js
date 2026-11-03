import test from 'node:test';
import assert from 'node:assert/strict';
import {monstersOf,moveMonsters,damageMonster} from '../server/monsters.js';
import {nearbyMonsterBodies,bodyBlocksStep} from '../server/monster-navigation.js';
import {mapOf} from '../shared/config.js';
import {onParadiseFloor} from '../shared/paradise-floor.js';
import {ensureVitals} from '../server/vitals.js';

function scene({side=1,swarm=false}={}){
  const room={players:new Map(),planets:new Map()},start=1000;
  const template=monstersOf(room,start,()=>0).get('star-dragon-1'),map=mapOf(template.mapId);
  const cx=map.width/2,cy=map.height/2;
  const player={id:'target',role:'student',connected:true,mapId:map.id,x:cx+side*460,y:cy,avatar:{level:5,constellationId:'sagittarius'}};
  room.players.set(player.id,player);room.monsters=new Map();
  const movers=Array.from({length:swarm?3:1},(_,i)=>({...structuredClone(template),id:'chaser-'+i,x:cx-side*350,y:cy+(i-1)*(swarm?210:0),lastMoveAt:start}));
  const blocker={...structuredClone(template),id:'blocker',x:cx,y:cy,stunUntil:start+90000};
  room.monsters.set(blocker.id,blocker);
  for(const m of movers){room.monsters.set(m.id,m);damageMonster(room,m,player,1,start);}
  return {room,start,player,movers,blocker,map};
}

for(const side of [1,-1])test(`몸이 막혀도 ${side===1?'오른쪽':'왼쪽'} 공격자까지 우회 추적하고 공격한다`,()=>{
  const {room,start,player,movers:[m],blocker,map}=scene({side});let hit=false;
  const hp=m.hp;let maxDetour=0;
  for(let now=start+100;now<=start+45000;now+=100){
    ensureVitals(player).hp=1000;
    const previous={x:m.x,y:m.y};
    const hits=moveMonsters(room,now,()=>.99);hit ||= hits.some(h=>h.targetId===player.id);
    maxDetour=Math.max(maxDetour,Math.abs(m.y-blocker.y));
    assert.ok(onParadiseFloor(map,m.x,m.y,m.radius));
    assert.ok(Math.hypot(m.x-blocker.x,m.y-blocker.y)>=m.radius+blocker.radius+10-1e-6);
    assert.ok(Math.hypot(m.x-previous.x,m.y-previous.y)<=7,'우회도 원래 이동속도를 넘지 않는다');
    assert.equal(m.hp,hp);assert.equal(m.blockedChase,null);
    if(hit)break;
  }
  assert.ok(maxDetour>150);assert.ok(hit,'옆으로 비키기만 하는 것이 아니라 공격자에게 도착한다');
});

test('세 마리가 한 공격자를 추적해도 서로를 통과하지 않고 모두 접근한다',()=>{
  const {room,start,player,movers,map}=scene({swarm:true});const hitIds=new Set();
  for(let now=start+100;now<=start+60000;now+=100){
    ensureVitals(player).hp=1000;
    for(const hit of moveMonsters(room,now,()=>.99))if(hit.targetId===player.id)hitIds.add(hit.monsterId);
    const alive=[...room.monsters.values()];
    for(let i=0;i<alive.length;i++){
      assert.ok(onParadiseFloor(map,alive[i].x,alive[i].y,alive[i].radius));
      for(let j=i+1;j<alive.length;j++)assert.ok(Math.hypot(alive[i].x-alive[j].x,alive[i].y-alive[j].y)>=alive[i].radius+alive[j].radius+10-1e-6);
    }
    if(movers.every(m=>hitIds.has(m.id)))break;
  }
  assert.equal(hitIds.size,3);
});

test('충돌 후보는 다른 맵·죽은 몸·멀리 있는 몸을 제외하고 현재 위치를 반영한다',()=>{
  const m={x:0,y:0,radius:24,mapId:'a',hp:10};
  const near={...m,x:58},far={...m,x:500},dead={...m,x:10,hp:0},elsewhere={...m,x:10,mapId:'b'};
  const monsters=new Map([['self',m],['near',near],['far',far],['dead',dead],['other',elsewhere]]);
  assert.equal(nearbyMonsterBodies(monsters,m,5).length,1);
  assert.equal(bodyBlocksStep(nearbyMonsterBodies(monsters,m,5),5,0),true);
  near.x=500;far.x=58;
  assert.equal(bodyBlocksStep(nearbyMonsterBodies(monsters,m,5),5,0),true);
  monsters.delete('far');assert.equal(nearbyMonsterBodies(monsters,m,5).length,0);
});

test('이미 겹친 몸은 분리하는 방향만 허용하고 더 깊이 진입하지 않는다',()=>{
  const m={x:0,y:0,radius:24,mapId:'a',hp:10},other={...m,x:20};
  const bodies=nearbyMonsterBodies(new Map([['a',m],['b',other]]),m,5);
  assert.equal(bodyBlocksStep(bodies,-5,0),false);
  assert.equal(bodyBlocksStep(bodies,5,0),true);
});
