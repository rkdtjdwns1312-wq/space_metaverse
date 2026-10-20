import {randomUUID} from 'node:crypto';
import {ensure} from './rooms.js';
import {constellationAbilityStatus,completePiscesPair} from './constellation-weekly-abilities.js';
import {weeklyAbilityFor} from '../shared/constellation-weekly-abilities.js';

export const PARTY_MAX=4;
export const PARTY_INVITE_MS=60_000;
export const PARTY_REJECT_MS=5*60_000;
const PISCES_INVITE_MS=60_000;
const DAY_MS=86400000;

export function validatePiscesPair(value){
  if(value===undefined||value===null)return null;
  if(!value||typeof value!=='object'||Array.isArray(value)||typeof value.partnerId!=='string'||!value.partnerId||typeof value.sourceId!=='string'||!value.sourceId||
    !Number.isInteger(value.level)||value.level<2||value.level>5||!Number.isSafeInteger(value.startsAt)||value.startsAt<0||!Number.isSafeInteger(value.endsAt)||value.endsAt!==value.startsAt+weeklyAbilityFor('pisces',value.level).days*DAY_MS)
    throw new Error('물고기자리 짝 상태 저장 데이터가 올바르지 않습니다.');
  return {partnerId:value.partnerId,sourceId:value.sourceId,level:value.level,startsAt:value.startsAt,endsAt:value.endsAt};
}
export const activePiscesPair=(player,now=Date.now())=>player?.piscesPair?.endsAt>now?player.piscesPair:null;
function clearPiscesPair(room,playerId){
  const player=room.players.get(playerId),pair=player?.piscesPair;
  if(!pair)return false;
  const other=room.players.get(pair.partnerId);
  player.piscesPair=null;
  if(other?.piscesPair?.partnerId===playerId)other.piscesPair=null;
  const party=partyOf(room,playerId);
  if(party?.piscesPair)room.parties.delete(party.id);
  return true;
}
export function settlePiscesPairs(room,now=Date.now()){
  let changed=false;
  for(const player of room.players.values())if(player.piscesPair?.endsAt<=now)changed=clearPiscesPair(room,player.id)||changed;
  return changed;
}
export function restorePiscesParties(room,now=Date.now()){
  room.parties??=new Map();
  for(const player of room.players.values()){
    const pair=player.piscesPair;
    if(!pair)continue;
    const other=room.players.get(pair.partnerId);
    if(!other||other.id===player.id||pair.sourceId!==player.id&&pair.sourceId!==other.id||!other.piscesPair||other.piscesPair.partnerId!==player.id||
      other.piscesPair.sourceId!==pair.sourceId||other.piscesPair.level!==pair.level||other.piscesPair.startsAt!==pair.startsAt||other.piscesPair.endsAt!==pair.endsAt)
      throw new Error('물고기자리 짝 관계 저장 데이터가 일치하지 않습니다.');
    if(pair.endsAt>now&&!partyOf(room,player.id)){
      const party={id:randomUUID(),leaderId:pair.sourceId,memberIds:[player.id,other.id],piscesPair:true,endsAt:pair.endsAt};
      room.parties.set(party.id,party);
    }
  }
}
export function invitePiscesPair(room,player,targetId,now=Date.now()){
  state(room,now);
  const status=constellationAbilityStatus(player,now),ability=weeklyAbilityFor(status.constellationId,status.level),target=room.players.get(targetId);
  ensure(status.canUse&&ability.pair,status.message||'물고기자리 능력을 사용할 수 없어요.');
  ensure(target&&target.id!==player.id&&target.role==='student'&&target.connected&&!target.away,'접속 중인 학생 친구를 골라주세요.');
  ensure(!activePiscesPair(player,now)&&!activePiscesPair(target,now),'이미 짝 상태인 친구는 신청할 수 없어요.');
  ensure(!partyOf(room,player.id)&&!partyOf(room,target.id),'짝 상태를 시작하려면 두 사람 모두 현재 파티에서 나와야 해요.');
  ensure((room.piscesDeclines.get(player.id+':'+target.id)||0)<=now,'친구가 거절했어요. 5분 뒤 다시 신청할 수 있어요.');
  ensure(![...room.piscesInvites.values()].some(i=>i.fromId===player.id),'먼저 보낸 짝 신청의 답을 기다리고 있어요.');
  const invite={id:randomUUID(),fromId:player.id,toId:target.id,fromNickname:player.nickname,level:status.level,days:ability.days,expiresAt:now+PISCES_INVITE_MS};
  room.piscesInvites.set(invite.id,invite);
  return invite;
}
export function respondPiscesPair(room,player,requestId,accept,now=Date.now()){
  state(room,now);
  ensure(typeof accept==='boolean','수락 또는 거절을 골라주세요.');
  const invite=room.piscesInvites.get(requestId);
  ensure(invite?.toId===player.id,'짝 신청이 끝났거나 나에게 온 신청이 아니에요.');
  if(!accept){room.piscesInvites.delete(requestId);room.piscesDeclines.set(invite.fromId+':'+player.id,now+PARTY_REJECT_MS);return {accepted:false,invite};}
  const source=room.players.get(invite.fromId),status=source&&constellationAbilityStatus(source,now);
  ensure(source?.connected&&!source.away&&player.connected&&!player.away&&status?.canUse&&status.level===invite.level&&status.constellationId==='pisces','신청한 친구의 별자리 능력을 다시 확인해 주세요.');
  ensure(!partyOf(room,source.id)&&!partyOf(room,player.id)&&!activePiscesPair(source,now)&&!activePiscesPair(player,now),'두 사람 모두 다른 파티나 짝 상태가 없어야 해요.');
  const endsAt=now+invite.days*DAY_MS,pair={sourceId:source.id,level:invite.level,startsAt:now,endsAt};
  completePiscesPair(source,player.id,now);
  source.piscesPair={...pair,partnerId:player.id};player.piscesPair={...pair,partnerId:source.id};
  const party={id:randomUUID(),leaderId:source.id,memberIds:[source.id,player.id],piscesPair:true,endsAt};
  room.parties.set(party.id,party);
  const paired=new Set(party.memberIds);
  for(const [id,pending] of room.piscesInvites)if(paired.has(pending.fromId)||paired.has(pending.toId))room.piscesInvites.delete(id);
  for(const [id,pending] of room.partyInvites)if(paired.has(pending.fromId)||paired.has(pending.toId))room.partyInvites.delete(id);
  return {accepted:true,invite,party,endsAt};
}

