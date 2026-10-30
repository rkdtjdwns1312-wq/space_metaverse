import test from 'node:test';
import assert from 'node:assert/strict';
import {castHercules,advanceHerculesSlams,advanceHerculesShields} from '../server/hercules-skills.js';
import {HERCULES_SLAM,herculesSkillOf} from '../shared/hercules-skills.js';
import {characterAbilities} from '../shared/character-skills.js';
import {attackPowerOf} from '../shared/combat.js';
import {monstersOf} from '../server/monsters.js';
import {ensureVitals} from '../server/vitals.js';
const NOW=100000;
function fixture(level=4){
 const p={id:'p',role:'student',connected:true,away:false,mapId:'star-origin-1',x:600,y:600,facing:{x:1,y:0},avatar:{level,constellationId:'hercules'},equipmentSlots:[]};
 const room={players:new Map([[p.id,p]]),planets:new Map()};
 const monster=monstersOf(room,NOW).get('star-crab');room.monsters=new Map([[monster.id,monster]]);
 Object.assign(monster,{hp:10000,maxHp:10000,x:600,y:600});return {room,p,monster};
}
function attack(f,now=NOW+15000){castHercules(f.room,f.p,NOW);advanceHerculesShields(f.room,NOW+5000);return castHercules(f.room,f.p,now);}
test('successful E alternates shield/attack/shield; Q, cooldown and mana failure never advance',()=>{
 const f=fixture(),{room,p}=f,mp=ensureVitals(p).mp;
 assert.match(characterAbilities(p)[1].name,/수호/);
 castHercules(room,p,NOW);assert.equal(p.herculesNextStance,'attack');assert.equal(ensureVitals(p).mp,mp-5);
 assert.match(characterAbilities(p)[1].description,/1600%/);assert.match(characterAbilities(p)[1].iconUrl,/slam-club/);
 assert.throws(()=>castHercules(room,p,NOW+14999));assert.equal(p.herculesNextStance,'attack');
 castHercules(room,p,NOW+1,{basic:true});assert.equal(p.herculesNextStance,'attack');
 ensureVitals(p).mp=4;assert.throws(()=>castHercules(room,p,NOW+15000));assert.equal(p.herculesNextStance,'attack');
 ensureVitals(p).mp=20;const result=castHercules(room,p,NOW+15000);assert.equal(result.hit.kind,'hercules-slam');assert.equal(p.herculesNextStance,'shield');assert.equal(ensureVitals(p).mp,15);
 castHercules(room,p,NOW+30000);assert.equal(p.herculesNextStance,'attack');assert.ok(p.herculesShield);
});
test('all levels deal 1600% once at 450ms, snapshot facing and origin, no player damage',()=>{
 for(const level of [2,3,4,5])for(const angle of [0,Math.PI/2,Math.PI,Math.PI*1.5,Math.PI/4]){
  const f=fixture(level),{room,p,monster}=f;monster.x=9000;
  p.facing={x:Math.cos(angle)*3,y:Math.sin(angle)*3};const {hit}=attack(f);
  monster.x=hit.x+hit.dx*hit.reach;monster.y=hit.y+hit.dy*hit.reach;
  const ally={...p,id:'ally',avatar:{...p.avatar},x:monster.x,y:monster.y,battleVitals:undefined,herculesSlam:null};room.players.set(ally.id,ally);const hp=ensureVitals(ally).hp;
  const expected=attackPowerOf(level,'hercules',p)*16;p.x=4000;p.y=4000;p.facing={x:-hit.dx,y:-hit.dy};
  assert.deepEqual(advanceHerculesSlams(room,NOW+15449),[]);assert.equal(monster.hp,10000);
  assert.equal(advanceHerculesSlams(room,NOW+15450)[0].targets[0].damage,expected);assert.equal(ensureVitals(ally).hp,hp);
  assert.deepEqual(advanceHerculesSlams(room,NOW+15451),[]);assert.equal(monster.hp,10000-expected);
 }
});
test('slam cancels on death/disconnect/away/map/constellation/black-star and excludes outside/map/dead monsters',()=>{
 for(const change of [p=>p.connected=false,p=>p.away=true,p=>p.mapId='space-plaza',p=>p.avatar.constellationId='leo',p=>p.avatar.blackStar=true,p=>ensureVitals(p).hp=0]){
  const f=fixture();f.monster.x=9000;attack(f);change(f.p);assert.deepEqual(advanceHerculesSlams(f.room,NOW+15450),[]);assert.equal(f.p.herculesSlam,null);
 }
 for(const mode of ['behind','othermap','dead']){
  const f=fixture();f.monster.x=9000;const {hit}=attack(f);Object.assign(f.monster,{x:hit.x+hit.dx*hit.reach,y:hit.y+hit.dy*hit.reach});
  if(mode==='behind')f.monster.x=hit.x-hit.radius-100;
  if(mode==='othermap')f.monster.mapId='space-plaza';if(mode==='dead')f.monster.hp=0;
  assert.equal(advanceHerculesSlams(f.room,NOW+15450)[0].targets.length,0);
 }
});
test('slam snapshots attack and skill equipment, keeps 450ms windup and equipment-adjusted cooldown',()=>{
 const f=fixture();f.monster.x=9000;f.p.herculesNextStance='attack';f.p.equipmentSlots=['star-pattern-gloves','moon-earring','meteor-boots'];
 const power=attackPowerOf(4,'hercules',f.p),{hit}=castHercules(f.room,f.p,NOW);f.p.equipmentSlots=[];f.p.statGrowth={bonuses:{attack:50}};
 Object.assign(f.monster,{x:hit.x+hit.dx*hit.reach,y:hit.y+hit.dy*hit.reach});
 assert.equal(advanceHerculesSlams(f.room,NOW+450)[0].targets[0].damage,Math.round(power*16*1.2));
 assert.equal(hit.impactMs,HERCULES_SLAM.impactMs);assert.equal(f.p.herculesCooldownUntil,NOW+9000);
});
