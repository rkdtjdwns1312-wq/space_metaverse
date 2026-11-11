import {FORGOTTEN_CONSTELLATION,dormantForgottenConstellation} from '../shared/forgotten-constellation.js';
import {DARK_STAR,dormantDarkStar} from '../shared/dark-star.js';
import {TRUTH_CREATOR,dormantTruthCreator} from '../shared/truth-creator.js';
import {STAR_RECORD,dormantStarRecord} from '../shared/star-record.js';
import {SERENA,dormantSerena} from '../shared/serena.js';
import {addRecipeDrop,addEnergyDrop,addBossDrops} from './energy-drops.js';
import {recordBossVictory} from './serena-progress.js';
import {clearDarkStarSkills} from './dark-star-skills.js';
import {clearTruthCreatorAttack} from './truth-creator-attack.js';
const DAY_MS=24*60*60*1000,HOUR_MS=60*60*1000,KST_OFFSET_MS=9*60*60*1000;
// 2026-11-01 한국 시간 하루 동안만 보스 재등장을 1시간으로 단축합니다.
const EVENT_START=Date.parse('2026-10-31T15:00:00Z'),EVENT_END=Date.parse('2026-11-01T15:00:00Z');
const duringEvent=now=>now>=EVENT_START&&now<EVENT_END;
const validTime=time=>Number.isSafeInteger(time)&&time>=0&&time<=8640000000000000;
// 기존 death+24h 저장값도 해당 한국 날짜의 오전 7시로 맞춥니다.
const openingOnDate=time=>Math.max(0,Math.floor((time+KST_OFFSET_MS)/DAY_MS)*DAY_MS-KST_OFFSET_MS+7*60*60*1000);
// 이벤트 중 저장한 1시간 타이머는 재시작해도 07시로 바꾸지 않습니다.
const restoredRespawnAt=time=>time>=EVENT_START+HOUR_MS&&time<EVENT_END+HOUR_MS?time:openingOnDate(time);
// 잠든 별 1~4는 소환/처치 뒤 처음 오는 한국 시간 07시에 석상으로 돌아갑니다.
export function nextSleepingBossResetAt(now){
  if(!validTime(now)||now>8640000000000000-DAY_MS)throw new Error('석상 복원 시각이 올바르지 않습니다.');
  const opening=openingOnDate(now);
  return opening>now?opening:openingOnDate(now+DAY_MS);
}
const SLEEPING_BOSSES=[['darkStar',DARK_STAR,dormantDarkStar],['starRecord',STAR_RECORD,dormantStarRecord],
  ['forgottenConstellation',FORGOTTEN_CONSTELLATION,dormantForgottenConstellation],['truthCreator',TRUTH_CREATOR,dormantTruthCreator]];
const respawnAtForType=(typeId,now)=>!duringEvent(now)&&SLEEPING_BOSSES.some(([,spec])=>spec.typeId===typeId)
  ?nextSleepingBossResetAt(now):nextBossRespawnAt(now);
function savedResetAt(value){
  if(value.resetAt===undefined)return {};
  if(value.state!=='active'||!validTime(value.resetAt)||openingOnDate(value.resetAt)!==value.resetAt)
    throw new Error('석상 복원 시각 저장 데이터가 올바르지 않습니다.');
  return {resetAt:value.resetAt};
}
export const needsSleepingBossReset=(room,now)=>SLEEPING_BOSSES.some(([key])=>
  room[key]?.state==='active'&&room[key].resetAt!==undefined&&now>=room[key].resetAt||
  room[key]?.state==='recovering'&&now>=room[key].respawnAt);
