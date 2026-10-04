import test from 'node:test';
import assert from 'node:assert/strict';
import {castCorvus} from '../server/corvus-skills.js';
import {attackSagittarius,castSagittarius,combatEnemies,damageTargets} from '../server/sagittarius-skills.js';
import {advanceProjectiles,projectileViews} from '../server/projectiles.js';
import {monstersOf} from '../server/monsters.js';

function setup(id){
 const p={id:'caster',connected:true,role:'student',mapId:'star-origin-1',x:500,y:450,facing:{x:1,y:0},avatar:{level:4,constellationId:id}};
 const room={players:new Map([[p.id,p]]),planets:new Map()},template=[...monstersOf(room).values()][0];
 const monster=(id,x,y=450)=>({...template,id,x,y,hp:1000,maxHp:1000,radius:20,attackers:new Map(),contributors:new Map()});
 const near=monster('near',650),far=monster('far',800);room.monsters=new Map([[far.id,far],[near.id,near]]);
 const fire=basic=>id==='corvus'?castCorvus(room,p,1000,{basic}):basic?attackSagittarius(room,p,1000):castSagittarius(room,p,0,1000);
 return{room,p,near,far,fire,advance:now=>advanceProjectiles(room,now,combatEnemies,damageTargets)};
}
for(const id of ['corvus','sagittarius']){
 test(`${id}: Q는 출발 때 무피해, 가까운 몬스터에서 멈추고 뒤쪽은 무피해`,()=>{
  const {room,near,far,fire,advance}=setup(id);fire(true);
  assert.equal(near.hp,1000);assert.deepEqual(advance(1001),[]);
  const hits=advance(1700);assert.equal(hits[0].targets[0].monsterId,'near');assert.ok(near.hp<1000);assert.equal(far.hp,1000);
  assert.ok(hits[0].end.distance<150);assert.equal(room.projectiles.length,0);assert.deepEqual(advance(1800),[]);
 });
 test(`${id}: E는 시전자에서 출발, 가까운 적/먼 적 순으로 관통하고 투사체마다 한 번`,()=>{
  const {room,p,near,far,fire,advance}=setup(id);fire(false);
  const view=projectileViews(room,p.mapId,1000);assert.equal(view[0].x,p.x);assert.equal(view[0].elapsedMs,0);
  assert.deepEqual(projectileViews(room,'other',1000),[]);assert.ok(view.every(v=>!('seen'in v)&&!('power'in v)));
  advance(1300);assert.ok(near.hp<1000);assert.equal(far.hp,1000);
  advance(2400);assert.equal(far.hp,near.hp);assert.equal(room.projectiles.length,0);
  const hp=near.hp;advance(3000);assert.equal(near.hp,hp);
 });
 test(`${id}: 대각선/실시간 위치 판정, 사거리 밖·후방 제외 및 맵 이탈 취소`,()=>{
  const {room,p,near,far,fire,advance}=setup(id);p.facing={x:1,y:1};near.x=650;near.y=600;far.x=400;far.y=350;
  fire(false);near.y=900;advance(1250);assert.equal(near.hp,1000);assert.equal(far.hp,1000);
  p.mapId='other';const canceled=advance(1400);assert.ok(canceled.every(h=>h.end&&h.targets.length===0));assert.equal(room.projectiles.length,0);
 });
}
test('겹친 첫 몬스터는 함께 맞고 다른맵과 지나간 구간에는 소급 타격하지 않음',()=>{
 const {room,near,far,fire,advance}=setup('sagittarius');far.x=near.x;fire(true);const hit=advance(1700)[0];assert.equal(hit.targets.length,2);
 near.hp=far.hp=1000;near.x=900;far.mapId='other';fire(false);advance(1400);near.x=510;advance(1800);assert.equal(near.hp,1000);assert.equal(far.hp,1000);
});
test('투사체 그림 가장자리 밖의 작은 몬스터 여백만 타격한다',()=>{
 const {room,near,far,fire,advance}=setup('sagittarius');
 near.x=650;near.y=40;far.mapId='other';
 fire(true);const cast=room.projectiles[0];
 near.y=cast.y+near.radius+cast.width+Math.min(20,Math.max(4,cast.size*.08))-1;
 advance(1700);assert.ok(near.hp<1000);
 const hp=near.hp;near.hp=1000;near.y+=3;fire(true);advance(1700);assert.equal(near.hp,1000);
 assert.ok(hp<1000);
});
