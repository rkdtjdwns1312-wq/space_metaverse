import test from 'node:test';
import assert from 'node:assert/strict';
import {monstersOf,monsterViews,moveMonsters,damageMonster} from '../server/monsters.js';
import {spiritOrbViews,trySpiritKingSkills,trySpiritGuardianHeal} from '../server/spirit-king-skills.js';
import {SPIRIT_SUMMON,SPIRIT_ORB} from '../shared/boss-skills.js';
import {mapOf} from '../shared/config.js';
import {onParadiseFloor} from '../shared/paradise-floor.js';
import {ensureVitals} from '../server/vitals.js';
import {monsterType} from '../shared/monsters.js';
import {MONSTER_RULES,selectMonsterTarget} from '../server/monsters.js';

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

test('성령의 왕은 마나20으로 Lv3 별 지킴이 다섯을 소환하고, 지킴이는 1회만 드랍 없이 사라진다',()=>{
  const f=fixture();f.boss.orbReadyAt=Infinity;f.tick(START);
  const guardians=[...f.room.monsters.values()].filter(m=>m.typeId==='star-guardian');
  assert.equal(guardians.length,5);assert.equal(f.boss.mp,80);
  assert.equal(f.boss.summonReadyAt,START+SPIRIT_SUMMON.cooldownMs);
  assert.ok(guardians.every(m=>m.maxHp===300&&m.summonerId===f.boss.id&&m.radius===120/4));
  const map=mapOf(f.boss.mapId);
  assert.ok(guardians.every(m=>onParadiseFloor(map,m.x,m.y,m.radius)));
  assert.equal(monsterViews(f.room,START).filter(m=>m.typeId==='star-guardian').length,5);
  damageMonster(f.room,guardians[0],f.player,302,START+100);
  assert.equal(f.room.energyDrops?.size||0,0);
  f.tick(START+701,.99);assert.equal(f.room.monsters.has(guardians[0].id),false);
  f.tick(START+2000,.99);assert.equal([...f.room.monsters.values()].filter(m=>m.typeId==='star-guardian').length,4);
});

test('별 지킴이는 그림·충돌 반경을 1/4로 공유하고 실제 추적 속도는 두 배다',()=>{
  const f=fixture();f.boss.orbReadyAt=Infinity;f.tick(START);
  const guardian=[...f.room.monsters.values()].find(m=>m.summonerId===f.boss.id);
  f.room.monsters=new Map([[guardian.id,guardian]]);Object.assign(f.player,{x:guardian.x+300,y:guardian.y});
  const before={x:guardian.x,y:guardian.y};f.tick(START+100,.99);
  assert.equal(monsterType('star-guardian').radius,30);
  assert.equal(monsterViews(f.room,START+100)[0].radius,30);
  assert.ok(Math.abs(Math.hypot(guardian.x-before.x,guardian.y-before.y)-MONSTER_RULES.speed*1.69*2*.1)<1e-8);
});

test('지킴이는 Lv3 수치로 공격 이력이 없는 가장 가까운 학생을 추적하고 선제공격한다',()=>{
 const f=fixture();f.boss.orbReadyAt=Infinity;f.tick(START);
 const guardian=[...f.room.monsters.values()].find(m=>m.summonerId===f.boss.id);
 f.room.monsters=new Map([[guardian.id,guardian]]);guardian.attackers.clear();guardian.targetId=null;
 const nearer={...f.player,id:'nearer',avatar:{level:4,constellationId:'aries'},x:guardian.x+100,y:guardian.y};f.room.players.set(nearer.id,nearer);
 Object.assign(f.player,{x:guardian.x+300,y:guardian.y});assert.equal(selectMonsterTarget(f.room,guardian),nearer);
 const type=monsterType('star-guardian');assert.deepEqual([type.level,type.hp,type.power,type.defense,type.radius,type.combat.speedFactor],[3,300,10,2,30,3.38]);
 assert.equal(damageMonster(f.room,guardian,nearer,12,START+1).damage,10);guardian.attackers.clear();
 const x=guardian.x;f.tick(START+100,.99);assert(guardian.x>x);
 nearer.x=guardian.x+guardian.radius+5;nearer.y=guardian.y;guardian.nextAttackAt=START+1000;
 assert(f.tick(START+1000,.99).some(hit=>hit.monsterId===guardian.id&&hit.targetId===nearer.id));
 nearer.mapId='space-plaza';assert.equal(selectMonsterTarget(f.room,guardian),f.player);
});

