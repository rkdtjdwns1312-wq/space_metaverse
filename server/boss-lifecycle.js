import {SERENA,dormantSerena} from '../shared/serena.js';
import {addRecipeDrop,addEnergyDrop,addBossDrops} from './energy-drops.js';
import {recordBossVictory} from './serena-progress.js';
const DAY_MS=24*60*60*1000,KST_OFFSET_MS=9*60*60*1000;
const validTime=time=>Number.isSafeInteger(time)&&time>=0&&time<=8640000000000000;
// 기존 death+24h 저장값도 해당 한국 날짜의 오전 7시로 맞춥니다.
const openingOnDate=time=>Math.max(0,Math.floor((time+KST_OFFSET_MS)/DAY_MS)*DAY_MS-KST_OFFSET_MS+7*60*60*1000);
export function nextBossRespawnAt(deathAt){
  if(!validTime(deathAt)||deathAt>8640000000000000-DAY_MS)throw new Error('보스 처치 시각이 올바르지 않습니다.');
  return openingOnDate(deathAt+DAY_MS);
}
const BOSS_IDS=['noksera-boss','leoon-boss','spirit-king-boss','serena-boss'];
export function validateBossRespawns(value={}){
  if(!value||typeof value!=='object'||Array.isArray(value)||Object.entries(value).some(([id,time])=>!BOSS_IDS.includes(id)||!validTime(time)))
    throw new Error('보스 복원 시각 저장 데이터가 올바르지 않습니다.');
  return Object.fromEntries(Object.entries(value).map(([id,time])=>[id,openingOnDate(time)]));
}
export function validateSerenaState(value){
  if(value===undefined)return dormantSerena();
  if(!value||!['dormant','active','recovering'].includes(value.state)||
    (value.state==='recovering'?!validTime(value.respawnAt):value.respawnAt!==null)||
    value.monsterId!==(value.state==='active'?SERENA.monsterId:null))throw new Error('세레나 상태 저장 데이터가 올바르지 않습니다.');
  return {state:value.state,respawnAt:value.state==='recovering'?openingOnDate(value.respawnAt):null,monsterId:value.monsterId};
}
export const serenaView=room=>validateSerenaState(room.serena);
export const monsterRespawnMs=(type,now=Date.now())=>type?.boss?nextBossRespawnAt(now)-now:type?.level===4?20000:type?.level===3?15000:10000;
export function finishBossDefeat(room,monster,contributors,deathAt,rolls={},credits,settledAt=deathAt){
  room.bossRespawns??={};
  const respawnAt=nextBossRespawnAt(deathAt);
  room.bossRespawns[monster.id]=respawnAt;
  recordBossVictory(room,monster,contributors,credits);
  if(monster.typeId===SERENA.typeId)room.serena={state:'recovering',respawnAt,monsterId:null};
  // 리젠은 처치 다음 날 07시, 바닥 보상의 공개/만료는 저장 정산 시점부터 셉니다.
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
