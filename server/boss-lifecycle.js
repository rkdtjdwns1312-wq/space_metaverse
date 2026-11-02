import {DARK_STAR,dormantDarkStar} from '../shared/dark-star.js';
import {TRUTH_CREATOR,dormantTruthCreator} from '../shared/truth-creator.js';
import {STAR_RECORD,dormantStarRecord} from '../shared/star-record.js';
import {SERENA,dormantSerena} from '../shared/serena.js';
import {addRecipeDrop,addEnergyDrop,addBossDrops} from './energy-drops.js';
import {recordBossVictory} from './serena-progress.js';
const DAY_MS=24*60*60*1000,HOUR_MS=60*60*1000,KST_OFFSET_MS=9*60*60*1000;
// 2026-11-01 한국 시간 하루 동안만 보스 재등장을 1시간으로 단축합니다.
const EVENT_START=Date.parse('2026-10-31T15:00:00Z'),EVENT_END=Date.parse('2026-11-01T15:00:00Z');
const duringEvent=now=>now>=EVENT_START&&now<EVENT_END;
const validTime=time=>Number.isSafeInteger(time)&&time>=0&&time<=8640000000000000;
// 기존 death+24h 저장값도 해당 한국 날짜의 오전 7시로 맞춥니다.
const openingOnDate=time=>Math.max(0,Math.floor((time+KST_OFFSET_MS)/DAY_MS)*DAY_MS-KST_OFFSET_MS+7*60*60*1000);
// 이벤트 중 저장한 1시간 타이머는 재시작해도 07시로 바꾸지 않습니다.
const restoredRespawnAt=time=>time>=EVENT_START+HOUR_MS&&time<EVENT_END+HOUR_MS?time:openingOnDate(time);
export function nextBossRespawnAt(deathAt){
  if(!validTime(deathAt)||deathAt>8640000000000000-DAY_MS)throw new Error('보스 처치 시각이 올바르지 않습니다.');
  return duringEvent(deathAt)?deathAt+HOUR_MS:openingOnDate(deathAt+DAY_MS);
}
const BOSS_IDS=['noksera-boss','leoon-boss','spirit-king-boss','serena-boss',DARK_STAR.monsterId,STAR_RECORD.monsterId,TRUTH_CREATOR.monsterId];
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
export const monsterRespawnMs=(type,now=Date.now())=>type?.boss?nextBossRespawnAt(now)-now:type?.level===4?20000:type?.level===3?15000:10000;
// 이미 처치되어 내일 아침을 기다리던 보스도 배포 후 한 번만 1시간 이내로 당깁니다.
export function needsTemporaryBossRespawnShortening(room,now){
  if(!duringEvent(now))return false;
  const latest=now+HOUR_MS;
  return BOSS_IDS.some(id=>room.bossRespawns?.[id]>latest)||
    [room.serena,room.darkStar,room.starRecord,room.truthCreator].some(state=>state?.state==='recovering'&&state.respawnAt>latest);
}
export function shortenTemporaryBossRespawns(room,now){
  if(!needsTemporaryBossRespawnShortening(room,now))return false;
  const due=now+HOUR_MS;
  for(const id of BOSS_IDS){
    if(room.bossRespawns?.[id]>due){room.bossRespawns[id]=due;const monster=room.monsters?.get(id);if(monster?.hp===0)monster.respawnAt=due;}
  }
  for(const [key,id] of [['serena',SERENA.monsterId],['darkStar',DARK_STAR.monsterId],['starRecord',STAR_RECORD.monsterId],['truthCreator',TRUTH_CREATOR.monsterId]]){
    const state=room[key];if(state?.state!=='recovering'||state.respawnAt<=due)continue;
    state.respawnAt=due;room.bossRespawns??={};room.bossRespawns[id]=due;
    const monster=room.monsters?.get(id);if(monster?.hp===0)monster.respawnAt=due;
  }
  return true;
}
export function finishBossDefeat(room,monster,contributors,deathAt,rolls={},credits,settledAt=deathAt){
  room.bossRespawns??={};
  const respawnAt=nextBossRespawnAt(deathAt);
  room.bossRespawns[monster.id]=respawnAt;
  recordBossVictory(room,monster,contributors,credits);
  if(monster.typeId===DARK_STAR.typeId)room.darkStar={state:'recovering',respawnAt,monsterId:null};
  if(monster.typeId===TRUTH_CREATOR.typeId)room.truthCreator={state:'recovering',respawnAt,monsterId:null};
  if(monster.typeId===STAR_RECORD.typeId)room.starRecord={state:'recovering',respawnAt,monsterId:null};
  if(monster.typeId===SERENA.typeId)room.serena={state:'recovering',respawnAt,monsterId:null};
  // 평소에는 다음 날 07시, 이벤트 날에는 1시간 뒤 복원합니다. 보상 시간은 저장 정산 시점부터 셉니다.
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
  return {state:value.state,respawnAt:value.state==='recovering'?restoredRespawnAt(value.respawnAt):null,monsterId:value.monsterId};
}
export const darkStarView=room=>validateDarkStarState(room.darkStar);
export function restoreDarkStarStatue(room,now){
  if(room.darkStar?.state!=='recovering'||now<room.darkStar.respawnAt)return false;
  room.darkStar=dormantDarkStar();room.monsters?.delete(DARK_STAR.monsterId);return true;
}
export function validateStarRecordState(value){
  if(value===undefined)return dormantStarRecord();
  if(!value||!['dormant','active','recovering'].includes(value.state)||
    (value.state==='recovering'?!validTime(value.respawnAt):value.respawnAt!==null)||
    value.monsterId!==(value.state==='active'?STAR_RECORD.monsterId:null))throw new Error('별 기록의 근원 상태 저장 데이터가 올바르지 않습니다.');
  return {state:value.state,respawnAt:value.state==='recovering'?restoredRespawnAt(value.respawnAt):null,monsterId:value.monsterId};
}
export const starRecordView=room=>validateStarRecordState(room.starRecord);
export function restoreStarRecordStatue(room,now){
  if(room.starRecord?.state!=='recovering'||now<room.starRecord.respawnAt)return false;
  room.starRecord=dormantStarRecord();room.monsters?.delete(STAR_RECORD.monsterId);return true;
}

export function validateTruthCreatorState(value){
  if(value===undefined)return dormantTruthCreator();
  if(!value||!['dormant','active','recovering'].includes(value.state)||
    (value.state==='recovering'?!validTime(value.respawnAt):value.respawnAt!==null)||
    value.monsterId!==(value.state==='active'?TRUTH_CREATOR.monsterId:null))throw new Error('진리의 창조자 상태 저장 데이터가 올바르지 않습니다.');
  return {state:value.state,respawnAt:value.state==='recovering'?restoredRespawnAt(value.respawnAt):null,monsterId:value.monsterId};
}
export const truthCreatorView=room=>validateTruthCreatorState(room.truthCreator);
export function restoreTruthCreatorStatue(room,now){
  if(room.truthCreator?.state!=='recovering'||now<room.truthCreator.respawnAt)return false;
  room.truthCreator=dormantTruthCreator();room.monsters?.delete(TRUTH_CREATOR.monsterId);return true;
}
