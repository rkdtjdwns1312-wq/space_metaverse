import test from 'node:test';
import assert from 'node:assert/strict';
import {TRUTH_CREATOR,TRUTH_CREATOR_REQUIRED_BOSSES,truthCreatorEligible,truthCreatorMap} from '../shared/truth-creator.js';
import {mapOf} from '../shared/config.js';
import {monsterType} from '../shared/monsters.js';
import {summonTruthCreator,requireTruthCreatorEntry} from '../server/truth-creator.js';
import {monstersOf,damageMonster,moveMonsters,monsterViews} from '../server/monsters.js';
import {truthCreatorView,restoreTruthCreatorStatue,nextBossRespawnAt,validateTruthCreatorState} from '../server/boss-lifecycle.js';
import {recordBossVictory,validateSerenaProgress} from '../server/serena-progress.js';
import {chargeHuntingStation} from '../server/hunting-time.js';
import {ensureVitals} from '../server/vitals.js';
import {isFree} from '../server/world.js';
import {requestSummon,respondSummon} from '../server/social.js';
const now=Date.parse('2026-11-02T12:00:00+09:00'),statue=mapOf(TRUTH_CREATOR.mapId).objects.find(o=>o.id===TRUTH_CREATOR.statueId);
function fixture(){
  const player={id:'a',role:'student',connected:true,away:false,mapId:TRUTH_CREATOR.mapId,x:statue.x,y:statue.y+90,
    avatar:{level:1},inventory:[],equipmentSlots:[null,null,null],serenaProgress:{highestLevel:1,bossKills:[...TRUTH_CREATOR_REQUIRED_BOSSES]}};
  chargeHuntingStation(player,'math',now);
  return {player,room:{players:new Map([['a',player]]),planets:new Map(),unattended:true}};
}
test('all six previous bosses require actual contributions; old two records remain and items do not qualify',()=>{
  assert.equal(TRUTH_CREATOR_REQUIRED_BOSSES.length,6);assert(!TRUTH_CREATOR_REQUIRED_BOSSES.includes('truth-creator'));
  const {room,player}=fixture();player.serenaProgress={highestLevel:1,bossKills:['leoon','noksera']};
  player.inventory=[{id:'black-gem',quantity:1},{id:'spirit-king-soul',quantity:1},{id:'radiant-star-origin',quantity:1},{id:'origin-star-record',quantity:1}];
  assert.equal(truthCreatorEligible(player),false);
  assert.deepEqual(validateSerenaProgress(player.serenaProgress,player.avatar).bossKills,['leoon','noksera']);
  for(const id of ['party','offline','other','zero'])room.players.set(id,{...player,id,serenaProgress:{highestLevel:1,bossKills:[]},connected:id!=='offline',mapId:id==='other'?'space-plaza':player.mapId});
  const damage=new Map([['a',1],['offline',2],['other',2],['zero',0]]);
  for(const typeId of TRUTH_CREATOR_REQUIRED_BOSSES)recordBossVictory(room,{typeId,mapId:player.mapId},damage);
  assert.equal(truthCreatorEligible(player),true);
  for(const id of ['party','offline','other','zero'])assert.deepEqual(room.players.get(id).serenaProgress.bossKills,[]);
});
test('only the third-map gate enters the fourth map, including teacher route restrictions and summon rechecks',()=>{
  const {room,player}=fixture();player.mapId='sleeping-stars-3';
  assert.throws(()=>requireTruthCreatorEntry(player,TRUTH_CREATOR.mapId),/3의 문/);
  assert.doesNotThrow(()=>requireTruthCreatorEntry(player,TRUTH_CREATOR.mapId,{gate:true}));
  for(const missing of TRUTH_CREATOR_REQUIRED_BOSSES){player.serenaProgress.bossKills=TRUTH_CREATOR_REQUIRED_BOSSES.filter(id=>id!==missing);
    assert.throws(()=>requireTruthCreatorEntry(player,TRUTH_CREATOR.mapId,{gate:true}),{message:'모든 보스 처치 기록이 있어야 입장 가능합니다.'});}
  player.role='teacher';assert.doesNotThrow(()=>requireTruthCreatorEntry(player,TRUTH_CREATOR.mapId,{gate:true}));
  assert.throws(()=>requireTruthCreatorEntry(player,TRUTH_CREATOR.mapId),/3의 문/);
  player.role='student';player.mapId=TRUTH_CREATOR.mapId;
  assert.throws(()=>summonTruthCreator(room,player,now),/모든 보스 처치 기록/);
});
test('summon validates presence, life and hunting time, then Lv7 50000HP 40attack uses hidden three-second aim',()=>{
  for(const change of [{mapId:'space-plaza'},{x:0,y:0},{connected:false},{away:true},{huntingTime:undefined,huntingTimer:undefined}]){
    const {room,player}=fixture();Object.assign(player,change);assert.throws(()=>summonTruthCreator(room,player,now));assert.equal(room.truthCreator,undefined);
  }
  const f=fixture();ensureVitals(f.player).hp=0;assert.throws(()=>summonTruthCreator(f.room,f.player,now));
  const {room,player}=fixture();assert.equal(truthCreatorView(room).state,'dormant');
  assert.equal(isFree(room,statue.x,statue.y,player.id,player.mapId,false,player,true),false);
  summonTruthCreator(room,player,now);assert.throws(()=>summonTruthCreator(room,player,now));
  assert.equal(isFree(room,statue.x,statue.y,player.id,player.mapId,false,player,true),true);
  assert(!truthCreatorMap(mapOf(player.mapId),room.truthCreator).objects.some(o=>o.id===statue.id));
  const boss=room.monsters.get(TRUTH_CREATOR.monsterId),type=monsterType(boss.typeId);
  assert.deepEqual([type.level,boss.maxHp,type.power,type.defense,boss.radius],[7,50000,40,0,150]);
  room.monsters=new Map([[boss.id,boss]]);boss.mp=0;boss.nextManaRegenAt=now+100000;player.x=boss.x+boss.radius+20;player.y=boss.y;boss.attackers.set(player.id,1);
  moveMonsters(room,now,()=>0);assert.equal(monsterViews(room,now)[0].warning,undefined);
  assert.equal(monsterViews(room,now)[0].truthCreatorEffects.aim,undefined);
  assert.equal(moveMonsters(room,now+2999,()=>0).length,0);
  assert(moveMonsters(room,now+3000,()=>0).some(hit=>hit.attackOnly));
  assert(moveMonsters(room,now+3500,()=>0).some(hit=>hit.damage===40));
  assert.equal(boss.serenaSkill,undefined);assert.equal(boss.darkStarSkills,undefined);assert.equal(boss.recordChallenge,undefined);
});
test('defeat grants baseline rewards without another boss material and restores only the statue next day',()=>{
  const {room,player}=fixture();summonTruthCreator(room,player,now);const boss=room.monsters.get(TRUTH_CREATOR.monsterId);
  damageMonster(room,boss,player,50000,now,{energyRoll:()=>1500});const drops=[...room.energyDrops.values()];
  assert.equal(drops.find(d=>!d.kind).total,1500);assert(drops.some(d=>d.itemId==='gold-big-bang-card'));
  assert(drops.filter(d=>d.kind).every(d=>['gold-big-bang-card','exploration-ticket'].includes(d.itemId)));
  const due=nextBossRespawnAt(now);assert.equal(room.truthCreator.respawnAt,due);
  assert.equal(restoreTruthCreatorStatue(room,due-1),false);moveMonsters(room,due,()=>0);assert.equal(boss.hp,0);
  assert.equal(restoreTruthCreatorStatue(room,due),true);assert(!monstersOf(room,due).has(boss.id));
  assert.equal(validateTruthCreatorState(undefined).state,'dormant');
  for(const value of [{state:'active',respawnAt:null,monsterId:'star-record-boss'},{state:'recovering',respawnAt:-1,monsterId:null}])assert.throws(()=>validateTruthCreatorState(value));
});
test('friend summons cannot bypass the gate, including a host moving after an invitation',()=>{
  const {room,player}=fixture(),friend={...player,id:'friend',nickname:'친구',mapId:'sleeping-stars-3'};room.players.set(friend.id,friend);
  assert.throws(()=>requestSummon(room,player,friend.id,now),/3의 문/);
  player.mapId='sleeping-stars-3';const invitation=requestSummon(room,player,friend.id,now);
  player.mapId=TRUTH_CREATOR.mapId;assert.throws(()=>respondSummon(room,friend,invitation.id,true,now+1),/3의 문/);
  assert.equal(friend.mapId,'sleeping-stars-3');
});
