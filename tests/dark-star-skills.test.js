import test from 'node:test';
import assert from 'node:assert/strict';
import {DARK_STAR_SKILLS as RULE,DARK_STAR_COLOR_PAIRS} from '../shared/dark-star-skills.js';
import {DARK_STAR} from '../shared/dark-star.js';
import {mapOf} from '../shared/config.js';
import {onOriginFloor} from '../shared/origin-floor.js';
import {monstersOf,monsterViews,damageMonster,moveMonsters,strikeMonsters,selectMonsterTarget} from '../server/monsters.js';
import {beginDarkStarSkill,aimDarkStar,tickDarkStarSkills,darkStarSkillViews,revealDarkStarCard} from '../server/dark-star-skills.js';
import {ensureVitals} from '../server/vitals.js';
import {castTeacherSkill} from '../server/teacher-skill.js';
import {castWater,resolveWaterHit} from '../server/water-skills.js';
import {combatEnemies} from '../server/sagittarius-skills.js';
import {advanceProjectiles} from '../server/projectiles.js';
const NOW=100000,random=()=>.5;
function fixture(){
  const p={id:'a',role:'student',connected:true,away:false,mapId:DARK_STAR.mapId,x:1500,y:1000,avatar:{level:5,constellationId:'leo'},inventory:[]};
  const room={players:new Map([[p.id,p]]),planets:new Map(),darkStar:{state:'active',monsterId:DARK_STAR.monsterId,respawnAt:null}};
  const boss=monstersOf(room,NOW).get(DARK_STAR.monsterId);room.monsters=new Map([[boss.id,boss]]);
  p.x=boss.x+200;p.y=boss.y;boss.attackers.set(p.id,1);boss.targetId=p.id;
  return {room,boss,p};
}
function player(room,id,changes={}){
  const p={id,role:'student',connected:true,away:false,mapId:DARK_STAR.mapId,x:100,y:100,avatar:{level:1},...changes};room.players.set(id,p);return p;
}
test('basic aim tracks for two seconds, locks a straight shot and starts the next aim immediately',()=>{
 const {room,boss,p}=fixture();boss.mp=0;boss.nextManaRegenAt=NOW+100000;
 moveMonsters(room,NOW,random);assert.equal(boss.pendingAttack,undefined);
 assert.equal(boss.darkStarSkills.aim.endsAt,NOW+2000);assert.equal(boss.darkStarSkills.projectiles.length,0);
 p.x=boss.x;p.y=boss.y+300;moveMonsters(room,NOW+1999,random);assert(boss.darkStarSkills.aim.dy>.99);
 const events=moveMonsters(room,NOW+2000,random),shot=boss.darkStarSkills.projectiles[0];
 assert(events.some(e=>e.skillKind==='dark-star-basic'&&e.attackOnly));assert.equal(shot.dx,0);assert.equal(shot.dy,1);
 assert.equal(boss.darkStarSkills.aim.endsAt,NOW+4000);p.x+=500;
 moveMonsters(room,NOW+2100,random);assert.equal(shot.dx,0);assert.equal(shot.dy,1);
 moveMonsters(room,NOW+4000,random);assert.equal(boss.darkStarSkills.projectiles.length,2);assert.equal(boss.pendingAttack,undefined);
});
test('projectile sweeps between ticks, deals power 30 once, and never adds a melee hit',()=>{
 const {room,boss,p}=fixture();p.avatar={level:1};boss.mp=0;boss.nextManaRegenAt=NOW+100000;
 const hp=ensureVitals(p).hp;moveMonsters(room,NOW,random);moveMonsters(room,NOW+2000,random);
 assert.equal(ensureVitals(p).hp,hp);const hits=moveMonsters(room,NOW+2500,random);
 assert.equal(hits.filter(h=>h.targetId===p.id).length,1);assert.equal(hits.find(h=>h.targetId===p.id).damage,30);
 assert.equal(boss.darkStarSkills.projectiles.length,0);
});
test('rainbow exact mana/cooldown/length/lifetime, one contact per player per path including reconnect',()=>{
 const {room,boss,p}=fixture();
 assert(beginDarkStarSkill(room,boss,'rainbow',NOW,random));assert.equal(boss.mp,95);
 const path=boss.darkStarSkills.paths[0];assert(Math.abs(Math.hypot(path.x2-path.x1,path.y2-path.y1)-365.01)<.01);
 assert(!beginDarkStarSkill(room,boss,'rainbow',NOW+9999,random));assert.equal(boss.mp,95);
 p.x=(path.x1+path.x2)/2;p.y=(path.y1+path.y2)/2;
 assert.equal(tickDarkStarSkills(room,boss,NOW+1).length,1);assert.equal(tickDarkStarSkills(room,boss,NOW+500).length,0);
 p.connected=false;tickDarkStarSkills(room,boss,NOW+600);p.connected=true;p.socketId='new';
 assert.equal(tickDarkStarSkills(room,boss,NOW+700).length,0);
 assert(!beginDarkStarSkill(room,boss,'rainbow',NOW+10000,random));assert.equal(boss.mp,95);
 tickDarkStarSkills(room,boss,NOW+30000);assert.equal(boss.darkStarSkills.paths.length,0);
 assert(beginDarkStarSkill(room,boss,'rainbow',NOW+30000,random));assert.equal(boss.mp,90);
 assert.equal(tickDarkStarSkills(room,boss,NOW+30001).length,1);
 boss.mp=4;assert(!beginDarkStarSkill(room,boss,'rainbow',NOW+40000,random));
});
test('puzzle has five 100-HP gray cards, allowed distinct colors, secret answer and three-second reveal',()=>{
 for(let sample=0;sample<12;sample++){
  const {room,boss,p}=fixture();assert(beginDarkStarSkill(room,boss,'puzzle',NOW,()=>sample/12));assert.equal(boss.mp,80);
  const cards=boss.darkStarSkills.cards;assert.equal(cards.length,5);assert(cards.every(c=>c.hp===100));
  for(const card of cards){
   assert(Math.hypot(card.x-boss.x,card.y-boss.y)>boss.radius+80);
   const padding=boss.radius*1.2+RULE.puzzle.radius+12;
   assert(Math.abs(card.x-boss.x)>padding||Math.abs(card.y-(boss.y-boss.radius*.3-8))>padding);
   assert(onOriginFloor(mapOf(boss.mapId),card.x,card.y,card.radius));
  }
  assert.equal(cards.filter(c=>c.correct).length,1);const colors=[...new Set(cards.map(c=>c.color))];
  assert(DARK_STAR_COLOR_PAIRS.some(pair=>colors.every(color=>pair.includes(color))));
  for(const view of [...darkStarSkillViews(room,boss,NOW).cards,...monsterViews(room,NOW).filter(m=>m.typeId==='dark-star-card')])
    for(const key of ['color','correct','hp','maxHp'])assert(!Object.hasOwn(view,key));
  const card=cards[0];p.x=card.x;p.y=card.y;revealDarkStarCard(room,p,card.id,NOW+1);
  assert.equal(darkStarSkillViews(room,boss,NOW+3000).cards[0].color,card.color);
  assert(!Object.hasOwn(darkStarSkillViews(room,boss,NOW+3001).cards[0],'color'));
  assert(onOriginFloor(mapOf(boss.mapId),card.x,card.y,card.radius));
 }
});
test('wrong card destruction has no penalty; correct card destruction clears puzzle without rewards or HP leaks',()=>{
 const {room,boss,p}=fixture();beginDarkStarSkill(room,boss,'puzzle',NOW,random);
 const wrong=boss.darkStarSkills.cards.find(c=>!c.correct),correct=boss.darkStarSkills.cards.find(c=>c.correct);
 const hp=ensureVitals(p).hp;let hit=damageMonster(room,wrong,p,100,NOW+1);
 assert(hit.defeated);assert(!Object.hasOwn(hit,'hp'));assert.equal(boss.darkStarSkills.cards.length,4);assert.equal(ensureVitals(p).hp,hp);
 hit=damageMonster(room,correct,p,99,NOW+2);assert.equal(hit.defeated,false);assert.equal(correct.hp,1);
 damageMonster(room,correct,p,1,NOW+3);assert.equal(boss.darkStarSkills.cards.length,0);assert.equal(boss.darkStarSkills.puzzleEndsAt,null);
 assert.equal(room.monsters.size,1);assert.equal(room.energyDrops,undefined);
 assert(!beginDarkStarSkill(room,boss,'puzzle',NOW+59999,random));assert(beginDarkStarSkill(room,boss,'puzzle',NOW+60000,random));
});
test('deadline kills every eligible same-map character regardless of level, immunity, shield or revival',()=>{
 const {room,boss,p}=fixture();beginDarkStarSkill(room,boss,'puzzle',NOW,random);
 const low=player(room,'low'),other=player(room,'other',{mapId:'space-plaza'}),ghost=player(room,'ghost',{avatar:{level:1,blackStar:true}}),teacher=player(room,'teacher',{role:'teacher'});
 const fightingTeacher=player(room,'fighting-teacher',{role:'teacher'});boss.teacherRetaliation=new Set([fightingTeacher.id]);
 p.taurusImmuneUntil=NOW+60000;p.herculesShield={hp:999,endsAt:NOW+60000};p.capricornBlessing={endsAt:NOW+60000};
 const correct=boss.darkStarSkills.cards.find(c=>c.correct);assert.equal(damageMonster(room,correct,p,100,NOW+30000),null);
 const hits=tickDarkStarSkills(room,boss,NOW+30000);
 for(const victim of [p,low,fightingTeacher]){assert.equal(ensureVitals(victim).hp,0);assert(hits.some(h=>h.targetId===victim.id&&h.defeated));}
 for(const safe of [other,ghost,teacher])assert(ensureVitals(safe).hp>0);
 assert.equal(room.monsters.size,1);assert.equal(tickDarkStarSkills(room,boss,NOW+30001).length,0);
});
test('card interaction validates authoritative distance, map, life and expiration',()=>{
 const {room,boss,p}=fixture();beginDarkStarSkill(room,boss,'puzzle',NOW,random);const card=boss.darkStarSkills.cards[0];
 p.x=0;p.y=0;assert.throws(()=>revealDarkStarCard(room,p,card.id,NOW));
 p.x=card.x;p.y=card.y;p.mapId='space-plaza';assert.throws(()=>revealDarkStarCard(room,p,card.id,NOW));p.mapId=card.mapId;
 assert.throws(()=>revealDarkStarCard(room,p,card.id,NOW+30000));ensureVitals(p).hp=0;assert.throws(()=>revealDarkStarCard(room,p,card.id,NOW));
});
test('normal melee, teacher E and ranged class Q/E share damageable card targets',()=>{
 for(const mode of ['melee','teacher','q','e']){
  const {room,boss,p}=fixture();beginDarkStarSkill(room,boss,'puzzle',NOW,random);const card=boss.darkStarSkills.cards.find(c=>!c.correct);
  p.x=card.x-120;p.y=card.y;p.facing={x:1,y:0};boss.x=0;boss.y=0;
  for(const other of boss.darkStarSkills.cards)if(other!==card){other.x=5000;other.y=5000;}
  if(mode==='melee'){p.x=card.x-50;strikeMonsters(room,p,10,NOW+1);}
  else if(mode==='teacher'){p.role='teacher';p.x=card.x-90;castTeacherSkill(room,p,NOW+1);}
  else{
   p.avatar={level:5,constellationId:'cancer'};
   if(mode==='e')castWater(room,p,NOW+1);
   castWater(room,p,NOW+2,{basic:true});advanceProjectiles(room,NOW+1000,combatEnemies,resolveWaterHit);
  }
  assert(card.hp<100,mode);
 }
});
test('active combat selects one major skill, waits for its end and alternates when both are ready',()=>{
 const {room,boss,p}=fixture();moveMonsters(room,NOW,()=>0);assert.equal(boss.mp,95);
 assert.equal(boss.darkStarSkills.paths.length,1);assert.equal(boss.darkStarSkills.cards.length,0);
 p.taurusImmuneUntil=NOW+100000;
 moveMonsters(room,NOW+10000,()=>0);assert.equal(boss.darkStarSkills.paths.length,1);assert.equal(boss.darkStarSkills.cards.length,0);
 moveMonsters(room,NOW+29999,()=>0);assert.equal(boss.darkStarSkills.cards.length,0);
 moveMonsters(room,NOW+30000,()=>0);assert.equal(boss.darkStarSkills.paths.length,0);assert.equal(boss.darkStarSkills.cards.length,5);
});
test('each nonlethal 2000 HP threshold queues one sequential three-second absorption, final death never casts',()=>{
 const {room,boss,p}=fixture();damageMonster(room,boss,p,6500,NOW);
 assert.deepEqual(boss.darkStarSkills.absorptionQueue,['red','purple','indigo']);
 tickDarkStarSkills(room,boss,NOW,random);assert.deepEqual(boss.darkStarSkills.absorbedColors,['red']);
 p.x=boss.x+1000;tickDarkStarSkills(room,boss,NOW+3000,random);
 assert.deepEqual(boss.darkStarSkills.absorbedColors,['red','purple']);assert.equal(boss.darkStarSkills.absorption.endsAt,NOW+6000);
 tickDarkStarSkills(room,boss,NOW+6000,random);assert.deepEqual(boss.darkStarSkills.absorbedColors,['red','purple','indigo']);
 damageMonster(room,boss,p,1500,NOW+6001);assert.deepEqual(boss.darkStarSkills.absorptionQueue,['green']);
 damageMonster(room,boss,p,2000,NOW+6002);assert.equal(boss.hp,0);assert.equal(boss.darkStarSkills,null);assert.equal(tickDarkStarSkills(room,boss,NOW+10000).length,0);
});
test('absorption warning freezes boss, cancels aim/casts, kills inside after three seconds and can be escaped',()=>{
 const {room,boss,p}=fixture();boss.mp=100;aimDarkStar(room,boss,p,NOW-1);damageMonster(room,boss,p,2000,NOW);
 const inside=player(room,'inside',{x:boss.x,y:boss.y});inside.taurusImmuneUntil=NOW+99999;
 const outside=player(room,'outside',{x:boss.x+600,y:boss.y});
 const x=boss.x,y=boss.y;moveMonsters(room,NOW,random);assert.equal(boss.x,x);assert.equal(boss.y,y);assert.equal(boss.darkStarSkills.aim,null);assert.equal(boss.mp,100);
 assert.equal(boss.darkStarSkills.absorption.endsAt,NOW+3000);tickDarkStarSkills(room,boss,NOW+2999,random);assert(ensureVitals(inside).hp>0);
 p.x=boss.x+700;const hits=tickDarkStarSkills(room,boss,NOW+3000,random);assert(hits.some(h=>h.targetId==='inside'&&h.defeated));assert(ensureVitals(outside).hp>0);assert(ensureVitals(p).hp>0);
});
test('detached satellite requires continuous one-second proximity and repeats once per second; leaving/reconnect restart dwell',()=>{
 const {room,boss,p}=fixture();damageMonster(room,boss,p,2000,NOW);tickDarkStarSkills(room,boss,NOW,random);
 const s=boss.darkStarSkills.satellites[0];boss.darkStarSkills.absorption=null;
 p.x=s.x;p.y=s.y;tickDarkStarSkills(room,boss,NOW+1);assert.equal(tickDarkStarSkills(room,boss,NOW+1000).length,0);
 assert.equal(tickDarkStarSkills(room,boss,NOW+1001).filter(h=>h.skillKind==='dark-star-satellite').length,1);
 assert.equal(tickDarkStarSkills(room,boss,NOW+2001).length,1);
 p.x+=500;tickDarkStarSkills(room,boss,NOW+2100);p.x=s.x;assert.equal(tickDarkStarSkills(room,boss,NOW+3000).length,0);
 p.socketId='reconnected';assert.equal(tickDarkStarSkills(room,boss,NOW+4000).length,0);assert.equal(tickDarkStarSkills(room,boss,NOW+5000).length,1);
 assert.equal(darkStarSkillViews(room,boss,NOW+99999).satellites.length,1);
});
test('boss death, map change and combat reset remove all effects and card targets',()=>{
 for(const kind of ['death','map','reset']){
  const {room,boss,p}=fixture();beginDarkStarSkill(room,boss,'puzzle',NOW,random);assert.equal(beginDarkStarSkill(room,boss,'rainbow',NOW,random),false);aimDarkStar(room,boss,p,NOW);
  damageMonster(room,boss,p,2000,NOW);assert.equal(boss.darkStarSkills.absorptionQueue.length,1);
  if(kind==='death')damageMonster(room,boss,p,10000,NOW+1);
  if(kind==='map'){boss.mapId='space-plaza';tickDarkStarSkills(room,boss,NOW+1);}
  if(kind==='reset'){p.connected=false;selectMonsterTarget(room,boss);}
  assert.equal(boss.darkStarSkills,null);assert.equal(room.monsters.size,1);assert.equal(darkStarSkillViews(room,boss,NOW+1),null);
 }
});


