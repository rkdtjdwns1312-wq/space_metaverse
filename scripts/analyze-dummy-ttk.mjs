// Offline combat benchmark. Never connects to or edits a classroom.
// Uses real cast/tick/damage/recovery code with a controlled 50ms clock.
// E is used as soon as legal; this is a fixed policy, not a global optimum.
import {writeFileSync} from 'node:fs';
import {startTransformation,expireTransformation} from '../server/transformation.js';
import {CONSTELLATIONS} from '../shared/constellations.js';
import {attackPowerOf} from '../shared/combat.js';
import assert from 'node:assert/strict';
import {monstersOf,damageMonster} from '../server/monsters.js';
import {ensureVitals,playerVitals} from '../server/vitals.js';
import {advancePassiveRecovery} from '../server/passive-recovery.js';
import {advanceProjectiles} from '../server/projectiles.js';
import {combatEnemies,damageTargets,attackSagittarius,castSagittarius} from '../server/sagittarius-skills.js';
import {resolveWaterHit} from '../server/water-skills.js';
import {corvusSkillOf} from '../shared/character-skills.js';
const mapping={gemini:'Gemini',corvus:'Corvus',aquarius:'Aquarius',capricorn:'Capricorn',taurus:'Taurus',hercules:'Hercules',libra:'Libra',cetus:'Water',leo:'Leo',ophiuchus:'Ophiuchus',sagittarius:'Sagittarius','corona-borealis':'Corona',cancer:'Water',cygnus:'Swan',aries:'Aries',pisces:'Water'};
const modules={},specs={};
for(const [id,name] of Object.entries(mapping)){modules[id]=await import(`../server/${name.toLowerCase()}-skills.js`);specs[id]=id==='corvus'?corvusSkillOf:(await import(`../shared/${name.toLowerCase()}-skills.js`))[name.toLowerCase()+'SkillOf'];}
const epoch=1794283200000,realNow=Date.now;let clock=epoch;Date.now=()=>clock;
function rng(seed){return()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};}
function run(id,level,withSkill,seed=1,transform=false){
 clock=epoch;const name=mapping[id],mod=modules[id],spec=specs[id];
 const p={id:'sim',role:'student',connected:true,mapId:'star-origin-1',x:500,y:500,facing:{x:1,y:0},avatar:{level,constellationId:id},equipmentSlots:[],inventory:[],input:{x:0,y:0,at:0}};
 const room={players:new Map([[p.id,p]]),planets:new Map()};const monster=[...monstersOf(room,clock,()=>0).values()][0];
 Object.assign(monster,{id:'dummy',typeId:'ttk-dummy',level:1,mapId:p.mapId,x:570,y:500,hp:10000,maxHp:10000,radius:24,summonerId:'sim',nextAttackAt:Infinity});room.monsters=new Map([[monster.id,monster]]);
 ensureVitals(p);advancePassiveRecovery(room,clock);const initialVitals=playerVitals(p),power=attackPowerOf(level,id,p,clock),random=rng(seed);let nextQ=epoch,nextE=epoch,q=0,e=0,spent=0,transforms=0;
 assert.equal(damageMonster(room,monster,p,power,clock).damage,power,'dummy defense must be zero');monster.hp=10000;monster.contributors.clear();monster.attackers.clear();
 const tick=()=>{
  if(id==='taurus')mod.advanceTaurusDashes(room,clock);
  if(id==='libra')mod.advanceLibraAuras(room,clock);
  if(id==='hercules'){mod.advanceHerculesSlams(room,clock);mod.advanceHerculesShields(room,clock);}
  if(id==='corona-borealis')mod.advanceCorona(room,clock);
  if(id==='capricorn')mod.advanceCapricorn(room,clock);
  if(id==='leo'){mod.advanceLeoRoars(room,clock);mod.advanceLeoCourage(room,clock);}
  expireTransformation(p,clock);
  advanceProjectiles(room,clock,combatEnemies,['cancer','cetus','pisces'].includes(id)?resolveWaterHit:damageTargets);
  if(id==='aquarius')mod.advanceAquarius(room,clock);
  if(['cancer','cetus','pisces'].includes(id))mod.advanceWaterAuras(room,clock);
  if(id==='cygnus')mod.advanceSwanAuras(room,clock);
  if(id==='ophiuchus'){mod.advanceOphiuchusVenoms(room,clock);mod.advanceOphiuchusPoison(room,clock);}
  if(id==='aries')mod.advanceAriesClouds(room,clock);
  advancePassiveRecovery(room,clock);
 };
 for(let elapsed=0;elapsed<=7200000;elapsed+=50){
  clock=epoch+elapsed;tick();if(monster.hp<=0)return {seconds:elapsed/1000,power,q,e,spent,transforms,initialVitals,mp:ensureVitals(p).mp,seed};
  if(transform&&!p.transformation?.active&&clock>=(p.transformation?.cooldownUntil||0)){startTransformation(p,clock);transforms++;}
  if(id==='cygnus')nextE=mod.swanCooldowns(p,clock)[0];
  if(id==='taurus'&&p.taurusDash)nextE=Math.max(nextE,p.taurusDash.endsAt);
  if(withSkill&&clock>=nextE&&ensureVitals(p).mp>=spec(p).mana){
   if(id==='cygnus'&&p.swanAura?.remainingAttacks>0&&p.swanAura.endsAt>clock)nextE=clock+50;
   else{
    const before=ensureVitals(p).mp,result=id==='sagittarius'?castSagittarius(room,p,0,clock):mod['cast'+name](room,p,clock);e++;spent+=before-ensureVitals(p).mp;
    nextE=result.cooldowns?.[0]||clock+spec(p).cooldownMs;
    if(id==='taurus')p.input={x:0,y:0,at:clock+1};
   }
  }
  if(clock>=nextQ){if(id==='sagittarius')attackSagittarius(room,p,clock,random);else mod['cast'+name](room,p,clock,{basic:true});q++;nextQ=clock+1000;}
  if(monster.hp<=0)return {seconds:elapsed/1000,power,q,e,spent,transforms,initialVitals,mp:ensureVitals(p).mp,seed};
 }
 throw Error('Timeout '+id+' '+level+' '+withSkill+' hp '+monster.hp+' casts '+e);
}
const results=[];
try{
 for(const c of CONSTELLATIONS)for(const level of [2,3,4,5])for(const withSkill of [false,true]){
  const trials=Array.from({length:c.id==='sagittarius'?20:1},(_,i)=>run(c.id,level,withSkill,20261110+i));
  const seconds=trials.map(t=>t.seconds),row={id:c.id,name:c.name,level,mode:withSkill?'Q+E':'Q',mean:seconds.reduce((a,b)=>a+b)/seconds.length,min:Math.min(...seconds),max:Math.max(...seconds),trials};results.push(row);
  console.log(c.id,level,row.mode,row.mean.toFixed(2),row.min,row.max,'E',trials[0].e);
  writeFileSync('.local/dummy-ttk-10000.json',JSON.stringify(results,null,2));
 }
 for(const c of CONSTELLATIONS){
  const trials=Array.from({length:c.id==='sagittarius'?20:1},(_,i)=>run(c.id,5,true,20261110+i,true));
  const seconds=trials.map(t=>t.seconds),row={id:c.id,name:c.name,level:5,mode:'Q+E+transform',mean:seconds.reduce((a,b)=>a+b)/seconds.length,min:Math.min(...seconds),max:Math.max(...seconds),trials};results.push(row);
  console.log(c.id,5,row.mode,row.mean.toFixed(2),'transforms',trials[0].transforms);
  writeFileSync('.local/dummy-ttk-10000.json',JSON.stringify(results,null,2));
 }
}finally{Date.now=realNow;}
for(const row of results.filter(r=>r.mode==='Q'&&r.id!=='sagittarius')){
 assert.equal(row.trials[0].q,Math.ceil(10000/row.trials[0].power));
 assert(Math.abs(row.mean-(Math.ceil(10000/row.trials[0].power)-1))<=.15);
}
assert.equal(results.length,144);
console.log('PASS 144 conditions / 315 runs; 60 deterministic Q formulas agree; zero defense checked per run');
writeFileSync('.local/dummy-ttk-10000.csv','constellation,level,mode,mean_seconds,min_seconds,max_seconds,trials\n'+results.map(r=>[r.name,r.level,r.mode,r.mean.toFixed(2),r.min,r.max,r.trials.length].join(',')).join('\n'));
