import test from 'node:test';
import assert from 'node:assert/strict';
import {SPIRIT_BLUE_STAR} from '../shared/boss-skills.js';
import {defensePowerOf} from '../shared/combat.js';
import {mapOf} from '../shared/config.js';
import {onParadiseFloor} from '../shared/paradise-floor.js';
import {monsterType} from '../shared/monsters.js';
import {ensureVitals} from '../server/vitals.js';
import {monstersOf} from '../server/monsters.js';
import {clearSpiritKingEffects,trySpiritKingSkills} from '../server/spirit-king-skills.js';
import {disarmSpiritBlueStar,spiritBlueStarPositions,spiritBlueStarViews,tickSpiritBlueStars} from '../server/spirit-blue-stars.js';

const START=1000;
function fixture(){
  const room={players:new Map(),planets:new Map()};
  const boss=monstersOf(room,START,()=>0).get('spirit-king-boss');
  room.monsters=new Map([[boss.id,boss]]);
  boss.summonReadyAt=Infinity;boss.orbReadyAt=Infinity;boss.blueStarDecisionAt=START;
  const map=mapOf(boss.mapId);
  const player=(id,level=2,constellationId='aries',role='student')=>({id,role,connected:true,away:false,mapId:boss.mapId,
    x:boss.x,y:boss.y,avatar:{level,constellationId},equipmentSlots:[],inventory:[]});
  return {room,boss,map,player};
}

test('blue star summon makes five separated floor-safe points and charges MP/cooldown only after success',()=>{
  const f=fixture();
  assert.equal(trySpiritKingSkills(f.room,f.boss,{x:0,y:0},START,()=>0,f.map),true);
  const stars=f.room.spiritBlueStars;
  assert.equal(stars.length,SPIRIT_BLUE_STAR.count);assert.equal(f.boss.mp,90);
  assert.equal(f.boss.blueStarReadyAt,START+SPIRIT_BLUE_STAR.cooldownMs);
  assert.equal(new Set(stars.map(star=>star.id)).size,5);
  assert.ok(stars.every(star=>star.bossId===f.boss.id&&star.mapId===f.boss.mapId&&star.endsAt===START+SPIRIT_BLUE_STAR.durationMs));
  assert.ok(stars.every(star=>onParadiseFloor(f.map,star.x,star.y,star.radius)));
  assert.ok(stars.every((star,i)=>stars.slice(i+1).every(other=>Math.hypot(star.x-other.x,star.y-other.y)>=SPIRIT_BLUE_STAR.minSeparation)));
  assert.equal(spiritBlueStarViews(f.room,f.boss.mapId,START).length,5);
  for(const star of stars){
    assert.ok(Math.hypot(star.x-f.map.spawn.x,star.y-f.map.spawn.y)>=190+star.radius);
    for(const object of f.map.objects.filter(o=>o.kind==='gate'||!o.passable))
      assert.ok(Math.hypot(star.x-object.x,star.y-object.y)>=star.radius+(object.radius||0)+42);
  }
});

test('impossible floor placement leaves MP and skill cooldown untouched',()=>{
  const f=fixture(),tiny={id:'other',width:100,height:100,spawn:{x:50,y:50},objects:[]};
  const before=f.boss.mp;
  assert.equal(trySpiritKingSkills(f.room,f.boss,{x:0,y:0},START,()=>0,tiny),false);
  assert.equal(f.boss.mp,before);assert.equal(f.boss.blueStarReadyAt,0);
  assert.equal(f.room.spiritBlueStars?.length||0,0);
});

test('insufficient boss mana leaves MP and skill cooldown untouched',()=>{
  const f=fixture();f.boss.mp=SPIRIT_BLUE_STAR.mana-1;
  assert.equal(trySpiritKingSkills(f.room,f.boss,{x:0,y:0},START,()=>0,f.map),false);
  assert.equal(f.boss.mp,SPIRIT_BLUE_STAR.mana-1);assert.equal(f.boss.blueStarReadyAt,0);
  assert.equal(f.room.spiritBlueStars?.length||0,0);
});

test('at exact expiry each star hits same-map students including distant students; normal defense mitigates each blast, teachers and LV1 are excluded',()=>{
  const f=fixture(),positions=spiritBlueStarPositions(f.map,()=>0);
  f.room.spiritBlueStars=positions.map((point,index)=>({id:'star-'+index,bossId:f.boss.id,mapId:f.boss.mapId,...point,
    radius:SPIRIT_BLUE_STAR.radius,startsAt:START,endsAt:START+SPIRIT_BLUE_STAR.durationMs,power:(f.boss.power||30)*SPIRIT_BLUE_STAR.damageMultiplier}));
  const hitPoint=positions[0];
  const hero=f.player('hero',4,'taurus');Object.assign(hero,{x:hitPoint.x,y:hitPoint.y});f.room.players.set(hero.id,hero);
  const otherHeroes=positions.slice(1).map((point,index)=>{const p=f.player('other-'+index,4,'taurus');Object.assign(p,{x:point.x,y:point.y});f.room.players.set(p.id,p);return p;});
  const low=f.player('low',1,null);Object.assign(low,{x:hitPoint.x,y:hitPoint.y});f.room.players.set(low.id,low);
  const teacher=f.player('teacher',5,null,'teacher');Object.assign(teacher,{x:hitPoint.x,y:hitPoint.y});f.room.players.set(teacher.id,teacher);
  const far=f.player('far',2,'aries');Object.assign(far,{x:hitPoint.x+1000,y:hitPoint.y});f.room.players.set(far.id,far);
  const hp=ensureVitals(hero).hp,lowHp=ensureVitals(low).hp,teacherHp=ensureVitals(teacher).hp,farHp=ensureVitals(far).hp;
  const otherHp=otherHeroes.map(player=>ensureVitals(player).hp);
  const expectedDamage=Math.max(1,60-defensePowerOf(hero.avatar.level,hero.avatar.constellationId,hero));
  const hits=tickSpiritBlueStars(f.room,START+SPIRIT_BLUE_STAR.durationMs,mapId=>mapOf(mapId));
  assert.equal(hits.length,11);
  const directHits=hits.filter(hit=>hit.targetId!=='far');
  assert.ok(directHits.every(hit=>hit.damage===expectedDamage));
  assert.ok(ensureVitals(hero).hp<hp);
  for(let i=0;i<otherHeroes.length;i++)assert.ok(ensureVitals(otherHeroes[i]).hp<otherHp[i]);
  assert.equal(ensureVitals(low).hp,lowHp);assert.equal(ensureVitals(teacher).hp,teacherHp);
  assert.ok(hits.some(hit=>hit.targetId==='far'));
  assert.equal(f.room.spiritBlueStars.length,0);assert.equal(spiritBlueStarViews(f.room,f.boss.mapId,START+20000).length,0);
});

