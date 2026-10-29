import {huntingTimeView,huntingExempt,isHuntingMap} from './hunting-time.js';
import {randomUUID} from 'node:crypto';
import {SHARDS,WHALE_STOMACH_ID,PLAZA_ID,STATIC_MAPS} from '../shared/config.js';
import {constellationWeekStart,CONSTELLATION_WEEK_MS} from '../shared/constellation-weekly-abilities.js';
import {constellationAbilityStatus,validateConstellationAbilityState} from './constellation-weekly-abilities.js';
import {GameError} from './pin-auth.js';
import {spawnInside,arrivePosition} from './world.js';

const DAY=86400000,INVITE_MS=60000;
const slots=level=>level===4?2:level===5?4:1;
const record=player=>validateConstellationAbilityState(player.constellationAbilityState);
const active=({endsAt},now)=>endsAt>now;

export function activeCetusStomach(player,now=Date.now()){
  const stomach=player?.constellationAbilityState?.cetusStomach;
  return player.mapId===WHALE_STOMACH_ID&&stomach&&active(stomach,now)?stomach:null;
}

export function cetusInviteViews(room,viewer,now=Date.now()){
  return [...(room.cetusInvites?.values()||[])].filter(invite=>invite.expiresAt>now&&(invite.fromId===viewer.id||invite.toId===viewer.id));
}

function eligibleTarget(room,actor,targetId,level,now){
  const target=room.players.get(targetId);
  if(!target||target.id===actor.id||target.role!=='student'||!target.connected||target.away)
    throw new GameError('접속 중인 다른 학생 친구를 골라 주세요.');
  if(level>=3&&target.avatar?.level>Math.min(level,level===5?4:level))
    throw new GameError('현재 단계에서 삼키거나 칭찬할 수 있는 레벨의 친구를 골라 주세요.');
  if(target.avatar?.blackStar||activeCetusStomach(target,now))
    throw new GameError('검은별 또는 배 속에 있는 친구는 고를 수 없어요.');
  if(level>=4&&target.mapId===WHALE_STOMACH_ID)throw new GameError('이미 고래 배 속에 있는 친구예요.');
  return target;
}

function addShards(actor,amount){
  const state=record(actor);
  state.cetusUnclaimed+=Math.max(0,amount);
  actor.constellationAbilityState=state;
  settleCetusUnclaimed(actor);
}

export function settleCetusUnclaimed(player){
  const state=player.constellationAbilityState;
  if(!state?.cetusUnclaimed||player.starShards>=SHARDS.max)return 0;
  const amount=Math.min(state.cetusUnclaimed,SHARDS.max-player.starShards);
  player.starShards+=amount;state.cetusUnclaimed-=amount;return amount;
}

function praise(target,sourceId,now){
  const state=record(target),week=constellationWeekStart(now);
  // 이미 사용한 주간 능력을 되살리지 않습니다. 다음 주가 유효기간 안에 오면 그때부터 효과가 납니다.
  const alreadyUsed=state.usedWeek!=null&&state.usedWeek>=week||
    state.ophiuchus?.week===week&&state.ophiuchus.usedLevels.length>0||
    state.warningWeek===week&&state.warningCount>0||state.swanDaily?.week===week&&state.swanDaily.checkedMask>0;
  state.cetusPraise={sourceId,startsAt:now,endsAt:now+7*DAY,eligibleWeek:alreadyUsed?week+CONSTELLATION_WEEK_MS:week,bonusUsed:false};
  target.constellationAbilityState=state;
}

function markSlot(actor,targetId,now){
  const state=record(actor),week=constellationWeekStart(now),level=actor.avatar.level;
  const previous=state.cetus?.week===week?state.cetus:{week,targetIds:[]};
  if(previous.targetIds.includes(targetId))throw new GameError('이번 주에는 이미 초대한 친구예요.');
  const praised=state.cetusPraise?.endsAt>now&&state.cetusPraise.eligibleWeek<=week&&!state.cetusPraise.bonusUsed;
  const limit=slots(level)*(praised?2:1);
  if(previous.targetIds.length>=limit)throw new GameError('이번 주 고래자리 초대 횟수를 모두 사용했어요.');
  state.cetus={week,targetIds:[...previous.targetIds,targetId]};
  if(praised&&state.cetus.targetIds.length>=limit)state.cetusPraise.bonusUsed=true;
  state.usedWeek=week;state.lastResult={constellationId:'cetus',level,roll:null,reward:0,targetId,uses:state.cetus.targetIds.length};
  actor.constellationAbilityState=state;
}

