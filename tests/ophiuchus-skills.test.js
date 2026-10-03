import test from 'node:test';
import assert from 'node:assert/strict';
import {castOphiuchus,advanceOphiuchusPoison} from '../server/ophiuchus-skills.js';
import {advanceProjectiles} from '../server/projectiles.js';
import {combatEnemies,damageTargets} from '../server/sagittarius-skills.js';
import {monstersOf} from '../server/monsters.js';
import {ensureVitals} from '../server/vitals.js';
import {playerEffectsView} from '../server/rooms.js';
import {attackPowerOf} from '../shared/combat.js';
import {avatarSizeOf} from '../shared/avatar-size.js';
import {OPHIUCHUS_VFX,ophiuchusSkillOf,ophiuchusFrameAt} from '../shared/ophiuchus-skills.js';

function setup(level=4){
  const player={id:'snake',role:'student',connected:true,away:false,mapId:'star-origin-1',x:500,y:450,
    facing:{x:1,y:0},avatar:{level,constellationId:'ophiuchus'},effects:[]};
  const room={players:new Map([[player.id,player]]),planets:new Map()};
  const size=avatarSizeOf(player),base=[...monstersOf(room).values()][0];
  const monster=(id,x,y)=>({...base,id,x,y,hp:1000,maxHp:1000,radius:15,
    attackers:new Map(),contributors:new Map()});
  const near=monster('near',player.x+size*1.2,player.y),edge=monster('edge',player.x+size*2.8,player.y),
    out=monster('out',player.x+size*3.8,player.y);
  room.monsters=new Map([[near.id,near],[edge.id,edge],[out.id,out]]);
  return {room,player,size,near,edge,out};
}

test('검은 수정 Q는 가로4배이며 첫 몬스터에 막힌다',()=>{
  const {room,player,size,near,edge}=setup(),now=Date.now(),power=attackPowerOf(4,'ophiuchus',player);
  const result=castOphiuchus(room,player,now,{basic:true});
  assert.equal(result.hit.range,size*4);assert.equal(result.hit.projectiles.length,1);
  advanceProjectiles(room,now+700,combatEnemies,damageTargets);
  assert.equal(near.hp,1000-power);assert.equal(edge.hp,1000);
});

test('뱀 크기와 독 폭·거리가 LV2→4로 커지고 직접 피해·중독 시간이 맞다',()=>{
  for(const level of [2,3,4]){
    const {room,player,near,edge,out}=setup(level),now=Date.now(),spec=ophiuchusSkillOf(player);
    const mp=ensureVitals(player).mp,power=attackPowerOf(level,'ophiuchus',player);
    const result=castOphiuchus(room,player,now);
    assert.equal(mp-ensureVitals(player).mp,5);assert.equal(result.hit.snakeScale,[0,0,2,2.5,3][level]);
    assert.equal(result.hit.range,avatarSizeOf(player)*spec.rangeWidths);
    assert.equal(near.hp,1000-power*(level-1));
    assert.equal(near.combatPoison.expiresAt,now+level*2000);
    assert.equal(edge.hp,level>=3?1000-power*(level-1):1000);
    assert.equal(out.hp,1000);
  }
});

test('중독은 초당 공격력100%, 재중독시 남은 시간+3초와 초당100% 누적',()=>{
  const {room,player,near}=setup(2),now=Date.now(),power=attackPowerOf(2,'ophiuchus',player);
  castOphiuchus(room,player,now);
  advanceOphiuchusPoison(room,now+1000);
  assert.equal(near.hp,1000-power*2);
  const second={...player,id:'second',battleVitals:null,ophiuchusCooldownUntil:0};room.players.set(second.id,second);
  castOphiuchus(room,second,now+2000);
  assert.equal(near.combatPoison.stacks,2);assert.equal(near.combatPoison.expiresAt,now+7000);
  advanceOphiuchusPoison(room,now+2000);
  assert.equal(near.hp,1000-power*5);
  advanceOphiuchusPoison(room,now+7000);
  assert.equal(near.combatPoison,null);
});

test('서로 다른 시전자의 중독 중첩은 각 공격력·기여도로 계산하고 한 명이 떠나도 남은 중독은 유지',()=>{
  const {room,player,near}=setup(2),now=Date.now();
  const stronger={...player,id:'stronger',avatar:{...player.avatar,level:4},battleVitals:null,ophiuchusCooldownUntil:0};
  room.players.set(stronger.id,stronger);
  const firstPower=attackPowerOf(2,'ophiuchus',player),secondPower=attackPowerOf(4,'ophiuchus',stronger);
  castOphiuchus(room,player,now);
  advanceOphiuchusPoison(room,now+1000);
  castOphiuchus(room,stronger,now+1000);
  const before=near.hp,firstCredit=near.contributors.get(player.id),secondCredit=near.contributors.get(stronger.id);
  advanceOphiuchusPoison(room,now+2000);
  assert.equal(before-near.hp,firstPower+secondPower);
  assert.equal(near.contributors.get(player.id)-firstCredit,firstPower);
  assert.equal(near.contributors.get(stronger.id)-secondCredit,secondPower);
  stronger.mapId='plaza';const after=near.hp;
  advanceOphiuchusPoison(room,now+3000);
  assert.equal(after-near.hp,firstPower);
  assert.equal(near.combatPoison.layers.length,1);
  assert.equal(near.combatPoison.layers[0].sourceId,player.id);
});

test('학생도 독 범위 안에서 피해와 임시 중독 상태를 받고, 맵을 떠나면 중단',()=>{
  const {room,player,size}=setup(2),now=Date.now();
  const other={id:'other',role:'student',connected:true,away:false,mapId:player.mapId,
    x:player.x+size,y:player.y+size*.5,avatar:{level:4,constellationId:'cygnus'},effects:[]};
  room.players.set(other.id,other);const before=ensureVitals(other).hp;
  const result=castOphiuchus(room,player,now);
  assert.equal(result.playerTargets.length,1);assert.ok(ensureVitals(other).hp<before);
  assert.ok(playerEffectsView(other,false,now).some(effect=>effect.statusId==='poison'));
  other.mapId='plaza';advanceOphiuchusPoison(room,now+1000);
  assert.equal(other.combatPoison,null);
});

test('LV1·마나 부족·쿨타임은 효과 없이 거부하고 시트는 24F',()=>{
  const {room,player}=setup(),now=Date.now();
  player.avatar.level=1;assert.throws(()=>castOphiuchus(room,player,now),/LV2/);
  player.avatar.level=4;ensureVitals(player).mp=4;
  assert.throws(()=>castOphiuchus(room,player,now),/마나/);
  assert.equal(player.ophiuchusCooldownUntil,undefined);
  ensureVitals(player).mp=30;castOphiuchus(room,player,now);
  assert.throws(()=>castOphiuchus(room,player,now+4999),/기다려/);
  assert.equal(castOphiuchus(room,player,now+5000).ready,true);
  assert.equal(Object.keys(OPHIUCHUS_VFX).length,4);
  assert.ok(Object.values(OPHIUCHUS_VFX).every(spec=>spec.frames===24));
  assert.equal(ophiuchusFrameAt(0),0);assert.equal(ophiuchusFrameAt(999),23);
});
