import {SERENA,dormantSerena} from '../shared/serena.js';
import {addRecipeDrop,addEnergyDrop,addBossDrops} from './energy-drops.js';
import {recordBossVictory} from './serena-progress.js';
export const BOSS_RESPAWN_MS=24*60*60*1000;
const BOSS_IDS=['noksera-boss','leoon-boss','spirit-king-boss','serena-boss'];
export function validateBossRespawns(value={}){
  if(!value||typeof value!=='object'||Array.isArray(value)||Object.entries(value).some(([id,time])=>!BOSS_IDS.includes(id)||!Number.isSafeInteger(time)||time<0))
    throw new Error('보스 복원 시각 저장 데이터가 올바르지 않습니다.');
  return {...value};
}
export function validateSerenaState(value){
  if(value===undefined)return dormantSerena();
  if(!value||!['dormant','active','recovering'].includes(value.state)||
    (value.state==='recovering'?(!Number.isSafeInteger(value.respawnAt)||value.respawnAt<0):value.respawnAt!==null)||
    value.monsterId!==(value.state==='active'?SERENA.monsterId:null))throw new Error('세레나 상태 저장 데이터가 올바르지 않습니다.');
  return {state:value.state,respawnAt:value.respawnAt,monsterId:value.monsterId};
}
export const serenaView=room=>validateSerenaState(room.serena);
export const monsterRespawnMs=type=>type?.boss?BOSS_RESPAWN_MS:type?.level===4?20000:type?.level===3?15000:10000;
export function finishBossDefeat(room,monster,contributors,deathAt,rolls={},credits,settledAt=deathAt){
  room.bossRespawns??={};
  room.bossRespawns[monster.id]=deathAt+BOSS_RESPAWN_MS;
  recordBossVictory(room,monster,contributors,credits);
  if(monster.typeId===SERENA.typeId)room.serena={state:'recovering',respawnAt:deathAt+BOSS_RESPAWN_MS,monsterId:null};
  // 리젠은 처치 순간부터, 바닥 보상의 공개/만료는 저장 정산 시점부터 셉니다.
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
