import {randomInt} from 'node:crypto';
import {SHARDS} from '../shared/config.js';
import {constellationWeekStart} from '../shared/constellation-weekly-abilities.js';
import {constellationAbilityStatus,validateConstellationAbilityState} from './constellation-weekly-abilities.js';
import {gainExperience} from './progression.js';
import {GameError} from './pin-auth.js';

const DAY=86400000;
const students=room=>[...room.players.values()].filter(player=>player.role==='student');

export function useLeoChallenge(room,actor,{targetIds}={},now=Date.now(),pick=randomInt){
  const status=constellationAbilityStatus(actor,now),level=actor.avatar?.level;
  if(status.constellationId!=='leo'||!status.canUse)throw new GameError(status.message||'사자자리 능력을 사용할 수 없어요.');
  const count=level===4?1:2,candidates=students(room).filter(player=>player.id!==actor.id&&(level<4||player.avatar?.level<=3));
  if(candidates.length<count)throw new GameError(`도전 상태를 줄 수 있는 친구가 ${count}명 필요해요.`);
  let selected;
  if(level<4){
    const pool=[...candidates];selected=[];
    for(let i=0;i<count;i++){const index=pick(pool.length);selected.push(pool.splice(index,1)[0]);}
  }else{
    if(!Array.isArray(targetIds)||targetIds.length!==count||new Set(targetIds).size!==count)throw new GameError(`${count}명의 다른 친구를 골라 주세요.`);
    selected=targetIds.map(id=>candidates.find(player=>player.id===id));
    if(selected.some(player=>!player))throw new GameError('Lv3 이하의 다른 친구를 골라 주세요.');
  }
  const state=validateConstellationAbilityState(actor.constellationAbilityState),week=constellationWeekStart(now);
  for(const target of selected){
    const targetState=validateConstellationAbilityState(target.constellationAbilityState);
    targetState.leoChallenges=targetState.leoChallenges.filter(entry=>entry.endsAt>now);
    if(targetState.leoChallenges.length>=100)throw new GameError('친구에게 적용 중인 도전이 너무 많아요.');
    targetState.leoChallenges.push({sourceId:actor.id,level,startsAt:now,endsAt:now+DAY,rewarded:false});
    target.constellationAbilityState=targetState;
  }
  state.usedWeek=week;state.lastResult={constellationId:'leo',level,roll:null,reward:0,targetIds:selected.map(player=>player.id)};
  actor.constellationAbilityState=state;
  return {...constellationAbilityStatus(actor,now),targetIds:selected.map(player=>player.id),targetNames:selected.map(player=>player.nickname),
    message:`${selected.map(player=>player.nickname).join(', ')} 친구에게 ${level===2?'하급':level===3?'중급':'고급'} 도전을 걸었어요.`};
}

export function settleLeoUnclaimed(player){
  const state=player.constellationAbilityState;
  if(!state?.leoUnclaimed||player.starShards>=SHARDS.max)return 0;
  const credited=Math.min(state.leoUnclaimed,SHARDS.max-player.starShards);
  player.starShards+=credited;state.leoUnclaimed-=credited;
  return credited;
}

function creditShards(player,amount){
  const state=validateConstellationAbilityState(player.constellationAbilityState);
  state.leoUnclaimed+=amount;
  if(state.leoUnclaimed>1000000)throw new GameError('도전 보상이 너무 많이 쌓였어요. 선생님께 알려주세요.');
  player.constellationAbilityState=state;
  settleLeoUnclaimed(player);
}

// Only call on the first working -> submitted transition of an actual assignment.
export function rewardLeoSubmission(room,student,now=Date.now()){
  const state=validateConstellationAbilityState(student.constellationAbilityState),rewards=[],credits=new Map();
  let studentShards=0,studentXp=0;
  for(const challenge of state.leoChallenges){
    if(challenge.rewarded||challenge.startsAt>now||challenge.endsAt<=now)continue;
    const caster=room.players.get(challenge.sourceId);
    if(caster?.role!=='student')continue;
    challenge.rewarded=true;
    if(challenge.level===3)studentShards++;
    if(challenge.level>=4)studentXp+=4;
    credits.set(caster,(credits.get(caster)||0)+(challenge.level>=4?4:1));
    rewards.push({sourceId:caster.id,level:challenge.level});
  }
  student.constellationAbilityState=state;
  if(studentXp)student.avatar=gainExperience(student.avatar,studentXp);
  if(studentShards)creditShards(student,studentShards);
  for(const [caster,amount] of credits)creditShards(caster,amount);
  return rewards;
}
