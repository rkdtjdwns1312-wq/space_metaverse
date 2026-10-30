import test from 'node:test';
import assert from 'node:assert/strict';
import {monstersOf,moveMonsters,MONSTER_RULES} from '../server/monsters.js';
import {mapOf} from '../shared/config.js';
import {onParadiseFloor} from '../shared/paradise-floor.js';
import {ensureVitals} from '../server/vitals.js';

const START=1000;
function fixture(type){
  const room={players:new Map(),planets:new Map()},boss=monstersOf(room,START,()=>0).get(type+'-boss');
  room.monsters=new Map([[boss.id,boss]]);
  const player={id:'target',role:'student',connected:true,away:false,mapId:boss.mapId,x:boss.x+350,y:boss.y,avatar:{level:4,constellationId:'taurus'},inventory:[],equipmentSlots:[]};
  room.players.set(player.id,player);boss.attackers.set(player.id,1);boss.targetId=player.id;
  return {room,boss,player,map:mapOf(boss.mapId)};
}

test('성령왕은 소환한 지킴이 뒤에 갇히지 않고 우회하여 기본공격을 재개한다',()=>{
  const {room,boss,player,map}=fixture('spirit-king');player.x=boss.x+650;boss.summonDecisionAt=START;boss.orbReadyAt=Infinity;
  moveMonsters(room,START,()=>0);assert.equal(room.monsters.size,6);
  let bossAttacks=0;
  for(let now=START+50;now<START+60000;now+=50){
    ensureVitals(player).hp=60;
    bossAttacks+=moveMonsters(room,now,()=>.99).filter(hit=>hit.monsterId===boss.id&&hit.targetId===player.id).length;
    for(const m of room.monsters.values())assert.ok(onParadiseFloor(map,m.x,m.y,m.radius));
    for(const a of room.monsters.values())for(const b of room.monsters.values())if(a!==b)
      assert.ok(Math.hypot(a.x-b.x,a.y-b.y)>=a.radius+b.radius+10-1e-8,'서로 관통하지 않고 우회해야 한다');
  }
  assert.ok(bossAttacks>0,'소환물과 충돌한 뒤에도 보스 근접 공격이 재개되어야 한다');
});

for(const type of ['leoon','spirit-king'])test(`${type} 수면·기절은 만료까지 멈추고 목표 이탈 뒤 새 공격자 추적을 재개한다`,()=>{
  for(const status of ['sleepUntil','stunUntil']){
    const {room,boss,player}=fixture(type),before={x:boss.x,y:boss.y};boss[status]=START+1000;
    moveMonsters(room,START+500,()=>.99);assert.deepEqual({x:boss.x,y:boss.y},before);assert.equal(boss.moving,false);
    moveMonsters(room,START+1000,()=>.99);assert.ok(Math.hypot(boss.x-before.x,boss.y-before.y)>0);
    player.mapId='space-plaza';moveMonsters(room,START+1050,()=>.99);assert.equal(boss.targetId,null);
    player.mapId=boss.mapId;boss.attackers.set(player.id,2);boss.targetId=player.id;
    const x=boss.x;moveMonsters(room,START+1100,()=>.99);assert.ok(boss.x>x);
    assert.equal(MONSTER_RULES.bossMeleeDwellMs,2000);
  }
});
