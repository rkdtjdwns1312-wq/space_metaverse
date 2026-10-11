import {SERENA} from '../shared/serena.js';
import {mapOf,interactionDistance,interactionReach} from '../shared/config.js';
import {ensure} from './rooms.js';
import {isDefeated} from './vitals.js';
import {monstersOf} from './monsters.js';
import {serenaEligible} from './serena-progress.js';
import {serenaView,restoreSerenaStatue} from './boss-lifecycle.js';
export function summonSerena(room,player,now=Date.now()){
  ensure(serenaEligible(player),'자격이 충분하지 않습니다');
  ensure(player.connected&&!player.away&&!isDefeated(player),'현재 소환할 수 없습니다.');
  ensure(player.mapId===SERENA.mapId,'별의 여신 석상 가까이 가주세요.');
  const statue=mapOf(SERENA.mapId).objects.find(o=>o.id===SERENA.statueId);
  ensure(interactionDistance(player,statue)<=interactionReach(statue),'별의 여신 석상 가까이 가주세요.');
  restoreSerenaStatue(room,now);
  ensure(serenaView(room).state==='dormant'&&!((room.monsters?.get(SERENA.monsterId)?.hp||0)>0),'세레나가 이미 깨어났거나 다시 깨어날 준비 중입니다.');
  room.serena={state:'active',respawnAt:null,monsterId:SERENA.monsterId};
  monstersOf(room,now);
  return {serena:serenaView(room)};
}