test('지킴이 최근접 후보는 접속·맵·생존·유령·교사 규칙을 지키고 거리 변화에 재선택한다',()=>{
 const f=fixture();f.boss.orbReadyAt=Infinity;f.tick(START);const g=[...f.room.monsters.values()].find(m=>m.summonerId===f.boss.id);
 Object.assign(f.player,{x:g.x+200,y:g.y});g.attackers.clear();
 for(const mutate of [p=>p.connected=false,p=>p.away=true,p=>p.mapId='space-plaza',p=>p.avatar.blackStar=true,p=>ensureVitals(p).hp=0,p=>p.role='teacher']){
  const p={...f.player,id:'invalid',avatar:{...f.player.avatar},x:g.x+1,battleVitals:undefined};mutate(p);f.room.players.set(p.id,p);assert.equal(selectMonsterTarget(f.room,g),f.player);f.room.players.delete(p.id);
 }
 const teacher={...f.player,id:'teacher',role:'teacher',avatar:{...f.player.avatar},x:g.x+1,battleVitals:undefined};f.room.players.set(teacher.id,teacher);g.teacherRetaliation=new Set([teacher.id]);assert.equal(selectMonsterTarget(f.room,g),teacher);
 teacher.avatar.teacherPreview=true;assert.equal(selectMonsterTarget(f.room,g),f.player);f.room.players.delete(teacher.id);
 const friend={...f.player,id:'friend',avatar:{...f.player.avatar},x:g.x+400,battleVitals:undefined};f.room.players.set(friend.id,friend);assert.equal(selectMonsterTarget(f.room,g),f.player);
 friend.x=g.x+10;assert.equal(selectMonsterTarget(f.room,g),friend);friend.away=true;f.player.away=true;g.hp=123;assert.equal(selectMonsterTarget(f.room,g),null);assert.equal(g.hp,123);
});

test('재소환은 생존 지킴이 다섯까지만 채우며 기존 지킴이와 겹치지 않는다',()=>{
 const f=fixture();f.boss.orbReadyAt=Infinity;f.boss.blueStarReadyAt=Infinity;f.tick(START);const map=mapOf(f.boss.mapId);
 const living=()=>[...f.room.monsters.values()].filter(m=>m.summonerId===f.boss.id&&m.hp>0);
 assert.equal(living().length,5);living()[0].hp=0;f.boss.summonReadyAt=0;f.boss.summonDecisionAt=0;
 assert.equal(trySpiritKingSkills(f.room,f.boss,f.player,START+2000,()=>0,map),true);assert.equal(living().length,5);
 for(const a of living())for(const b of living())if(a!==b)assert(Math.hypot(a.x-b.x,a.y-b.y)>=a.radius+b.radius+10);
 f.boss.summonReadyAt=0;f.boss.summonDecisionAt=0;const mana=f.boss.mp;
 assert.equal(trySpiritKingSkills(f.room,f.boss,f.player,START+4000,()=>0,map),false);assert.equal(living().length,5);assert.equal(f.boss.mp,mana);
});

test('성령의 왕 구체는 마나5로 30초 지속하며 닿으면 방어와 무관하게 즉사한다',()=>{
  const f=fixture();f.boss.summonReadyAt=Infinity;
  f.tick(START);assert.equal(f.boss.mp,95);
  assert.equal(f.boss.orbReadyAt,START+SPIRIT_ORB.cooldownMs);
  assert.equal(f.room.spiritOrbs.length,1);
  assert.equal(spiritOrbViews(f.room,f.boss.mapId,START).length,1);
  const orb=f.room.spiritOrbs[0],map=mapOf(f.boss.mapId);
  f.player.x=orb.x;f.player.y=orb.y;
  const before=ensureVitals(f.player).hp;
  const first=f.tick(START+50,.99).filter(hit=>hit.skillKind===SPIRIT_ORB.kind);
  assert.equal(first.length,1);assert.equal(first[0].damage,before);
  assert.equal(ensureVitals(f.player).hp,0);assert.equal(first[0].defeated,true);
  assert.equal(f.tick(START+999,.99).filter(hit=>hit.skillKind===SPIRIT_ORB.kind).length,0);
  for(let now=START+1000;now<START+30000;now+=100){
    f.tick(now,.99);
    assert.ok(onParadiseFloor(map,orb.x,orb.y,orb.radius));
  }
  f.tick(START+30000,.99);
  assert.equal(spiritOrbViews(f.room,f.boss.mapId,START+30000).length,0);
  assert.equal(f.room.spiritOrbs.length,0);
});