function restoreSleepingBoss(room,key,spec,dormant,now){
  const state=room[key];
  if(!state||state.state==='dormant')return false;
  const due=state.state==='active'?state.resetAt:state.respawnAt;
  // 미정산 처치는 기존 트랜잭션에서 먼저 확정해야 보상과 처치 이력이 유실되지 않습니다.
  if(due===undefined||now<due||room.pendingBossDeaths?.has(spec.monsterId))return false;
  const monster=room.monsters?.get(spec.monsterId);
  if(monster){
    if(key==='darkStar')clearDarkStarSkills(room,monster);
    if(key==='truthCreator')clearTruthCreatorAttack(monster,room);
  }
  for(const [id,child] of room.monsters||[])if(child.summonerId===spec.monsterId||child.bossId===spec.monsterId)room.monsters.delete(id);
  for(const [id,cloud] of room.ariesClouds||[])if(cloud.monsterId===spec.monsterId)room.ariesClouds.delete(id);
  room[key]=dormant();room.monsters?.delete(spec.monsterId);
  if(room.bossRespawns)delete room.bossRespawns[spec.monsterId];
  return true;
}
export function restoreSleepingBossStatues(room,now){
  let changed=false;
  for(const [key,spec,dormant] of SLEEPING_BOSSES)changed=restoreSleepingBoss(room,key,spec,dormant,now)||changed;
  return changed;
}
export function restoreSavedSleepingBosses(room,now){
  // 구버전 active에는 소환 시각이 없습니다. 최초 로딩의 다음 07시를 부여해 새벽 재시작을 보존합니다.
  for(const [key] of SLEEPING_BOSSES)if(room[key]?.state==='active'&&room[key].resetAt===undefined)
    room[key].resetAt=nextSleepingBossResetAt(now);
  restoreSleepingBossStatues(room,now);
}
export function nextBossRespawnAt(deathAt){
  if(!validTime(deathAt)||deathAt>8640000000000000-DAY_MS)throw new Error('보스 처치 시각이 올바르지 않습니다.');
  return duringEvent(deathAt)?deathAt+HOUR_MS:openingOnDate(deathAt+DAY_MS);
}
const BOSS_IDS=['noksera-boss','leoon-boss','spirit-king-boss','serena-boss',DARK_STAR.monsterId,STAR_RECORD.monsterId,FORGOTTEN_CONSTELLATION.monsterId,TRUTH_CREATOR.monsterId];
export function validateBossRespawns(value={}){
  if(!value||typeof value!=='object'||Array.isArray(value)||Object.entries(value).some(([id,time])=>!BOSS_IDS.includes(id)||!validTime(time)))
    throw new Error('보스 복원 시각 저장 데이터가 올바르지 않습니다.');
  return Object.fromEntries(Object.entries(value).map(([id,time])=>[id,restoredRespawnAt(time)]));
}
export function validateSerenaState(value){
  if(value===undefined)return dormantSerena();
  if(!value||!['dormant','active','recovering'].includes(value.state)||
    (value.state==='recovering'?!validTime(value.respawnAt):value.respawnAt!==null)||
    value.monsterId!==(value.state==='active'?SERENA.monsterId:null))throw new Error('세레나 상태 저장 데이터가 올바르지 않습니다.');
  return {state:value.state,respawnAt:value.state==='recovering'?restoredRespawnAt(value.respawnAt):null,monsterId:value.monsterId};
}
export const serenaView=room=>validateSerenaState(room.serena);
export const monsterRespawnMs=(type,now=Date.now())=>type?.boss?respawnAtForType(type.id,now)-now:type?.level===4?20000:type?.level===3?15000:10000;
// 이미 처치되어 내일 아침을 기다리던 보스도 배포 후 한 번만 1시간 이내로 당깁니다.
export function needsTemporaryBossRespawnShortening(room,now){
  if(!duringEvent(now))return false;
  const latest=now+HOUR_MS;
  return BOSS_IDS.some(id=>room.bossRespawns?.[id]>latest)||
    [room.serena,room.darkStar,room.starRecord,room.forgottenConstellation,room.truthCreator].some(state=>state?.state==='recovering'&&state.respawnAt>latest);
}
export function shortenTemporaryBossRespawns(room,now){
  if(!needsTemporaryBossRespawnShortening(room,now))return false;
  const due=now+HOUR_MS;
  for(const id of BOSS_IDS){
    if(room.bossRespawns?.[id]>due){room.bossRespawns[id]=due;const monster=room.monsters?.get(id);if(monster?.hp===0)monster.respawnAt=due;}
  }
  for(const [key,id] of [['serena',SERENA.monsterId],['darkStar',DARK_STAR.monsterId],['starRecord',STAR_RECORD.monsterId],['forgottenConstellation',FORGOTTEN_CONSTELLATION.monsterId],['truthCreator',TRUTH_CREATOR.monsterId]]){
    const state=room[key];if(state?.state!=='recovering'||state.respawnAt<=due)continue;
    state.respawnAt=due;room.bossRespawns??={};room.bossRespawns[id]=due;
    const monster=room.monsters?.get(id);if(monster?.hp===0)monster.respawnAt=due;
  }
  return true;
}
export function finishBossDefeat(room,monster,contributors,deathAt,rolls={},credits,settledAt=deathAt){
  room.bossRespawns??={};
  const respawnAt=respawnAtForType(monster.typeId,deathAt);
  room.bossRespawns[monster.id]=respawnAt;
  recordBossVictory(room,monster,contributors,credits);
  if(monster.typeId===DARK_STAR.typeId)room.darkStar={state:'recovering',respawnAt,monsterId:null};
  if(monster.typeId===FORGOTTEN_CONSTELLATION.typeId)room.forgottenConstellation={state:'recovering',respawnAt,monsterId:null};
  if(monster.typeId===TRUTH_CREATOR.typeId)room.truthCreator={state:'recovering',respawnAt,monsterId:null};
  if(monster.typeId===STAR_RECORD.typeId)room.starRecord={state:'recovering',respawnAt,monsterId:null};
  if(monster.typeId===SERENA.typeId)room.serena={state:'recovering',respawnAt,monsterId:null};
  // 잠든 별은 처음 오는 07시, 나머지 보스는 다음 날07시(과거 이벤트는1시간). 보상 유효기간은 저장 정산부터 셉니다.
  addRecipeDrop(room,monster,contributors,settledAt,rolls.recipeRoll);
  addEnergyDrop(room,monster,contributors,settledAt,rolls.energyRoll);
  addBossDrops(room,monster,contributors,settledAt,rolls.bossRoll);
  // 저장 트랜잭션에 포함되지만 디스크에는 기록하지 않는 일회성 알림입니다.
  room.bossDialogueEvents??=[];
  room.bossDialogueEvents.push({id:`${monster.id}:${deathAt}`,bossId:monster.typeId,mapId:monster.mapId});
}
// 영구 교실에서는 저장 성공 전까지 보상을 공개하지 않습니다. 실패 롤백 뒤 큐로 재시도합니다.
export function settleBossDeaths(room,now=Date.now()){
  for(const [id,death] of room.pendingBossDeaths||[]){
    const monster=room.monsters?.get(id);if(!monster)throw new Error('처치한 보스를 찾을 수 없습니다.');
    finishBossDefeat(room,monster,new Map(death.contributors),death.at,{},death.credits,now);
    room.pendingBossDeaths.delete(id);
  }
}
export function restoreSerenaStatue(room,now){
  if(room.serena?.state!=='recovering'||now<room.serena.respawnAt)return false;
  room.serena=dormantSerena();room.monsters?.delete(SERENA.monsterId);return true;
}

