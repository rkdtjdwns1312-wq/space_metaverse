import {ensure} from './rooms.js';
import {RULES} from '../shared/config.js';
import {leaveParty} from './party.js';
import {reconcileMembership} from './department-work.js';
import {clearWarningsFromPlanet} from './warnings.js';
import {validateCultureRecommendations} from './culture-library.js';

const filterMap=(map,predicate)=>{if(map instanceof Map)for(const [key,value] of map)if(predicate(value,key))map.delete(key);};

// The caller must transact this operation and defer socket/arcade side effects
// until saving succeeds. PersistentRoomStore.remove() only logs a student out.
export function deleteStudentAccounts(store,room,teacher,playerIds,now=Date.now()){
  ensure(store.rooms.get(room?.code)===room&&room.players.get(teacher?.id)===teacher&&teacher.role==='teacher','선생님만 할 수 있어요.');
  ensure(Array.isArray(playerIds)&&playerIds.length>0&&playerIds.length<=RULES.maxStudents&&
    playerIds.every(id=>typeof id==='string'&&id.length>0)&&new Set(playerIds).size===playerIds.length,'삭제할 학생 계정을 선택해주세요.');
  const targets=playerIds.map(id=>room.players.get(id));
  ensure(targets.every(player=>player?.role==='student'),'이 교실의 학생 또는 마스터 계정만 삭제할 수 있어요.');
  const ids=new Set(playerIds),has=id=>ids.has(id),related=row=>has(row?.fromId)||has(row?.toId);
  // Validate the entire batch before mutating anything, including mixed and
  // cross-class requests. Student-role master accounts use the same rules.
  for(const player of targets){
    leaveParty(room,player.id,now,true);
    for(const planet of room.planets.values())clearWarningsFromPlanet(room,planet,player);
    room.allowedNames.delete(player.nickname);room.players.delete(player.id);
  }
  filterMap(store.sessions,session=>session.room===room&&has(session.player.id));
  for(const field of ['trades','summons','partyInvites','piscesInvites','ariesInvites','cancerInvites','cetusInvites'])filterMap(room[field],related);
  for(const field of ['summonCooldowns','partyDeclines','piscesDeclines'])filterMap(room[field],(_value,key)=>String(key).split(':').some(has));
  filterMap(room.proposals,proposal=>has(proposal.playerId));
  for(const planet of room.planets.values()){
    planet.joinRequests=(planet.joinRequests||[]).filter(row=>!has(row.playerId));
    if(planet.rename){
      filterMap(planet.rename.votes,(_vote,id)=>has(id));
      if(has(planet.rename.proposedBy))planet.rename=null;
    }
    if(planet.warnings)planet.warnings.entries=planet.warnings.entries.filter(row=>!has(row.targetId));
    reconcileMembership(room,planet,now);
  }
  for(const mission of [...(room.missions||[]),...(room.dailyMissions?.instances||[])]){
    for(const field of ['acceptedIds','completedIds','claimedIds'])mission[field]=mission[field].filter(id=>!has(id));
    for(const field of ['progress','claimedAt'])if(mission[field])for(const id of ids)delete mission[field][id];
  }
  for(const assignment of room.temple?.assignments||[])assignment.completedIds=assignment.completedIds.filter(id=>!has(id));
  for(const week of room.temple?.weeks||[])week.totals=week.totals.filter(row=>!has(row.playerId));
  for(const field of ['starRanking','dodgeRanking','memoryRanking','omokWinRecords','signalRanking','tetrisRanking'])if(room[field])room[field]=room[field].filter(row=>!has(row.playerId));
  // An absent card owner must not leave room-wide restrictions (e.g. Pluto).
  // Already awarded balances are never reversed.
  if(room.starCards)room.starCards=room.starCards.filter(row=>!has(row.userId));
  for(const player of room.players.values()){
    if(has(player.piscesPair?.partnerId)||has(player.piscesPair?.sourceId))player.piscesPair=null;
    filterMap(player.tradeBlocks,(_until,id)=>has(id));
    if(player.cardMarkers)player.cardMarkers=player.cardMarkers.filter(row=>!has(row.fromId));
    if(player.abilityState?.blocks)player.abilityState.blocks=player.abilityState.blocks.filter(row=>row.sourceId==='aries'||!has(row.fromId));
    const state=player.constellationAbilityState;
    for(const weekly of [state,state?.ophiuchus?.copied?.state])if(weekly){
      if(has(weekly.paralysis?.sourceId))weekly.paralysis=null;
      if(has(weekly.abilitySeal?.sourceId))weekly.abilitySeal=null;
      weekly.leoChallenges=(weekly.leoChallenges||[]).filter(row=>!has(row.sourceId));
      // Self-contained timed grants keep their provenance/usage ledger: sleep
      // rewards, praise, stomach (including solo escape), and copied abilities
      // require no living source. Do not reset these or duplicate weekly uses.
    }
  }
  room.cultureRecommendations=validateCultureRecommendations(undefined,[...room.players.values()].filter(p=>p.role==='student').map(p=>p.cultureRecommendationVotes||[]));
  for(const field of ['starRuns','dodgeRuns','memoryRuns'])filterMap(room[field],(_run,id)=>has(id));
  for(const field of ['ariesClouds','aquariusCasts','coronaFalls','sagittariusCasts'])filterMap(room[field],cast=>has(cast.playerId));
  for(const field of ['projectiles','leoRoars','ophiuchusVenoms','reflectedVitals'])if(room[field])room[field]=room[field].filter(row=>!has(row.playerId));
  for(const monster of room.monsters?.values()||[]){
    for(const id of ids)for(const field of ['attackers','contributors','meleePresence','teacherRetaliation'])monster[field]?.delete(id);
    if(has(monster.targetId)){monster.targetId=null;monster.pendingAttack=null;}
  }
  for(const [id,drop] of room.energyDrops||[]){
    for(const playerId of ids)drop.shares.delete(playerId);
    if(drop.partyRollEligible)drop.partyRollEligible=drop.partyRollEligible.filter(playerId=>!has(playerId));
    if(drop.rollState){drop.rollState.participantIds=drop.rollState.participantIds.filter(playerId=>!has(playerId));if(!drop.rollState.participantIds.length)drop.rollState=null;}
    if(!drop.shares.size){room.energyDrops.delete(id);room.lootRolls?.delete(id);}
  }
  for(const roll of room.lootRolls?.values()||[]){
    roll.rolls=roll.rolls.filter(row=>!has(row.playerId));roll.tiedIds=roll.tiedIds.filter(id=>!has(id));
    if(has(roll.winnerId))roll.winnerId=null;
  }
  return {deletedIds:[...ids]};
}
