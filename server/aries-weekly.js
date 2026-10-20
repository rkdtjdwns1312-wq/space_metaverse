import {randomInt,randomUUID} from 'node:crypto';
import {SHARDS} from '../shared/config.js';
import {constellationWeekStart} from '../shared/constellation-weekly-abilities.js';
import {constellationAbilityStatus,validateConstellationAbilityState} from './constellation-weekly-abilities.js';
import {GameError} from './pin-auth.js';

const DAY=86400000,HOUR=3600000,INVITE_MS=60000;
export const activeAriesSleep=(player,now=Date.now())=>player?.constellationAbilityState?.ariesSleep?.endsAt>now?
  player.constellationAbilityState.ariesSleep:null;
export function nextAriesMorning(now){
  const local=new Date(now+9*HOUR);
  return Date.UTC(local.getUTCFullYear(),local.getUTCMonth(),local.getUTCDate()+1,8)-9*HOUR;
}
function markSleep(player,sourceId,now,endsAt,reward,wakeCost){
  const state=validateConstellationAbilityState(player.constellationAbilityState);
  player.constellationAbilityState={...state,ariesSleep:{sourceId,startsAt:now,endsAt,reward,wakeCost}};
  player.input={x:0,y:0,at:0};
  player.taurusDash=null;
}
function markUsed(player,days,targetIds,now){
  const state=validateConstellationAbilityState(player.constellationAbilityState);
  player.constellationAbilityState={...state,usedWeek:constellationWeekStart(now),pending:null,
    lastResult:{constellationId:'aries',level:player.avatar.level,roll:null,reward:0,days,
      ...(player.avatar.level===2?{targetId:targetIds[0]}:{}),
      ...(player.avatar.level>=4?{targetIds}:{} )}};
}
export function ariesSleepDue(room,now=Date.now()){
  return [...room.players.values()].some(p=>p.role==='student'&&
    (p.constellationAbilityState?.ariesSleep?.endsAt<=now||
      p.constellationAbilityState?.ariesUnclaimed>0&&p.starShards<SHARDS.max));
}
export function settleAriesSleep(room,now=Date.now()){
  let changed=false;
  for(const player of room.players.values()){
    if(player.role!=='student')continue;
    const state=validateConstellationAbilityState(player.constellationAbilityState);
    if(state.ariesSleep?.endsAt<=now){
      state.ariesUnclaimed+=state.ariesSleep.reward;
      state.ariesSleep=null;changed=true;
    }
    if(state.ariesUnclaimed>0&&player.starShards<SHARDS.max){
      const paid=Math.min(state.ariesUnclaimed,SHARDS.max-player.starShards);
      player.starShards+=paid;state.ariesUnclaimed-=paid;changed=true;
    }
    if(state.ariesSleep!==player.constellationAbilityState?.ariesSleep||
      state.ariesUnclaimed!==player.constellationAbilityState?.ariesUnclaimed)
      player.constellationAbilityState=state;
  }
  return changed;
}
function requireAries(player,level,now){
  const status=constellationAbilityStatus(player,now);
  if(!status.canUse||status.constellationId!=='aries'||status.level!==level)
    throw new GameError(status.message||'지금은 양자리 능력을 사용할 수 없어요.');
}
export function inviteAriesSleep(room,player,targetId,now=Date.now()){
  requireAries(player,2,now);
  const target=room.players.get(targetId);
  if(!target||target.role!=='student'||target.id===player.id||!target.connected||target.away)
    throw new GameError('접속 중인 다른 친구를 골라 주세요.');
  if(activeAriesSleep(target,now))throw new GameError('그 친구는 이미 잠들어 있어요.');
  if(player.starShards>=SHARDS.max||target.starShards>=SHARDS.max)
    throw new GameError('두 친구 모두 별 파편을 받을 자리가 있어야 해요.');
  room.ariesInvites??=new Map();
  for(const [id,invite] of room.ariesInvites)if(invite.expiresAt<=now)room.ariesInvites.delete(id);
  if([...room.ariesInvites.values()].some(invite=>invite.fromId===player.id))
    throw new GameError('먼저 보낸 수면 신청의 답을 기다려 주세요.');
  const invite={id:randomUUID(),fromId:player.id,toId:target.id,fromNickname:player.nickname,expiresAt:now+INVITE_MS};
  room.ariesInvites.set(invite.id,invite);
  return invite;
}
export function respondAriesSleep(room,player,requestId,accept,now=Date.now()){
  if(typeof accept!=='boolean')throw new GameError('수락 또는 거절을 골라 주세요.');
  const invite=room.ariesInvites?.get(requestId);
  if(!invite||invite.toId!==player.id||invite.expiresAt<=now)
    throw new GameError('수면 신청이 끝났거나 나에게 온 신청이 아니에요.');
  if(!accept){room.ariesInvites.delete(requestId);return {accepted:false,invite};}
  const source=room.players.get(invite.fromId);
  if(!source?.connected||source.away||!player.connected||player.away)
    throw new GameError('두 친구가 접속 중일 때 수락할 수 있어요.');
  requireAries(source,2,now);
  if(activeAriesSleep(player,now)||source.starShards>=SHARDS.max||player.starShards>=SHARDS.max)
    throw new GameError('수면 상태나 별 파편 가방을 확인해 주세요.');
  settleAriesSleep(room,now);
  const endsAt=nextAriesMorning(now);
  markSleep(source,source.id,now,endsAt,1,0);
  markSleep(player,source.id,now,endsAt,1,0);
  markUsed(source,1,[player.id],now);
  room.ariesInvites.delete(requestId);
  return {accepted:true,invite,endsAt};
}
export function useAriesSleep(room,player,data,now=Date.now(),pick=randomInt){
  const level=player.avatar?.level;
  if(level===3){
    requireAries(player,3,now);
    if(!Number.isInteger(data?.days)||data.days<1||data.days>3)
      throw new GameError('잠잘 기간을 1~3일 중에서 골라 주세요.');
    settleAriesSleep(room,now);
    const endsAt=now+data.days*DAY;
    markSleep(player,player.id,now,endsAt,data.days,0);
    markUsed(player,data.days,[],now);
    return {days:data.days,endsAt,message:`${data.days}일 동안 잠들어요. 깨어나면 별 파편 ${data.days}개를 받아요.`};
  }
  if(level!==4&&level!==5)throw new GameError('이 단계에서는 친구에게 수면을 신청해 주세요.');
  requireAries(player,level,now);
  const limit=level===4?6:10;
  const available=[...room.players.values()].filter(target=>target.role==='student'&&target.id!==player.id&&!activeAriesSleep(target,now));
  if(!available.length)throw new GameError('지금 잠재울 수 있는 다른 학생이 없어요.');
  settleAriesSleep(room,now);
  for(let i=available.length-1;i>0;i--){const j=pick(i+1);[available[i],available[j]]=[available[j],available[i]];}
  const targets=available.slice(0,limit),endsAt=now+DAY;
  for(const target of targets)markSleep(target,player.id,now,endsAt,0,1);
  markUsed(player,1,targets.map(target=>target.id),now);
  return {targetIds:targets.map(target=>target.id),endsAt,message:`다른 학생 ${targets.length}명이 하루 동안 잠들었어요.`};
}
export function wakeAriesSleep(player,now=Date.now()){
  const sleep=activeAriesSleep(player,now);
  if(!sleep||sleep.wakeCost!==1)throw new GameError('별 파편으로 즉시 깨어날 수 있는 수면 상태가 아니에요.');
  if(player.starShards<1)throw new GameError('즉시 깨어나려면 별 파편 1개가 필요해요.');
  const state=validateConstellationAbilityState(player.constellationAbilityState);
  player.starShards--;
  player.constellationAbilityState={...state,ariesSleep:null};
  return {starShards:player.starShards,message:'별 파편 1개를 내고 잠에서 깨어났어요.'};
}