export function useCetus(room,actor,{targetId}={},now=Date.now()){
  const status=constellationAbilityStatus(actor,now),level=actor.avatar?.level;
  if(status.constellationId!=='cetus'||!status.canUse)throw new GameError(status.message||'고래자리 능력을 사용할 수 없어요.');
  const target=eligibleTarget(room,actor,targetId,level,now);
  markSlot(actor,target.id,now);
  if(level===3){
    const reward=Math.max(0,3-target.avatar.level);
    praise(target,actor.id,now);addShards(actor,reward);
    return {...constellationAbilityStatus(actor,now),message:`${target.nickname} 친구를 칭찬했어요. 별 파편 ${reward}개를 만들었어요.`,targetId:target.id};
  }
  room.cetusInvites??=new Map();
  const invite={id:randomUUID(),fromId:actor.id,toId:target.id,fromNickname:actor.nickname,level,
    expiresAt:now+INVITE_MS};
  room.cetusInvites.set(invite.id,invite);
  return {...constellationAbilityStatus(actor,now),invitation:invite,
    message:level===2?`${target.nickname} 친구에게 칭찬 동의를 요청했어요.`:`${target.nickname} 친구에게 고래 배 속 초대를 보냈어요.`};
}

export function respondCetus(room,target,requestId,accept,now=Date.now(),sourceOverride=null){
  if(typeof accept!=='boolean')throw new GameError('수락 또는 거절을 골라 주세요.');
  const invite=room.cetusInvites?.get(requestId);
  if(!invite||invite.toId!==target.id||invite.expiresAt<=now)throw new GameError('고래자리 초대가 끝났거나 나에게 온 초대가 아니에요.');
  room.cetusInvites.delete(requestId);
  const actor=sourceOverride||room.players.get(invite.fromId);
  if(!accept)return {accepted:false,invite,message:'초대를 거절했어요. 이 친구 몫의 초대 횟수만 사용됐어요.'};
  if(!actor?.connected||actor.away||actor.avatar?.constellationId!=='cetus'||actor.avatar?.level!==invite.level)
    throw new GameError('초대한 친구의 고래자리 상태가 바뀌었어요.');
  eligibleTarget(room,actor,target.id,invite.level,now);
  if(invite.level===2){praise(target,actor.id,now);addShards(actor,1);}
  else{
    const state=record(target);
    const original=STATIC_MAPS[target.mapId]?target.mapId:PLAZA_ID;
    state.cetusStomach={sourceId:actor.id,level:invite.level,startsAt:now,endsAt:now+DAY,
      returnMapId:original,returnX:target.x,returnY:target.y};
    target.constellationAbilityState=state;
    Object.assign(target,spawnInside(room,WHALE_STOMACH_ID,target),{mapId:WHALE_STOMACH_ID,input:{x:0,y:0,at:0}});
    addShards(actor,Math.max(0,5-target.avatar.level));
  }
  return {accepted:true,invite,message:invite.level===2?'칭찬을 수락했어요. 앞으로 쓰는 별자리 능력이 2배가 돼요.':'고래 배 속에 들어왔어요. 혼자서도 언제든 탈출할 수 있어요.'};
}

function release(room,target,now,escaped){
  const state=record(target),stomach=state.cetusStomach;
  if(!stomach)return false;
  state.cetusStomach=null;
  target.constellationAbilityState=state;
  if(!escaped){
    if(stomach.level===4)praise(target,stomach.sourceId,now);
    else state.cetusAfterglow={sourceId:stomach.sourceId,endsAt:now+7*DAY,claimed:false};
  }else{state.cetusPraise=null;state.cetusAfterglow=null;}
  if(target.mapId===WHALE_STOMACH_ID){
    let destination=STATIC_MAPS[stomach.returnMapId]?stomach.returnMapId:PLAZA_ID;
    if(isHuntingMap(destination)&&!huntingExempt(target)&&huntingTimeView(target,now).remainingMs<=0)destination='star-street';
    const pos=destination!==stomach.returnMapId?spawnInside(room,destination,target):arrivePosition(room,destination,{x:stomach.returnX,y:stomach.returnY},target);
    Object.assign(target,pos,
      {mapId:destination,input:{x:0,y:0,at:0}});
  }
  return true;
}

export function escapeCetus(room,target,now=Date.now()){
  if(!activeCetusStomach(target,now))throw new GameError('지금은 고래 배 속에 있지 않아요.');
  release(room,target,now,true);
  return {message:'고래 배 속에서 나왔어요. 고래자리의 이후 효과는 받지 않아요.'};
}

export function settleCetusStomachs(room,now=Date.now()){
  let changed=false;
  for(const player of room.players.values())if(player.constellationAbilityState?.cetusStomach&&
    (player.constellationAbilityState.cetusStomach.endsAt<=now||player.avatar?.blackStar))
    changed=release(room,player,now,!!player.avatar?.blackStar)||changed;
  for(const [id,invite] of room.cetusInvites||[])if(invite.expiresAt<=now)room.cetusInvites.delete(id);
  return changed;
}

export function cetusAfterAbility(player,now=Date.now(),wasBonusUse=false){
  const state=record(player);
  let changed=false;
  if(wasBonusUse&&state.cetusPraise?.endsAt>now&&!state.cetusPraise.bonusUsed){state.cetusPraise.bonusUsed=true;changed=true;}
  if(state.cetusAfterglow?.endsAt>now&&!state.cetusAfterglow.claimed){state.cetusAfterglow.claimed=true;state.cetusUnclaimed++;changed=true;}
  if(changed){player.constellationAbilityState=state;settleCetusUnclaimed(player);}
  return changed;
}
