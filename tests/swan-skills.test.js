import test from 'node:test';
import assert from 'node:assert/strict';
import {castSwan,advanceSwanAuras,swanAuraViews,swanCooldowns} from '../server/swan-skills.js';
import {advanceProjectiles} from '../server/projectiles.js';
import {combatEnemies,damageTargets} from '../server/sagittarius-skills.js';
import {monstersOf} from '../server/monsters.js';
import {ensureVitals} from '../server/vitals.js';
import {attackPowerOf} from '../shared/combat.js';
import {avatarSizeOf} from '../shared/avatar-size.js';
import {SWAN_VFX,SWAN_NAMES,swanFrameAt,swanSkillOf} from '../shared/swan-skills.js';

function setup(level=4){
  const player={id:'swan',role:'student',connected:true,away:false,mapId:'star-origin-1',x:500,y:450,
    facing:{x:1,y:0},avatar:{level,constellationId:'cygnus'}};
  const room={players:new Map([[player.id,player]]),planets:new Map()};
  const size=avatarSizeOf(player),base=[...monstersOf(room).values()][0];
  const monster=(id,step)=>({...base,id,x:player.x+size*step,y:player.y,hp:1000,maxHp:1000,
    radius:20,attackers:new Map(),contributors:new Map()});
  const near=monster('near',1.5),far=monster('far',3);
  room.monsters=new Map([[near.id,near],[far.id,far]]);
  return {room,player,size,near,far};
}

test('백조자리 일반 깃털은 가로 4배를 날며 첫 몬스터에서 멈춘다',()=>{
  const {room,player,size,near,far}=setup(),now=Date.now();
  const result=castSwan(room,player,now,{basic:true});
  assert.equal(result.hit.projectiles.length,1);
  assert.equal(result.hit.range,size*4);
  assert.equal(result.hit.projectiles[0].basic,true);
  advanceProjectiles(room,now+700,combatEnemies,damageTargets);
  assert.equal(near.hp,1000-attackPowerOf(4,'cygnus',player));
  assert.equal(far.hp,1000);
});

test('날개 단계마다 1/2/3쌍, 강화 깃털 2/3/4개, 마나 10',()=>{
  for(const level of [2,3,4,5]){
    const {room,player,size}=setup(level),now=Date.now();
    const mp=ensureVitals(player).mp,spec=swanSkillOf(player),stage=Math.min(level,4);
    const cast=castSwan(room,player,now);
    assert.equal(mp-ensureVitals(player).mp,10);
    assert.equal(spec.wingPairs,stage-1);
    assert.equal(swanAuraViews(room,player.mapId,now).length,1);
    assert.equal(cast.cooldowns[0],now+20000);
    const shot=castSwan(room,player,now+1000,{basic:true});
    assert.equal(shot.hit.projectiles.length,stage);
    assert.equal(shot.hit.range,size*4);
    assert.ok(shot.hit.projectiles.every(p=>p.kind==='cygnus-attack'&&p.basic));
    assert.equal(player.swanAura.remainingAttacks,9);
  }
});

test('열 번째 일반 공격에서 날개가 끝나고 그때부터 10초 재사용 대기',()=>{
  const {room,player}=setup(3),now=Date.now();
  castSwan(room,player,now);
  assert.throws(()=>castSwan(room,player,now+1000),/날개가 유지/);
  for(let i=1;i<=10;i++){
    const result=castSwan(room,player,now+i*1000,{basic:true});
    assert.equal(result.hit.projectiles.length,3);
  }
  assert.equal(player.swanAura,null);
  assert.equal(player.swanCooldownUntil,now+20000);
  assert.deepEqual(swanAuraViews(room,player.mapId,now+10000),[]);
  assert.throws(()=>castSwan(room,player,now+19999),/기다려/);
  assert.equal(castSwan(room,player,now+20000).ready,true);
});

test('일반 공격을 열 번 하지 않아도 최대 20초 후 종료하고 그때부터 10초 대기',()=>{
  const {room,player}=setup(),now=Date.now();
  castSwan(room,player,now);
  assert.equal(advanceSwanAuras(room,now+19999),false);
  assert.equal(advanceSwanAuras(room,now+20000),true);
  assert.equal(player.swanAura,null);
  assert.equal(swanCooldowns(player)[0],now+30000);
  assert.throws(()=>castSwan(room,player,now+29999),/기다려/);
  assert.equal(castSwan(room,player,now+30000).ready,true);
});

test('잘못된 레벨·부족한 마나·죽은 학생은 날개 스킬을 쓸 수 없다',()=>{
  const {room,player}=setup(),now=Date.now();
  player.avatar.level=1;assert.throws(()=>castSwan(room,player,now),/LV2/);
  player.avatar.level=4;ensureVitals(player).mp=9;
  assert.throws(()=>castSwan(room,player,now),/마나/);
  assert.equal(player.swanAura,undefined);
  ensureVitals(player).mp=30;ensureVitals(player).hp=0;
  assert.throws(()=>castSwan(room,player,now),/지금/);
});

test('백조자리 시트 4종×24F와 날개 발동·유지·소멸 프레임',()=>{
  assert.deepEqual(Object.keys(SWAN_VFX),['attack','skill-lv2','skill-lv3','skill-lv4']);
  assert.equal(SWAN_NAMES[4],'세 번째 날개');
  assert.ok(Object.values(SWAN_VFX).every(spec=>spec.frames===24&&spec.frameSize===256));
  assert.equal(swanFrameAt(0),0);assert.equal(swanFrameAt(499),5);
  assert.equal(swanFrameAt(500),6);assert.equal(swanFrameAt(19500),18);
  assert.equal(swanFrameAt(19999),23);
});
