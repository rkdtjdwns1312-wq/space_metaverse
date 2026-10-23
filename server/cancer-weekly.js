import {randomInt,randomUUID} from 'node:crypto';
import {SHARDS} from '../shared/config.js';
import {constellationWeekStart,weeklyAbilityFor} from '../shared/constellation-weekly-abilities.js';
import {constellationAbilityStatus,validateConstellationAbilityState} from './constellation-weekly-abilities.js';
import {GameError} from './pin-auth.js';

const choices={2:['rock','paper','scissors'],3:['heads','tails'],4:[],5:['odd','even']};
const other={heads:'tails',tails:'heads',odd:'even',even:'odd'};
const beats={rock:'scissors',paper:'rock',scissors:'paper'};
const ensureDuel=(player,now)=>{
  const status=constellationAbilityStatus(player,now);
  if(status.constellationId!=='cancer'||!status.canUse||status.level<2)
    throw new GameError(status.message||'지금은 게자리 능력을 사용할 수 없어요.');
  return status.level;
};
function eligible(room,source,target,level,now){
  if(!target||target.role!=='student'||target.id===source.id||!target.connected||target.away)
    throw new GameError('접속 중인 다른 친구를 골라 주세요.');
  const {win,loss}=weeklyAbilityFor('cancer',level);
  for(const player of [source,target]){
    if(player.starShards<loss)throw new GameError('대결하려면 두 친구에게 잃을 수 있는 별 파편이 있어야 해요.');
    if(player.starShards>SHARDS.max-win)throw new GameError('두 친구 모두 이길 때 받을 별 파편 공간이 있어야 해요.');
  }
}
export function inviteCancerDuel(room,source,targetId,choice,now=Date.now()){
  const level=ensureDuel(source,now),target=room.players.get(targetId);
  eligible(room,source,target,level,now);
  if(level!==4&&!choices[level].includes(choice))throw new GameError('대결할 선택지를 골라 주세요.');
  room.cancerInvites??=new Map();
  for(const [id,invite] of room.cancerInvites)if(invite.expiresAt<=now)room.cancerInvites.delete(id);
  if([...room.cancerInvites.values()].some(invite=>invite.fromId===source.id))
    throw new GameError('먼저 보낸 대결 신청의 답을 기다려 주세요.');
  const invite={id:randomUUID(),fromId:source.id,toId:target.id,fromNickname:source.nickname,toNickname:target.nickname,
    level,choice:level===4?null:choice,expiresAt:now+60000};
  room.cancerInvites.set(invite.id,invite);
  return invite;
}
export function respondCancerDuel(room,target,requestId,accept,targetChoice,now=Date.now(),die=()=>randomInt(1,7),sourceOverride=null){
  if(typeof accept!=='boolean')throw new GameError('수락 또는 거절을 골라 주세요.');
  const invite=room.cancerInvites?.get(requestId);
  if(!invite||invite.toId!==target.id||invite.expiresAt<=now)
    throw new GameError('대결 신청이 끝났거나 나에게 온 신청이 아니에요.');
  if(!accept){room.cancerInvites.delete(requestId);return {accepted:false,invite,message:'대결 신청을 거절했어요.'};}
  const source=sourceOverride||room.players.get(invite.fromId);
  if(!source?.connected||source.away||!target.connected||target.away)
    throw new GameError('두 친구가 접속 중일 때 대결할 수 있어요.');
  const level=ensureDuel(source,now);
  if(level!==invite.level)throw new GameError('신청자의 별자리 단계가 바뀌었어요. 다시 신청해 주세요.');
  eligible(room,source,target,level,now);
  let initiatorChoice=invite.choice,opponentChoice=targetChoice,rolls=[],won;
  if(level===2){
    if(!choices[2].includes(targetChoice))throw new GameError('가위·바위·보 중 하나를 골라 주세요.');
    if(initiatorChoice===targetChoice){room.cancerInvites.delete(requestId);
      return {accepted:true,tie:true,requestId,level,fromId:source.id,toId:target.id,fromNickname:source.nickname,toNickname:target.nickname,
        initiatorChoice,targetChoice,rolls:[],message:'비겼어요! 이번 주 능력은 남아 있으니 다시 신청해 주세요.'};}
    won=beats[initiatorChoice]===targetChoice;
  }else if(level===3){
    opponentChoice=other[initiatorChoice];
    const roll=die();if(!Number.isInteger(roll)||roll<1||roll>6)throw new GameError('동전 결과를 만들지 못했어요.');
    rolls=[roll];won=(roll%2===1?'heads':'tails')===initiatorChoice;
  }else if(level===4){
    opponentChoice=null;
    for(let attempt=0;attempt<20;attempt++){
      const a=die(),b=die();if(!Number.isInteger(a)||a<1||a>6||!Number.isInteger(b)||b<1||b>6)
        throw new GameError('주사위 결과를 만들지 못했어요.');
      rolls=[a,b];if(a!==b){won=a>b;break;}
    }
    if(won===undefined)throw new GameError('주사위가 계속 비겼어요. 다시 눌러 주세요.');
  }else{
    opponentChoice=other[initiatorChoice];
    const roll=die();if(!Number.isInteger(roll)||roll<1||roll>6)throw new GameError('홀짝 결과를 만들지 못했어요.');
    rolls=[roll];won=(roll%2===1?'odd':'even')===initiatorChoice;
  }
  const {win,loss}=weeklyAbilityFor('cancer',level);
  const deltaFrom=won?win:level===2?1:0,deltaTo=won?-loss:win;
  source.starShards+=deltaFrom;target.starShards+=deltaTo;
  const state=validateConstellationAbilityState(source.constellationAbilityState);
  source.constellationAbilityState={...state,usedWeek:constellationWeekStart(now),pending:null,
    lastResult:{constellationId:'cancer',level,roll:null,reward:deltaFrom,targetId:target.id,winnerId:won?source.id:target.id,
      choice:initiatorChoice,opponentChoice,rolls,deltaTo}};
  room.cancerInvites.delete(requestId);
  return {accepted:true,tie:false,requestId,level,fromId:source.id,toId:target.id,fromNickname:source.nickname,toNickname:target.nickname,
    initiatorChoice,opponentChoice,rolls,winnerId:won?source.id:target.id,deltaFrom,deltaTo,
    message:`${won?source.nickname:target.nickname}님이 이겼어요. ${source.nickname} ${deltaFrom>=0?'+':''}${deltaFrom}, ${target.nickname} ${deltaTo>=0?'+':''}${deltaTo} 별 파편`};
}