function state(room,now){
  room.parties??=new Map();room.partyInvites??=new Map();room.partyDeclines??=new Map();room.piscesInvites??=new Map();room.piscesDeclines??=new Map();
  for(const [id,invite] of room.partyInvites)if(invite.expiresAt<=now)room.partyInvites.delete(id);
  for(const [key,until] of room.partyDeclines)if(until<=now)room.partyDeclines.delete(key);
  for(const [id,invite] of room.piscesInvites)if(invite.expiresAt<=now)room.piscesInvites.delete(id);
  for(const [key,until] of room.piscesDeclines)if(until<=now)room.piscesDeclines.delete(key);
}
export function partyOf(room,playerId){
  return [...(room.parties?.values()||[])].find(p=>p.memberIds.includes(playerId))||null;
}
export function inviteParty(room,player,targetId,now=Date.now()){
  state(room,now);
  const target=room.players.get(targetId),party=partyOf(room,player.id);
  ensure(player.connected&&!player.away&&player.role==='student','학생 친구끼리 파티를 만들 수 있어요.');
  ensure(target&&target.id!==player.id&&target.connected&&!target.away&&target.role==='student','접속 중인 학생 친구를 골라주세요.');
  ensure(!partyOf(room,target.id),'이미 다른 파티에 참여한 친구예요.');
  ensure(!party||party.memberIds.length<PARTY_MAX,'파티는 네 명까지예요.');
  ensure(!party?.piscesPair,'짝 상태 중에는 두 사람만 함께해요.');
  ensure((room.partyDeclines.get(player.id+':'+target.id)||0)<=now,'이 친구가 초대를 거절했어요. 5분 뒤 다시 초대할 수 있어요.');
  ensure(![...room.partyInvites.values()].some(r=>r.fromId===player.id&&r.toId===target.id),'이미 보낸 파티 초대의 답을 기다리고 있어요.');
  const invite={id:randomUUID(),fromId:player.id,toId:target.id,fromNickname:player.nickname,expiresAt:now+PARTY_INVITE_MS};
  room.partyInvites.set(invite.id,invite);return invite;
}
export function respondParty(room,player,requestId,accept,now=Date.now()){
  state(room,now);
  ensure(typeof accept==='boolean','수락 또는 거절을 골라주세요.');
  const invite=room.partyInvites.get(requestId);
  ensure(invite?.toId===player.id,'파티 초대가 끝났거나 나에게 온 초대가 아니에요.');
  const host=room.players.get(invite.fromId),hostParty=partyOf(room,invite.fromId);
  if(!accept){
    room.partyInvites.delete(requestId);
    room.partyDeclines.set(invite.fromId+':'+player.id,now+PARTY_REJECT_MS);
    return {accepted:false,invite};
  }
  ensure(host?.connected&&!host.away&&player.connected&&!player.away,'친구가 접속 중인지 확인해주세요.');
  ensure(!partyOf(room,player.id),'이미 파티에 참여하고 있어요.');
  ensure(!hostParty||hostParty.memberIds.length<PARTY_MAX,'파티는 네 명까지예요.');
  ensure(!hostParty?.piscesPair,'짝 상태 중인 파티에는 들어갈 수 없어요.');
  const party=hostParty||{id:randomUUID(),leaderId:host.id,memberIds:[host.id]};
  party.memberIds.push(player.id);room.parties.set(party.id,party);
  room.partyInvites.delete(requestId);
  for(const [id,pending] of room.partyInvites)if(pending.toId===player.id)room.partyInvites.delete(id);
  return {accepted:true,invite,party};
}
export function leaveParty(room,playerId,now=Date.now(),force=false){
  const party=partyOf(room,playerId);if(!party)return false;
  ensure(force||!activePiscesPair(room.players.get(playerId),now),'짝 상태가 끝날 때까지 파티에서 나갈 수 없어요.');
  if(party.piscesPair){clearPiscesPair(room,playerId);return true;}
  party.memberIds=party.memberIds.filter(id=>id!==playerId);
  if(party.memberIds.length<2)room.parties.delete(party.id);
  else if(party.leaderId===playerId)party.leaderId=party.memberIds[0];
  for(const [id,pending] of room.partyInvites)if(pending.fromId===playerId||pending.toId===playerId)room.partyInvites.delete(id);
  return true;
}
export function partyView(room,viewer,now=Date.now()){
  if(!viewer)return {party:null,partyInvites:[],partyDeclines:[],lootRolls:[]};
  state(room,now);
  const party=partyOf(room,viewer.id);
  return {party:party?{id:party.id,leaderId:party.leaderId,memberIds:[...party.memberIds],piscesPair:!!party.piscesPair,endsAt:party.endsAt??null}:null,
    partyInvites:[...room.partyInvites.values()].filter(r=>r.toId===viewer.id),
    piscesInvites:[...room.piscesInvites.values()].filter(r=>r.toId===viewer.id||r.fromId===viewer.id),
    piscesDeclines:[...room.piscesDeclines].filter(([key,until])=>key.startsWith(viewer.id+':')&&until>now).map(([key,until])=>({targetId:key.slice(viewer.id.length+1),until})),
    partyDeclines:[...room.partyDeclines].filter(([key,until])=>key.startsWith(viewer.id+':')&&until>now)
      .map(([key,until])=>({targetId:key.slice(viewer.id.length+1),until})),
    lootRolls:[...(room.lootRolls?.values()||[])].filter(r=>r.expiresAt>now&&
      (r.rolls.some(value=>value.playerId===viewer.id)||r.tiedIds.includes(viewer.id)||r.winnerId===viewer.id))};
}
