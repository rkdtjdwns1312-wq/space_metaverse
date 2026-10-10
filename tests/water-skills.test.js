import test from 'node:test';
import assert from 'node:assert/strict';
import {castWater,advanceWaterAuras,waterAuraViews,resolveWaterHit} from '../server/water-skills.js';
import {advanceProjectiles} from '../server/projectiles.js';
import {combatEnemies} from '../server/sagittarius-skills.js';
import {monstersOf} from '../server/monsters.js';
import {ensureVitals} from '../server/vitals.js';
import {attackPowerOf,defensePowerOf} from '../shared/combat.js';
import {avatarSizeOf} from '../shared/avatar-size.js';
import {waterFrameAt,cetusAuraFrameAt,cetusWaveScaleAt,waterProjectileAngle,waterProjectilePoint,waterSkillOf,WATER_VFX} from '../shared/water-skills.js';

const advance=(room,now)=>advanceProjectiles(room,now,combatEnemies,resolveWaterHit);
function setup(id,level=4){
  const player={id:'caster',role:'student',connected:true,mapId:'star-origin-1',x:500,y:450,
    facing:{x:1,y:0},avatar:{level,constellationId:id}},size=avatarSizeOf(player);
  const room={players:new Map([[player.id,player]]),planets:new Map()};
  const original=[...monstersOf(room).values()][0];
  const monster=(name,multiple,y=450)=>({...original,id:name,x:player.x+size*multiple,y,hp:1000,maxHp:1000,
    radius:20,attackers:new Map(),contributors:new Map()});
  const near=monster('near',1.6),far=monster('far',3.1);
  room.monsters=new Map([[near.id,near],[far.id,far]]);
  return {room,player,size,near,far,monster};
}

test('게자리 Q는 평소 첫 몬스터에서 멈추고, E 후 10초간 폭3배·관통·친구 회복',()=>{
  const {room,player,size,near,far}=setup('cancer');const now=Date.now();
  const friend={id:'friend',role:'student',connected:true,mapId:player.mapId,x:player.x+size*2.3,y:player.y+size*.25,
    avatar:{level:4,constellationId:'leo'}};room.players.set(friend.id,friend);ensureVitals(friend).hp=1;
  const base=attackPowerOf(4,'cancer',player),mp=ensureVitals(player).mp;
  const first=castWater(room,player,now,{basic:true});assert.equal(first.hit.range,size*4);
  advance(room,now+650);assert.equal(near.hp,1000-base);assert.equal(far.hp,1000);
  const friendBefore=ensureVitals(friend).hp;
  const result=castWater(room,player,now+1000);assert.equal(result.cooldowns[0],now+21000);
  assert.equal(ensureVitals(player).mp,mp-10);
  assert.equal(waterAuraViews(room,player.mapId,now+1000).length,1);
  const enhanced=castWater(room,player,now+1100,{basic:true});assert.equal(enhanced.hit.width,size*.13*3);
  assert.equal(enhanced.hit.range,size*6);
  advance(room,now+1800);
  assert.equal(near.hp,1000-base-base*3);assert.equal(far.hp,1000-base*3);
  assert.equal(ensureVitals(friend).hp,friendBefore+base*3);
  assert.throws(()=>castWater(room,player,now+2000),/기다려/);
  advanceWaterAuras(room,now+11000);assert.equal(player.waterAura,null);
  castWater(room,player,now+11100,{basic:true});advance(room,now+11800);
  assert.equal(far.hp,1000-base*3);
});

test('고래자리 E는 10초·마나10·방어력 단계별 상승, 매초 가까운 최대 3마리만 한 번씩',()=>{
  for(const level of [2,3,4,5]){
    const {room,player,size,near,far,monster}=setup('cetus',level),now=Date.now();
    const third=monster('third',1.8,player.y+size*.2),fourth=monster('fourth',1.9,player.y-size*.2);
    room.monsters.set(third.id,third);room.monsters.set(fourth.id,fourth);
    const baseDefense=defensePowerOf(level,'cetus',player),mp=ensureVitals(player).mp;
    const result=castWater(room,player,now);assert.equal(result.cooldowns[0],now+20000);
    assert.equal(ensureVitals(player).mp,mp-10);
    assert.equal(defensePowerOf(level,'cetus',player),baseDefense+Math.min(level,4)-1);
    assert.deepEqual(advanceWaterAuras(room,now+999),[]);
    const once=advanceWaterAuras(room,now+1000);assert.equal(once.length,1);assert.equal(once[0].targets.length,3);
    assert.equal([near,far,third,fourth].filter(m=>m.hp<1000).length,3);
    const hp=[near.hp,far.hp,third.hp,fourth.hp];advanceWaterAuras(room,now+1999);
    assert.deepEqual([near.hp,far.hp,third.hp,fourth.hp],hp);
    advanceWaterAuras(room,now+10000);
    assert.equal([near,far,third,fourth].reduce((sum,m)=>sum+(1000-m.hp),0),30*attackPowerOf(level,'cetus',player));
    assert.equal(player.waterAura,null);assert.equal(defensePowerOf(level,'cetus',player),baseDefense);
  }
});

