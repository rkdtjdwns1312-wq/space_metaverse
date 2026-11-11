import {STAR_RECORD} from '../shared/star-record.js';
import {mapOf,interactionDistance,interactionReach} from '../shared/config.js';
import {ensure} from './rooms.js';
import {isDefeated} from './vitals.js';
import {monstersOf} from './monsters.js';
import {requireHuntingEntry} from './hunting-time.js';
import {starRecordView,restoreStarRecordStatue,nextSleepingBossResetAt} from './boss-lifecycle.js';

export function summonStarRecord(room,player,now=Date.now()){
  ensure(player.connected&&!player.away&&!isDefeated(player),'현재 소환할 수 없습니다.');
  ensure(player.mapId===STAR_RECORD.mapId,'별 기록의 석상 가까이 가주세요.');
  requireHuntingEntry(player,STAR_RECORD.mapId,now);
  const statue=mapOf(STAR_RECORD.mapId).objects.find(object=>object.id===STAR_RECORD.statueId);
  ensure(statue&&interactionDistance(player,statue)<=interactionReach(statue),'별 기록의 석상 가까이 가주세요.');
  restoreStarRecordStatue(room,now);
  ensure(starRecordView(room).state==='dormant'&&!((room.monsters?.get(STAR_RECORD.monsterId)?.hp||0)>0)&&!room.pendingBossDeaths?.has(STAR_RECORD.monsterId),'별 기록의 근원이 이미 깨어났거나 다시 깨어날 준비 중입니다.');
  room.starRecord={state:'active',respawnAt:null,monsterId:STAR_RECORD.monsterId,resetAt:nextSleepingBossResetAt(now)};
  monstersOf(room,now);
  return {starRecord:starRecordView(room)};
}