test('nearby joined players can disarm once; far, expired, black-star, and wrong-map requests fail',()=>{
  const f=fixture(),star={id:'blue-1',bossId:f.boss.id,mapId:f.boss.mapId,x:600,y:500,radius:SPIRIT_BLUE_STAR.radius,startsAt:START,endsAt:START+20000,power:60};
  f.room.spiritBlueStars=[star];
  const hero=f.player('hero');Object.assign(hero,{x:star.x+80,y:star.y});f.room.players.set(hero.id,hero);
  assert.match(disarmSpiritBlueStar(f.room,hero,star.id,START).message,/해체/);
  assert.equal(f.room.spiritBlueStars.length,0);
  assert.throws(()=>disarmSpiritBlueStar(f.room,hero,star.id,START),/사라졌/);
  for(const mutate of [p=>p.x+=500,p=>p.away=true,p=>p.avatar.blackStar=true,p=>p.mapId='space-plaza']){
    const next={...star,id:'blue-'+Math.random()};f.room.spiritBlueStars=[next];const p=f.player('test');p.x=star.x+80;p.y=star.y;mutate(p);
    assert.throws(()=>disarmSpiritBlueStar(f.room,p,next.id,START));
  }
  f.room.spiritBlueStars=[star];hero.x=star.x+80;hero.y=star.y;
  assert.throws(()=>disarmSpiritBlueStar(f.room,hero,star.id,star.endsAt));
  f.room.spiritBlueStars=[star];ensureVitals(hero).hp=0;
  assert.throws(()=>disarmSpiritBlueStar(f.room,hero,star.id,START));
});

test('dead or map-mismatched boss clears all remaining blue stars',()=>{
  const f=fixture();f.room.spiritBlueStars=[{id:'a',bossId:f.boss.id,mapId:f.boss.mapId,endsAt:START+20000},{id:'b',bossId:f.boss.id,mapId:f.boss.mapId,endsAt:START+20000}];
  f.boss.mapId='space-plaza';
  tickSpiritBlueStars(f.room,START+100,mapId=>mapOf(mapId));assert.equal(f.room.spiritBlueStars.length,0);
  f.boss.mapId='star-paradise';f.room.spiritBlueStars=[{id:'a',bossId:f.boss.id,mapId:f.boss.mapId,endsAt:START+20000}];
  f.boss.hp=0;tickSpiritBlueStars(f.room,START+100,mapId=>mapOf(mapId));assert.equal(f.room.spiritBlueStars.length,0);
});

test('a reflected blast that defeats the boss prevents later stars from detonating',()=>{
  const f=fixture(),positions=spiritBlueStarPositions(f.map,()=>0);
  f.room.spiritBlueStars=positions.map((point,index)=>({id:'reflect-'+index,bossId:f.boss.id,mapId:f.boss.mapId,...point,
    radius:SPIRIT_BLUE_STAR.radius,startsAt:START,endsAt:START+20000,power:60}));
  const reflector=f.player('reflector',3,'libra');Object.assign(reflector,{x:positions[0].x,y:positions[0].y,
    libraAura:{endsAt:START+30000,mapId:f.boss.mapId,radius:100,skillDamageFactor:1}});
  const later=f.player('later',4,'taurus');Object.assign(later,{x:positions[1].x,y:positions[1].y});
  f.room.players.set(reflector.id,reflector);f.room.players.set(later.id,later);f.boss.hp=1;
  const laterHp=ensureVitals(later).hp;
  tickSpiritBlueStars(f.room,START+20000,mapId=>mapOf(mapId));
  assert.equal(f.boss.hp,0);assert.equal(ensureVitals(later).hp,laterHp);
  assert.equal(f.room.spiritBlueStars.length,0);
});

test('boss defeat cleanup removes blue stars alongside guardians and orbs',()=>{
  const f=fixture();f.room.spiritBlueStars=[{id:'a',bossId:f.boss.id,mapId:f.boss.mapId}];f.room.spiritOrbs=[{id:'orb',bossId:f.boss.id}];
  clearSpiritKingEffects(f.room,f.boss.id);
  assert.equal(f.room.spiritBlueStars.length,0);assert.equal(f.room.spiritOrbs.length,0);
});

test('Spirit King skill specification is 10 MP, one minute cooldown, five stars, twenty seconds',()=>{
  assert.deepEqual([SPIRIT_BLUE_STAR.mana,SPIRIT_BLUE_STAR.cooldownMs,SPIRIT_BLUE_STAR.count,SPIRIT_BLUE_STAR.durationMs,SPIRIT_BLUE_STAR.damageMultiplier],[10,60000,5,20000,2]);
});
