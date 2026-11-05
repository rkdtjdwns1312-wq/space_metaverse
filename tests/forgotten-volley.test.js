import test from 'node:test';
import assert from 'node:assert/strict';
import {FORGOTTEN_CONSTELLATION as spec} from '../shared/forgotten-constellation.js';
import {tryHomingVolley,tickHomingStar,homingStarsView,homingVolleyView} from '../server/forgotten-homing-star.js';
import {ensureVitals,damagePlayer} from '../server/vitals.js';
import {monsterType} from '../shared/monsters.js';

function fixture(){
  const actor=(id,y)=>({id,role:'student',connected:true,mapId:spec.mapId,avatar:{level:5},x:1500,y});
  const a=actor('a',0),b=actor('b',250);
  const boss={id:spec.monsterId,typeId:spec.typeId,mapId:spec.mapId,hp:20000,mp:100,x:0,y:0,radius:150};
  const room={players:new Map([[a.id,a],[b.id,b]])};
  const tick=(t,rolls=[0,.9])=>tickHomingStar(room,boss,a,t,()=>rolls.shift()??.9);
  return {room,boss,a,b,tick};
}
test('volley overlaps each puzzle, consumes mana once, lasts 30s and is ready again after 60s',()=>{
  for(const active of ['links','names','gather']){
    const {room,boss,tick}=fixture();boss[active]={id:'existing'};
    assert(tryHomingVolley(room,boss,0,()=>0));assert.equal(boss.mp,90);
    assert.deepEqual(boss[active],{id:'existing'});assert(!tryHomingVolley(room,boss,10,()=>0));
    tick(2499);assert.equal(homingStarsView(boss,2499).length,0);
    tick(2500,[0,.1]);assert.equal(homingStarsView(boss,2500).length,1);
    tick(29999,[0,.1]);assert(homingVolleyView(boss,29999));tick(30000);
    assert.equal(homingVolleyView(boss,30000),null);assert(!tryHomingVolley(room,boss,59999,()=>0));
    // The late shot may finish after the buff. New basic shots have the ordinary cadence.
    tick(34998);assert.equal(boss.homing.lastFiredAt,29999);tick(34999);
    assert.equal(boss.homing.shots.at(-1).color,'yellow');assert(tryHomingVolley(room,boss,60000,()=>0));
  }
});
test('consecutive blue shots can target different players; each missed shot hits the map once',()=>{
  const {room,boss,a,b,tick}=fixture();assert(tryHomingVolley(room,boss,0,()=>0));
  const other={...a,id:'away',mapId:'space-plaza'};room.players.set(other.id,other);
  const expected=damagePlayer({...a,avatar:{...a.avatar}},monsterType(spec.typeId).power*2,5500).damage;
  tick(2500,[0,.9]);tick(5000,[.9,.9]);
  assert.deepEqual(boss.homing.shots.map(s=>[s.color,s.targetId]),[['blue',a.id],['blue',b.id]]);
  assert.equal(homingStarsView(boss,5000).length,2);
  const hits=tick(5500);assert.deepEqual(hits.map(h=>h.targetId).sort(),['a','b']);assert.equal(hits[0].damage,expected);
  assert.deepEqual(tick(5550),[]);assert.equal(homingStarsView(boss,5550).length,1);
});
test('intercepted blue shot causes no damage even after its target leaves; yellow deals normal damage',()=>{
  const {room,boss,a,b,tick}=fixture();assert(tryHomingVolley(room,boss,0,()=>0));
  tick(2500,[.9,.9]);b.mapId='space-plaza';
  const s=boss.homing.shots[0];a.x=120*s.dx;a.y=120*s.dy;
  const hp=ensureVitals(a).hp;assert.deepEqual(tick(3100),[]);assert.equal(ensureVitals(a).hp,hp);
  assert.equal(boss.homing.shots.length,0);tick(5000,[0,.1]);assert.equal(boss.homing.shots[0].color,'yellow');
  const hits=tick(5600);assert.equal(hits.length,1);assert.equal(hits[0].targetId,a.id);assert(ensureVitals(a).hp<hp);
  assert.deepEqual(tick(8000),[]);boss.hp=0;tick(9000);assert.equal(boss.homing,null);assert.equal(boss.homingVolley,null);
});
