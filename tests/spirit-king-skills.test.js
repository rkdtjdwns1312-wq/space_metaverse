import test from 'node:test';
import assert from 'node:assert/strict';
import {monstersOf,monsterViews,moveMonsters,damageMonster} from '../server/monsters.js';
import {spiritOrbViews} from '../server/spirit-king-skills.js';
import {SPIRIT_SUMMON,SPIRIT_ORB} from '../shared/boss-skills.js';
import {mapOf} from '../shared/config.js';
import {onParadiseFloor} from '../shared/paradise-floor.js';
import {ensureVitals} from '../server/vitals.js';

const START=1000;
function fixture(){
  const room={players:new Map(),planets:new Map()};
  const boss=monstersOf(room,START,()=>0).get('spirit-king-boss');
  room.monsters=new Map([[boss.id,boss]]);
  const player={id:'hero',role:'student',connected:true,away:false,mapId:boss.mapId,
    x:boss.x+boss.radius+30,y:boss.y,avatar:{level:5,constellationId:'taurus'},equipmentSlots:[],inventory:[]};
  room.players.set(player.id,player);boss.attackers.set(player.id,1);boss.targetId=player.id;
  boss.summonDecisionAt=START;boss.orbDecisionAt=START;
  return {room,boss,player,tick:(now,roll=0)=>moveMonsters(room,now,()=>roll)};
}

test('성령의 왕은 마나20으로 Lv4 별 지킴이 셋을 소환하고, 지킴이는 1회만 드랍 없이 사라진다',()=>{
  const f=fixture();f.boss.orbReadyAt=Infinity;f.tick(START);
  const guardians=[...f.room.monsters.values()].filter(m=>m.typeId==='star-guardian');
  assert.equal(guardians.length,3);assert.equal(f.boss.mp,80);
  assert.equal(f.boss.summonReadyAt,START+SPIRIT_SUMMON.cooldownMs);
  assert.ok(guardians.every(m=>m.maxHp===1000&&m.summonerId===f.boss.id));
  const map=mapOf(f.boss.mapId);
  assert.ok(guardians.every(m=>onParadiseFloor(map,m.x,m.y,m.radius)));
  assert.equal(monsterViews(f.room,START).filter(m=>m.typeId==='star-guardian').length,3);
  damageMonster(f.room,guardians[0],f.player,1004,START+100);
  assert.equal(f.room.energyDrops?.size||0,0);
  f.tick(START+701,.99);assert.equal(f.room.monsters.has(guardians[0].id),false);
  f.tick(START+2000,.99);assert.equal([...f.room.monsters.values()].filter(m=>m.typeId==='star-guardian').length,2);
});

test('성령의 왕 구체는 20초 동안 바닥 안에서 튕기고, 같은 학생에게 1초 이내 재타격하지 않는다',()=>{
  const f=fixture();f.boss.summonReadyAt=Infinity;
  f.tick(START);assert.equal(f.boss.mp,90);
  assert.equal(f.boss.orbReadyAt,START+SPIRIT_ORB.cooldownMs);
  assert.equal(f.room.spiritOrbs.length,1);
  assert.equal(spiritOrbViews(f.room,f.boss.mapId,START).length,1);
  const orb=f.room.spiritOrbs[0],map=mapOf(f.boss.mapId);
  f.player.x=orb.x;f.player.y=orb.y;
  const before=ensureVitals(f.player).hp;
  const first=f.tick(START+50,.99).filter(hit=>hit.skillKind===SPIRIT_ORB.kind);
  assert.equal(first.length,1);assert.equal(first[0].damage,28);
  assert.equal(ensureVitals(f.player).hp,before-28);
  assert.equal(f.tick(START+999,.99).filter(hit=>hit.skillKind===SPIRIT_ORB.kind).length,0);
  for(let now=START+1000;now<START+20000;now+=100){
    f.tick(now,.99);
    assert.ok(onParadiseFloor(map,orb.x,orb.y,orb.radius));
  }
  f.tick(START+20000,.99);
  assert.equal(spiritOrbViews(f.room,f.boss.mapId,START+20000).length,0);
  assert.equal(f.room.spiritOrbs.length,0);
});

test('성령의 왕을 처치하면 소환 지킴이와 활성 구체를 함께 정리한다',()=>{
  const f=fixture();f.tick(START);f.tick(START+50);
  assert.ok([...f.room.monsters.values()].some(m=>m.typeId==='star-guardian'));
  assert.equal(f.room.spiritOrbs.length,1);
  damageMonster(f.room,f.boss,f.player,10000,START+100);
  assert.equal([...f.room.monsters.values()].filter(m=>m.typeId==='star-guardian').length,0);
  assert.equal(f.room.spiritOrbs.length,0);
});
