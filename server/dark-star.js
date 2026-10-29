import {DARK_STAR} from '../shared/dark-star.js';
import {mapOf,interactionDistance,interactionReach} from '../shared/config.js';
import {ensure} from './rooms.js';
import {isDefeated} from './vitals.js';
import {monstersOf} from './monsters.js';
import {requireHuntingEntry} from './hunting-time.js';
import {darkStarView,restoreDarkStarStatue} from './boss-lifecycle.js';
export function summonDarkStar(room,player,now=Date.now()){
  ensure(player.connected&&!player.away&&!isDefeated(player),'현재 소환할 수 없습니다.');
  ensure(player.mapId===DARK_STAR.mapId,'돌이 된 별 석상 가까이 가주세요.');
  requireHuntingEntry(player,DARK_STAR.mapId,now);
  const statue=mapOf(DARK_STAR.mapId).objects.find(o=>o.id===DARK_STAR.statueId);
  ensure(interactionDistance(player,statue)<=interactionReach(statue),'돌이 된 별 석상 가까이 가주세요.');
  restoreDarkStarStatue(room,now);
  ensure(darkStarView(room).state==='dormant'&&!((room.monsters?.get(DARK_STAR.monsterId)?.hp||0)>0)&&!room.pendingBossDeaths?.has(DARK_STAR.monsterId),'태초의 검은별이 이미 깨어났거나 다시 깨어날 준비 중입니다.');
  room.darkStar={state:'active',respawnAt:null,monsterId:DARK_STAR.monsterId};
  monstersOf(room,now);
  return {darkStar:darkStarView(room)};
}