test('천칭의 살아 있는 영역은 퍼즐 실패와 흡수 즉사도 막고 종료 시에는 막지 않는다',()=>{
  for(const kind of ['puzzle','absorption'])for(const active of [true,false]){
    const {room,boss,p}=fixture();p.avatar.constellationId='libra';
    if(kind==='puzzle')beginDarkStarSkill(room,boss,'puzzle',NOW,random);
    else {damageMonster(room,boss,p,2000,NOW);tickDarkStarSkills(room,boss,NOW,random);p.x=boss.x;p.y=boss.y;}
    const at=NOW+(kind==='puzzle'?30000:3000),hp=ensureVitals(p).hp;
    p.libraAura={endsAt:at+(active?1:0),mapId:p.mapId,size:0,radius:300};
    const hits=tickDarkStarSkills(room,boss,at,random),hit=hits.find(h=>h.targetId===p.id);
    assert.ok(hit);assert.equal(hit.defeated,!active);assert.equal(ensureVitals(p).hp,active?hp:0);
    if(kind==='puzzle')assert.equal(boss.darkStarSkills.cards.length,0);
  }
});


test('direct casts cannot overlap majors; selection respects mana and cooldown without spending on failure',()=>{
 for(const kind of ['rainbow','puzzle']){
  const {room,boss}=fixture();assert(beginDarkStarSkill(room,boss,kind,NOW,random));const mp=boss.mp;
  for(const other of ['rainbow','puzzle'])assert.equal(beginDarkStarSkill(room,boss,other,NOW+1,random),false);
  assert.equal(boss.mp,mp);
 }
 for(const mana of [4,5,19,20]){
  const {room,boss}=fixture();boss.mp=mana;boss.nextManaRegenAt=NOW+100000;
  moveMonsters(room,NOW,()=>.99);const state=boss.darkStarSkills;
  assert.equal(state.paths.length,mana>=5&&mana<20?1:0);assert.equal(state.cards.length,mana>=20?5:0);
  assert.equal(boss.mp,mana-(mana>=20?20:mana>=5?5:0));
 }
 const {room,boss,p}=fixture();beginDarkStarSkill(room,boss,'puzzle',NOW,random);
 damageMonster(room,boss.darkStarSkills.cards.find(c=>c.correct),p,100,NOW+1);
 assert(!beginDarkStarSkill(room,boss,'puzzle',NOW+59999,random));
 assert(beginDarkStarSkill(room,boss,'puzzle',NOW+60000,random));
});