test('태양달 구체는 20초 뒤 재시전하여 두 개가 함께 남고 각각 30초에 사라진다',()=>{
  const f=fixture(),map=mapOf(f.boss.mapId);f.boss.summonReadyAt=Infinity;f.boss.blueStarReadyAt=Infinity;
  assert.equal(trySpiritKingSkills(f.room,f.boss,f.player,START,()=>0,map),true);
  assert.equal(trySpiritKingSkills(f.room,f.boss,f.player,START+19999,()=>0,map),false);
  assert.equal(trySpiritKingSkills(f.room,f.boss,f.player,START+20000,()=>0,map),true);
  assert.equal(f.boss.mp,90);
  assert.equal(spiritOrbViews(f.room,f.boss.mapId,START+20000).length,2);
  assert.equal(spiritOrbViews(f.room,f.boss.mapId,START+30000).length,1);
  assert.equal(spiritOrbViews(f.room,f.boss.mapId,START+50000).length,0);
});

test('별 지킴이 MP10으로 성령왕500회복, 20초 쿨타임, 두 번 뒤 마나 소진',()=>{
  const f=fixture();f.boss.orbReadyAt=Infinity;f.tick(START);
  const g=[...f.room.monsters.values()].find(m=>m.summonerId===f.boss.id);
  assert.equal(g.mp,10);assert.equal(g.maxMp,10);
  assert.equal(trySpiritGuardianHeal(f.room,g,START),false,'최대체력에는 낭비하지 않는다');
  f.boss.hp-=1600;const hp=f.boss.hp;
  assert.equal(trySpiritGuardianHeal(f.room,g,START+1),true);assert.equal(g.mp,5);assert.equal(f.boss.hp,hp+500);
  assert.equal(trySpiritGuardianHeal(f.room,g,START+20000),false);
  assert.equal(trySpiritGuardianHeal(f.room,g,START+20001),true);assert.equal(g.mp,0);assert.equal(f.boss.hp,hp+1000);
  assert.equal(trySpiritGuardianHeal(f.room,g,START+40001),false);
});

test('지킴이 회복은 상한·기절·죽음·다른 맵을 지키며 실제 이동 틱에서도 실행된다',()=>{
  const f=fixture();f.boss.orbReadyAt=Infinity;f.boss.blueStarReadyAt=Infinity;f.tick(START);
  const g=[...f.room.monsters.values()].find(m=>m.summonerId===f.boss.id);
  f.room.monsters=new Map([[f.boss.id,f.boss],[g.id,g]]);f.boss.hp-=100;g.stunUntil=START+1000;
  assert.equal(trySpiritGuardianHeal(f.room,g,START+100),false);
  g.stunUntil=0;g.sleepUntil=START+1000;assert.equal(trySpiritGuardianHeal(f.room,g,START+100),false);g.sleepUntil=0;
  g.hp=0;assert.equal(trySpiritGuardianHeal(f.room,g,START+100),false);g.hp=g.maxHp;
  const mapId=g.mapId;g.mapId='plaza';assert.equal(trySpiritGuardianHeal(f.room,g,START+100),false);g.mapId=mapId;
  f.tick(START+100,.99);assert.equal(f.boss.hp,f.boss.maxHp);assert.equal(g.mp,5);
  f.boss.hp=0;assert.equal(trySpiritGuardianHeal(f.room,g,START+30000),false);
});

test('성령의 왕을 처치하면 소환 지킴이와 활성 구체를 함께 정리한다',()=>{
  const f=fixture();f.tick(START);f.tick(START+50);
  assert.ok([...f.room.monsters.values()].some(m=>m.typeId==='star-guardian'));
  assert.equal(f.room.spiritOrbs.length,1);
  damageMonster(f.room,f.boss,f.player,10000,START+100);
  assert.equal([...f.room.monsters.values()].filter(m=>m.typeId==='star-guardian').length,0);
  assert.equal(f.room.spiritOrbs.length,0);
});
