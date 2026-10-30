import {ensureVitals,damagePlayer} from './vitals.js';

export const BOSS_MAP_HAZARDS=Object.freeze({
  leoon:Object.freeze({statusId:'burn',mapId:'sun-paradise-3'}),
  noksera:Object.freeze({statusId:'frost',mapId:'moon-paradise-3'})
});
export const BOSS_HAZARD_INTERVAL_MS=5000;
function sourceFor(room,player,now){
  if(!player||room.players?.get(player.id)!==player||!player.connected||player.away||player.avatar?.blackStar||
    !(player.avatar?.level>=2)||!player.avatar?.constellationId||!(ensureVitals(player)?.hp>0)||
    (player.constellationAbilityState?.ariesSleep?.endsAt||0)>now)return null;
  if(!['student','teacher'].includes(player.role)||player.role==='teacher'&&(player.teacherGhost||player.avatar?.teacherPreview))return null;
  return [...(room.monsters?.values()||[])].find(boss=>{
    const rule=BOSS_MAP_HAZARDS[boss.typeId];
    return rule&&boss.hp>0&&boss.mapId===rule.mapId&&player.mapId===boss.mapId&&
      (player.role!=='teacher'||boss.teacherRetaliation?.has(player.id));
  })||null;
}

// Live eligibility prevents stale status icons after leaving or defeating a boss.
export function activeHazardView(room,player,now=Date.now()){
  const boss=sourceFor(room,player,now);
  return boss?[{statusId:BOSS_MAP_HAZARDS[boss.typeId].statusId,until:null,sourceId:boss.id}]:[];
}
// Call on explicit leave/disconnect transitions as well, including a round trip
// between simulation ticks. A returning character receives a fresh five seconds.
export function clearBossMapHazard(room,playerId){return room.bossMapHazards?.delete(playerId)||false;}

export function advanceBossMapHazards(room,now=Date.now()){
  const timers=room.bossMapHazards??=new Map(),hits=[],state=new Map();let changed=false;
  for(const [id,timer] of timers)if(room.players.get(id)!==timer.player){timers.delete(id);changed=true;}
  for(const player of room.players.values()){
    const boss=sourceFor(room,player,now),previous=timers.get(player.id);
    if(!boss){if(timers.delete(player.id))changed=true;state.set(player.id,[]);continue;}
    if(!previous||previous.boss!==boss||previous.mapId!==player.mapId){
      timers.set(player.id,{player,boss,mapId:player.mapId,nextTickAt:now+BOSS_HAZARD_INTERVAL_MS});changed=true;
    }else if(now>=previous.nextTickAt){
      // Never replay accumulated damage after a stalled loop.
      previous.nextTickAt=now+BOSS_HAZARD_INTERVAL_MS;
      const hit=damagePlayer(player,2,now,{room,fixedDamage:2});
      if(hit){hits.push({targetId:player.id,monsterId:boss.id,mapId:boss.mapId,...hit});if(hit.damage>0)changed=true;}
      if(!sourceFor(room,player,now)){timers.delete(player.id);changed=true;}
    }
    state.set(player.id,activeHazardView(room,player,now));
  }
  return {hits,changed,state};
}
