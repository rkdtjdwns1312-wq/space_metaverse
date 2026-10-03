import {randomUUID} from 'node:crypto';
import {ensure} from './rooms.js';

export const PARTY_MAX=4;
export const PARTY_INVITE_MS=60_000;
export const PARTY_REJECT_MS=5*60_000;

function state(room,now){
  room.parties??=new Map();room.partyInvites??=new Map();room.partyDeclines??=new Map();
  for(const [id,invite] of room.partyInvites)if(invite.expiresAt<=now)room.partyInvites.delete(id);
  for(const [key,until] of room.partyDeclines)if(until<=now)room.partyDeclines.delete(key);
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
  const party=hostParty||{id:randomUUID(),leaderId:host.id,memberIds:[host.id]};
  party.memberIds.push(player.id);room.parties.set(party.id,party);
  room.partyInvites.delete(requestId);
  for(const [id,pending] of room.partyInvites)if(pending.toId===player.id)room.partyInvites.delete(id);
  return {accepted:true,invite,party};
}
export function leaveParty(room,playerId){
  const party=partyOf(room,playerId);if(!party)return false;
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
  return {party:party?{id:party.id,leaderId:party.leaderId,memberIds:[...party.memberIds]}:null,
    partyInvites:[...room.partyInvites.values()].filter(r=>r.toId===viewer.id),
    partyDeclines:[...room.partyDeclines].filter(([key,until])=>key.startsWith(viewer.id+':')&&until>now)
      .map(([key,until])=>({targetId:key.slice(viewer.id.length+1),until})),
    lootRolls:[...(room.lootRolls?.values()||[])].filter(r=>r.expiresAt>now&&
      (r.rolls.some(value=>value.playerId===viewer.id)||r.tiedIds.includes(viewer.id)||r.winnerId===viewer.id))};
}
