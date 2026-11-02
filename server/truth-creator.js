import {TRUTH_CREATOR,truthCreatorEligible,TRUTH_CREATOR_ENTRY_MESSAGE,TRUTH_CREATOR_GATE_MESSAGE} from '../shared/truth-creator.js';
import {mapOf,interactionDistance,interactionReach} from '../shared/config.js';
import {ensure} from './rooms.js';
import {isDefeated} from './vitals.js';
import {monstersOf} from './monsters.js';
import {requireHuntingEntry} from './hunting-time.js';
import {truthCreatorView,restoreTruthCreatorStatue} from './boss-lifecycle.js';

export function requireTruthCreatorEntry(player,to,{gate=false}={}){
  if(to!==TRUTH_CREATOR.mapId)return;
  ensure(gate&&player.mapId==='sleeping-stars-3',TRUTH_CREATOR_GATE_MESSAGE);
  ensure(truthCreatorEligible(player),TRUTH_CREATOR_ENTRY_MESSAGE);
}
export function summonTruthCreator(room,player,now=Date.now()){
  ensure(player.connected&&!player.away&&!isDefeated(player),'현재 소환할 수 없습니다.');
  ensure(player.mapId===TRUTH_CREATOR.mapId,'진리의 별 석상 가까이 가주세요.');
  ensure(truthCreatorEligible(player),TRUTH_CREATOR_ENTRY_MESSAGE);
  requireHuntingEntry(player,TRUTH_CREATOR.mapId,now);
  const statue=mapOf(TRUTH_CREATOR.mapId).objects.find(object=>object.id===TRUTH_CREATOR.statueId);
  ensure(statue&&interactionDistance(player,statue)<=interactionReach(statue),'진리의 별 석상 가까이 가주세요.');
  restoreTruthCreatorStatue(room,now);
  ensure(truthCreatorView(room).state==='dormant'&&!((room.monsters?.get(TRUTH_CREATOR.monsterId)?.hp||0)>0)&&!room.pendingBossDeaths?.has(TRUTH_CREATOR.monsterId),'진리의 창조자가 이미 깨어났거나 다시 깨어날 준비 중입니다.');
  room.truthCreator={state:'active',respawnAt:null,monsterId:TRUTH_CREATOR.monsterId};
  monstersOf(room,now);
  return {truthCreator:truthCreatorView(room)};
}