test('queued absorptions wait for rainbow end, then run alone in order before any new major; basic aim continues while queued',()=>{
 const {room,boss,p}=fixture();p.taurusImmuneUntil=NOW+100000;
 moveMonsters(room,NOW,()=>0);damageMonster(room,boss,p,4500,NOW+1);
 const state=boss.darkStarSkills;assert.deepEqual(state.absorptionQueue,['red','purple']);
 assert.ok(state.aim);moveMonsters(room,NOW+2000,()=>0);
 assert.equal(state.absorption,null);assert.ok(state.projectiles.length);assert.equal(state.paths.length,1);
 moveMonsters(room,NOW+29999,()=>0);assert.equal(state.absorption,null);
 // Stay outside the instant-defeat radius while retaining the boss target.
 p.x=boss.x+700;p.y=boss.y;
 moveMonsters(room,NOW+30000,()=>0);assert.equal(state.paths.length,0);assert.equal(state.cards.length,0);
 assert.equal(state.absorption.color,'red');assert.equal(state.aim,null);
 const mp=boss.mp;assert(!beginDarkStarSkill(room,boss,'puzzle',NOW+30001,random));assert.equal(boss.mp,mp);
 moveMonsters(room,NOW+32999,()=>0);assert.equal(state.absorption.color,'red');
 moveMonsters(room,NOW+33000,()=>0);assert.equal(state.absorption.color,'purple');assert.equal(state.cards.length,0);
 moveMonsters(room,NOW+36000,()=>0);assert.equal(state.absorption,null);assert.equal(state.satellites.length,2);
 assert.equal(state.cards.length,5);assert.equal(state.paths.length,0);
});

test('puzzle completion and failure release queued absorption only after cards clear',()=>{
 for(const success of [true,false]){
  const {room,boss,p}=fixture();p.avatar.constellationId='libra';p.libraAura={endsAt:NOW+100000,mapId:p.mapId,size:0,radius:300};
  beginDarkStarSkill(room,boss,'puzzle',NOW,random);damageMonster(room,boss,p,2000,NOW+1);
  tickDarkStarSkills(room,boss,NOW+2,random);assert.equal(boss.darkStarSkills.absorption,null);
  const at=success?NOW+3:NOW+30000;
  if(success)damageMonster(room,boss.darkStarSkills.cards.find(c=>c.correct),p,100,at);
  tickDarkStarSkills(room,boss,at,random);
  assert.equal(boss.darkStarSkills.cards.length,0);assert.equal(boss.darkStarSkills.puzzleEndsAt,null);
  assert.equal(boss.darkStarSkills.absorption.startsAt,at);assert.equal(boss.darkStarSkills.absorption.endsAt,at+3000);
 }
});