export function validateDarkStarState(value){
  if(value===undefined)return dormantDarkStar();
  if(!value||!['dormant','active','recovering'].includes(value.state)||
    (value.state==='recovering'?!validTime(value.respawnAt):value.respawnAt!==null)||
    value.monsterId!==(value.state==='active'?DARK_STAR.monsterId:null))throw new Error('태초의 검은별 상태 저장 데이터가 올바르지 않습니다.');
  return {state:value.state,respawnAt:value.state==='recovering'?restoredRespawnAt(value.respawnAt):null,monsterId:value.monsterId,...savedResetAt(value)};
}
export const darkStarView=room=>validateDarkStarState(room.darkStar);
export function restoreDarkStarStatue(room,now){
  return restoreSleepingBoss(room,'darkStar',DARK_STAR,dormantDarkStar,now);
}
export function validateStarRecordState(value){
  if(value===undefined)return dormantStarRecord();
  if(!value||!['dormant','active','recovering'].includes(value.state)||
    (value.state==='recovering'?!validTime(value.respawnAt):value.respawnAt!==null)||
    value.monsterId!==(value.state==='active'?STAR_RECORD.monsterId:null))throw new Error('별 기록의 근원 상태 저장 데이터가 올바르지 않습니다.');
  return {state:value.state,respawnAt:value.state==='recovering'?restoredRespawnAt(value.respawnAt):null,monsterId:value.monsterId,...savedResetAt(value)};
}
export const starRecordView=room=>validateStarRecordState(room.starRecord);
export function restoreStarRecordStatue(room,now){
  return restoreSleepingBoss(room,'starRecord',STAR_RECORD,dormantStarRecord,now);
}

export function validateForgottenConstellationState(value){
  if(value===undefined)return dormantForgottenConstellation();
  if(!value||!['dormant','active','recovering'].includes(value.state)||
    (value.state==='recovering'?!validTime(value.respawnAt):value.respawnAt!==null)||
    value.monsterId!==(value.state==='active'?FORGOTTEN_CONSTELLATION.monsterId:null))throw new Error('별자리의 기원 상태 저장 데이터가 올바르지 않습니다.');
  return {state:value.state,respawnAt:value.state==='recovering'?restoredRespawnAt(value.respawnAt):null,monsterId:value.monsterId,...savedResetAt(value)};
}
export const forgottenConstellationView=room=>validateForgottenConstellationState(room.forgottenConstellation);
export function restoreForgottenConstellationStatue(room,now){
  return restoreSleepingBoss(room,'forgottenConstellation',FORGOTTEN_CONSTELLATION,dormantForgottenConstellation,now);
}

export function validateTruthCreatorState(value){
  if(value===undefined)return dormantTruthCreator();
  if(!value||!['dormant','active','recovering'].includes(value.state)||
    (value.state==='recovering'?!validTime(value.respawnAt):value.respawnAt!==null)||
    value.monsterId!==(value.state==='active'?TRUTH_CREATOR.monsterId:null))throw new Error('진리의 창조자 상태 저장 데이터가 올바르지 않습니다.');
  return {state:value.state,respawnAt:value.state==='recovering'?restoredRespawnAt(value.respawnAt):null,monsterId:value.monsterId,...savedResetAt(value)};
}
export const truthCreatorView=room=>validateTruthCreatorState(room.truthCreator);
export function restoreTruthCreatorStatue(room,now){
  return restoreSleepingBoss(room,'truthCreator',TRUTH_CREATOR,dormantTruthCreator,now);
}