test('고래자리 자동 공격 원의 지름은 확대된 몸의 4배이며 범위 밖 몬스터는 제외',()=>{
  const {room,player,size,monster}=setup('cetus'),now=Date.now();
  const inside=monster('inside',3.5),outside=monster('outside',4.4);
  room.monsters=new Map([[inside.id,inside],[outside.id,outside]]);
  castWater(room,player,now);advanceWaterAuras(room,now+1000);
  assert.ok(inside.hp<1000);assert.equal(outside.hp,1000);
});

test('고래자리 Q는 앞쪽 사거리 2배 안의 두 몬스터를 관통한다',()=>{
  const {room,player,size,near,far}=setup('cetus'),now=Date.now();
  far.x=player.x+size*1.9;
  const q=castWater(room,player,now,{basic:true});
  assert.equal(q.hit.range,size*2);assert.equal(room.projectiles[0].piercing,true);
  advance(room,now+700);
  assert.ok(near.hp<1000);assert.ok(far.hp<1000);
});

test('물고기자리 E는 단계별 4/2/1마리, 100/300/800% 관통·마나5·10초 쿨타임',()=>{
  for(const [level,hits,multiplier] of [[2,4,1],[3,2,3],[4,1,8],[5,1,8]]){
    const {room,player,near,far,size}=setup('pisces',level),now=Date.now(),mp=ensureVitals(player).mp;
    const spec=waterSkillOf(player);assert.equal(spec.hits,hits);assert.equal(spec.multiplier,multiplier);
    const result=castWater(room,player,now);assert.equal(result.hit.range,size*4.8);
    assert.equal(result.hit.projectiles.length,hits);assert.equal(ensureVitals(player).mp,mp-5);
    assert.deepEqual(result.hit.projectiles.map(projectile=>projectile.elapsedMs),Array.from({length:hits},(_,i)=>-i*120));
    assert.equal(result.cooldowns[0],now+10000);
    advance(room,now+2000);
    const damage=Math.round(attackPowerOf(level,'pisces',player)*multiplier)*hits;
    assert.equal(near.hp,1000-damage);assert.equal(far.hp,1000-damage);
    assert.throws(()=>castWater(room,player,now+9999),/기다려/);
  }
});

test('물고기 Q는 사거리4배 첫 몬스터에서 종료, LV1·마나 부족은 무소모',()=>{
  const {room,player,near,far,size}=setup('pisces',3),now=Date.now();
  ensureVitals(player).mp=0;const q=castWater(room,player,now,{basic:true});assert.equal(q.hit.range,size*4);
  advance(room,now+700);assert.ok(near.hp<1000);assert.equal(far.hp,1000);
  assert.throws(()=>castWater(room,player,now+800),/마나/);assert.equal(player.waterCooldownUntil,undefined);
  player.avatar.level=1;assert.throws(()=>castWater(room,player,now+900,{basic:true}),/LV2/);
});

test('각 별자리 4시트×24F 등록과 10초 오라 발동·반복·소멸 프레임',()=>{
  for(const star of ['cancer','cetus','pisces'])assert.deepEqual(Object.keys(WATER_VFX[star]),
    ['attack','skill-lv2','skill-lv3','skill-lv4']);
  assert.equal(waterFrameAt(0),0);assert.equal(waterFrameAt(499),5);
  assert.equal(waterFrameAt(500),6);assert.equal(waterFrameAt(9499),17);
  assert.equal(waterFrameAt(9500),18);assert.equal(waterFrameAt(9999),23);
});

test('고래 오라는 8프레임으로 반복하고 파도는 거리 2/3에서 가장 커졌다 끝에서 사라진다',()=>{
  assert.equal(cetusAuraFrameAt(0),0);assert.equal(cetusAuraFrameAt(760),4);
  assert.equal(cetusAuraFrameAt(1519),7);assert.equal(cetusAuraFrameAt(1520),0);
  assert.ok(cetusWaveScaleAt(0)<cetusWaveScaleAt(.33));
  assert.ok(cetusWaveScaleAt(.33)<cetusWaveScaleAt(2/3));
  assert.ok(cetusWaveScaleAt(.9)<cetusWaveScaleAt(2/3));
  assert.equal(cetusWaveScaleAt(1),0);
});

test('물고기 연출은 앞으로 전진하며 중간에 솟고 사거리 끝 바닥에 착지한다',()=>{
  const cast={kind:'pisces-skill',x:100,y:200,dx:1,dy:0,range:400,size:80};
  const points=[0,.25,.5,.75,1].map(p=>waterProjectilePoint(cast,p));
  assert.deepEqual(points.map(point=>point.x),[100,200,300,400,500]);
  assert.deepEqual(points.map(point=>point.y),[200,162.5,150,162.5,200]);
});

test('물빛 투사체는 좌우뿐 아니라 수직 방향도 정확히 바라본다',()=>{
  assert.equal(waterProjectileAngle({dx:0,dy:1}),Math.PI/2);
  assert.equal(waterProjectileAngle({dx:0,dy:-1}),-Math.PI/2);
  assert.equal(waterProjectileAngle({dx:-1,dy:0}),Math.PI);
});
