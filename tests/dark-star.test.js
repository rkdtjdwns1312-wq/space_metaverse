import test from 'node:test';
import assert from 'node:assert/strict';
import {DARK_STAR,darkStarMap} from '../shared/dark-star.js';
import {mapOf} from '../shared/config.js';
import {monsterType} from '../shared/monsters.js';
import {monstersOf,monsterViews,damageMonster,moveMonsters} from '../server/monsters.js';
import {summonDarkStar} from '../server/dark-star.js';
import {darkStarView,restoreDarkStarStatue,nextBossRespawnAt,validateDarkStarState,validateBossRespawns} from '../server/boss-lifecycle.js';
import {chargeHuntingStation} from '../server/hunting-time.js';
import {ensureVitals} from '../server/vitals.js';
import {onOriginFloor} from '../shared/origin-floor.js';
import {isFree} from '../server/world.js';
const now=Date.parse('2026-10-29T12:00:00+09:00'),statue=mapOf(DARK_STAR.mapId).objects.find(o=>o.id===DARK_STAR.statueId);
function fixture(){
 const player={id:'a',role:'student',connected:true,away:false,mapId:DARK_STAR.mapId,x:statue.x,y:statue.y+90,avatar:{level:1},inventory:[],equipmentSlots:[null,null,null]};
 chargeHuntingStation(player,'math',now);
 return {player,room:{players:new Map([['a',player]]),planets:new Map()}};
}
test('manual statue summon validates proximity, connection, life and hunting time, without a level gate',()=>{
 for(const change of [{mapId:'space-plaza'},{x:0,y:0},{connected:false},{away:true},{huntingTime:undefined,huntingTimer:undefined}]){
  const {room,player}=fixture();Object.assign(player,change);assert.throws(()=>summonDarkStar(room,player,now));assert.equal(room.darkStar,undefined);
 }
 const dead=fixture();ensureVitals(dead.player).hp=0;assert.throws(()=>summonDarkStar(dead.room,dead.player,now));
 for(const change of [{},{role:'teacher',huntingTime:undefined},{accountKind:'master',huntingTime:undefined}]){
  const {room,player}=fixture();Object.assign(player,change);assert(!monstersOf(room,now).has(DARK_STAR.monsterId));
  assert.equal(summonDarkStar(room,player,now).darkStar.state,'active');assert.throws(()=>summonDarkStar(room,player,now));
  const boss=room.monsters.get(DARK_STAR.monsterId);assert.deepEqual([boss.hp,boss.maxMp,boss.radius,boss.x,boss.y],[10000,100,150,statue.x,statue.y]);
  assert.equal([...room.monsters.values()].filter(m=>m.typeId===DARK_STAR.typeId).length,1);
 }
});
test('statue collision follows state, and defeat returns only the statue next day at 07:00',()=>{
 const {room,player}=fixture();assert.equal(isFree(room,statue.x,statue.y,player.id,DARK_STAR.mapId,false,player,true),false);
 summonDarkStar(room,player,now);assert.equal(isFree(room,statue.x,statue.y,player.id,DARK_STAR.mapId,false,player,true),true);
 assert.equal(darkStarMap(mapOf(DARK_STAR.mapId),room.darkStar).objects.some(o=>o.id===DARK_STAR.statueId),false);
 const boss=room.monsters.get(DARK_STAR.monsterId);damageMonster(room,boss,player,10000,now,{energyRoll:()=>1500});
 assert.equal(room.darkStar.state,'recovering');assert.equal([...room.energyDrops.values()].filter(d=>!d.kind)[0].total,1500);
 assert.equal([...room.energyDrops.values()].filter(d=>d.itemId==='black-gem').length,1);
 assert.equal([...room.energyDrops.values()].filter(d=>d.itemId==='gold-big-bang-card').length,1);
 assert([1,2].includes([...room.energyDrops.values()].filter(d=>d.itemId==='exploration-ticket').length));
 const until=nextBossRespawnAt(now);assert.equal(room.darkStar.respawnAt,until);assert.equal(restoreDarkStarStatue(room,until-1),false);
 moveMonsters(room,until,()=>0);assert.equal(boss.hp,0);assert.equal(restoreDarkStarStatue(room,until),true);
 assert.equal(monstersOf(room,until).has(DARK_STAR.monsterId),false);chargeHuntingStation(player,'math',until);assert.equal(summonDarkStar(room,player,until).darkStar.state,'active');
});
test('basic combat matches Spirit King stats and warning, with no boss special skill',()=>{
 const {room,player}=fixture();summonDarkStar(room,player,now);const boss=room.monsters.get(DARK_STAR.monsterId);room.monsters=new Map([[boss.id,boss]]);
 assert.deepEqual(monsterType('dark-star').combat,monsterType('spirit-king').combat);
 player.x=boss.x+boss.radius+20;player.y=boss.y;boss.attackers.set(player.id,1);boss.targetId=player.id;
 moveMonsters(room,now,()=>0);const warning=monsterViews(room,now)[0].warning;assert.equal(warning.endsAt-now,2000);
 player.x+=500;const hits=moveMonsters(room,now+2000,()=>0);assert(hits.some(h=>h.attackOnly&&h.warningRadius===90));
 assert.equal(room.spiritOrbs?.size||0,0);assert.equal(room.monsters.size,1);assert.equal(boss.serenaSkill,undefined);
});
test('dark star state validation and cooldown remain independent of Serena',()=>{
 assert.equal(darkStarView({}).state,'dormant');
 for(const value of [{state:'active',monsterId:'serena-boss',respawnAt:null},{state:'recovering',monsterId:null,respawnAt:-1},{state:'dormant',monsterId:null,respawnAt:1}])assert.throws(()=>validateDarkStarState(value));
 const time=nextBossRespawnAt(now);assert.equal(validateBossRespawns({[DARK_STAR.monsterId]:time})[DARK_STAR.monsterId],time);
 const {room,player}=fixture();const serena={state:'active',monsterId:'serena-boss',respawnAt:null};room.serena=serena;summonDarkStar(room,player,now);assert.equal(room.serena,serena);
});

test('basic warning deals power 30 only after two seconds and patrol stays on the sleeping-star floor',()=>{
 const {room,player}=fixture();summonDarkStar(room,player,now);const boss=room.monsters.get(DARK_STAR.monsterId);room.monsters=new Map([[boss.id,boss]]);
 player.x=boss.x+boss.radius+20;player.y=boss.y;boss.attackers.set(player.id,1);boss.targetId=player.id;
 const hp=ensureVitals(player).hp;moveMonsters(room,now,()=>0);assert.equal(moveMonsters(room,now+1999,()=>0).length,0);assert.equal(ensureVitals(player).hp,hp);
 const hits=moveMonsters(room,now+2000,()=>0);assert(hits.some(h=>h.targetId===player.id&&h.damage===30));assert.equal(ensureVitals(player).hp,Math.max(0,hp-30));
 for(const angle of [0,Math.PI/4,Math.PI/2,Math.PI,Math.PI*1.25,Math.PI*1.5]){
  const f=fixture();summonDarkStar(f.room,f.player,now);const m=f.room.monsters.get(DARK_STAR.monsterId);f.room.monsters=new Map([[m.id,m]]);m.patrolStartedAt=now;m.lastMoveAt=now;
  for(let tick=now+100;tick<now+60000;tick+=100){moveMonsters(f.room,tick,()=>angle/(Math.PI*2));assert(onOriginFloor(mapOf(DARK_STAR.mapId),m.x,m.y,m.radius));}
 }
});
