import {mapOf,interactionDistance,interactionReach} from '../shared/config.js';
import {FORGOTTEN_CONSTELLATION as boss} from '../shared/forgotten-constellation.js';
import {forgottenConstellationView,restoreForgottenConstellationStatue} from './boss-lifecycle.js';
import {monstersOf} from './monsters.js';
import {requireHuntingEntry} from './hunting-time.js';
import {ensure} from './rooms.js';
import {isDefeated} from './vitals.js';

export function summonForgottenConstellation(room,player,now=Date.now()){
 ensure(player.connected&&!player.away&&!isDefeated(player),'현재 소환할 수 없습니다.');
 const statue=mapOf(boss.mapId).objects.find(o=>o.id===boss.statueId);
 ensure(player.mapId===boss.mapId&&statue&&interactionDistance(player,statue)<=interactionReach(statue),'별자리의 기원 석상 가까이 가주세요.');
 requireHuntingEntry(player,boss.mapId,now);
 restoreForgottenConstellationStatue(room,now);
 ensure(forgottenConstellationView(room).state==='dormant'&&!(room.monsters?.get(boss.monsterId)?.hp>0)&&!room.pendingBossDeaths?.has(boss.monsterId),'이미 깨어났거나 다시 깨어날 준비 중이에요.');
 room.forgottenConstellation={state:'active',respawnAt:null,monsterId:boss.monsterId};
 monstersOf(room,now);
 return {forgottenConstellation:forgottenConstellationView(room)};
}
