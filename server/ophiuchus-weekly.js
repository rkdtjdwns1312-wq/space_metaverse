import {randomInt} from 'node:crypto';
import {SHARDS} from '../shared/config.js';
import {constellationWeekStart,CONSTELLATION_WEEK_MS,weeklyAbilityFor} from '../shared/constellation-weekly-abilities.js';
import {constellationAbilityStatus,constellationChangedThisWeek,validateConstellationAbilityState,freshConstellationAbilityState,chooseConstellationItem} from './constellation-weekly-abilities.js';
import {GameError} from './pin-auth.js';
import {settleCetusUnclaimed} from './cetus-weekly.js';

const DAY=86400000;
const costOf=level=>({2:1,3:2,4:3})[level];
const students=room=>{
  const order=new Map([...room.allowedNames].map((name,index)=>[name,index]));
  return [...room.players.values()].filter(player=>player.role==='student')
    .sort((a,b)=>(order.get(a.nickname)??Infinity)-(order.get(b.nickname)??Infinity));
};
const active=(player,now)=>player.constellationAbilityState?.paralysis?.endsAt>now;

export function activeOphiuchusParalysis(player,now=Date.now()){
  const paralysis=player?.constellationAbilityState?.paralysis;
  return paralysis?.endsAt>now?{...paralysis,cost:costOf(paralysis.level)}:null;
}

export function ophiuchusCandidates(room,actor,level,now=Date.now()){
  return students(room).filter(player=>player.id!==actor.id&&!active(player,now)&&
    (level!==4||weeklyAbilityFor(player.avatar?.constellationId,player.avatar?.level).configured));
}

export function useOphiuchus(room,actor,{level,targetId}={},now=Date.now(),pick=randomInt){
  const status=constellationAbilityStatus(actor,now);
  if(status.constellationId!=='ophiuchus'||!status.canUse)throw new GameError(status.message||'뱀주인자리 능력을 사용할 수 없어요.');
  const slot=actor.avatar.level===5?level:actor.avatar.level;
  if(![2,3,4].includes(slot)||actor.avatar.level===5&&level!==slot||
    actor.avatar.level!==5&&level!==undefined&&level!==slot)throw new GameError('사용할 마비 단계를 골라 주세요.');
  const week=constellationWeekStart(now),state=validateConstellationAbilityState(actor.constellationAbilityState);
  const usedOnce=state.ophiuchus?.week===week&&state.ophiuchus.usedLevels.includes(slot);
  const praise=state.cetusPraise,bonusAllowed=usedOnce&&praise?.endsAt>now&&praise.eligibleWeek<=week&&!praise.bonusUsed&&
    !state.ophiuchus?.bonusUsedLevels?.includes(slot);
  if(usedOnce&&!bonusAllowed)throw new GameError('이번 주에 이미 사용한 마비 단계예요.');
  const candidates=ophiuchusCandidates(room,actor,slot,now);
  if(!candidates.length)throw new GameError('마비를 걸 수 있는 다른 학생이 없어요.');
  const target=slot===2?candidates.find(player=>player.id===targetId):candidates[pick(candidates.length)];
  if(!target||slot===2&&typeof targetId!=='string')throw new GameError('마비를 걸 다른 친구를 골라 주세요.');
  const targetState=validateConstellationAbilityState(target.constellationAbilityState);
  targetState.paralysis={level:slot,sourceId:actor.id,startsAt:now,endsAt:now+(slot===2?2:1)*DAY};
  if(slot===4)targetState.abilitySeal={sourceId:actor.id,endsAt:now+7*DAY};
  target.constellationAbilityState=targetState;
  const usedLevels=state.ophiuchus?.week===week?[...state.ophiuchus.usedLevels]:[];
  const bonusUsedLevels=state.ophiuchus?.week===week?[...(state.ophiuchus.bonusUsedLevels||[])]:[];
  if(bonusAllowed)bonusUsedLevels.push(slot);else usedLevels.push(slot);
  const copied=slot===4?{fromId:target.id,constellationId:target.avatar.constellationId,level:target.avatar.level,used:false,useCount:0,usedLevels:[],
    endsAt:now+7*DAY,state:freshConstellationAbilityState()}:state.ophiuchus?.copied?.endsAt>now?state.ophiuchus.copied:null;
  state.ophiuchus={week,usedLevels,bonusUsedLevels,copied};
  if(bonusAllowed&&bonusUsedLevels.length===(actor.avatar.level===5?3:1))state.cetusPraise.bonusUsed=true;
  actor.constellationAbilityState=state;
  return {...constellationAbilityStatus(actor,now),targetId:target.id,targetName:target.nickname,
    message:`${target.nickname} 친구에게 ${slot===2?'중급':slot===3?'하급':'고급'} 마비를 걸었어요.${slot===4?' 별자리 능력도 1주일간 봉인됐어요.':''}`};
}

export function clearOphiuchusParalysis(player,now=Date.now()){
  const current=activeOphiuchusParalysis(player,now);
  if(!current)throw new GameError('해제할 마비상태가 없어요.');
  if(!Number.isSafeInteger(player.starShards)||player.starShards<current.cost||player.starShards>SHARDS.max)throw new GameError(`별 파편 ${current.cost}개가 필요해요.`);
  const state=validateConstellationAbilityState(player.constellationAbilityState);
  player.starShards-=current.cost;state.paralysis=null;
  if(current.level===4&&state.abilitySeal?.sourceId===current.sourceId)state.abilitySeal=null;
  player.constellationAbilityState=state;
  return {starShards:player.starShards,message:`별 파편 ${current.cost}개로 마비상태를 해제했어요.`,paralysis:null};
}

export function borrowedOphiuchusActor(player,now=Date.now()){
  if(!player)throw new GameError('복사 능력을 사용한 친구가 교실에 없어요.');
  const outer=validateConstellationAbilityState(player.constellationAbilityState),copied=outer.ophiuchus?.copied;
  if(player.role!=='student'||player.avatar?.constellationId!=='ophiuchus'||!copied||copied.endsAt<=now||
    !player.connected||player.away||
    (player.avatar.blackStar&&!(copied.constellationId==='sagittarius'&&copied.level>=4))||
    outer.abilitySeal?.endsAt>now||constellationChangedThisWeek(player,now))
    throw new GameError('사용할 수 있는 복사 능력이 없어요.');
  const actor=new Proxy(player,{
    get(target,key){
      if(key==='avatar')return new Proxy(target.avatar,{
        get(avatar,field){
          if(field==='constellationId')return copied.constellationId;
          if(field==='level')return copied.level;
          return avatar[field];
        },
        set(avatar,field,value){
          if(field==='constellationId'||field==='level')throw new GameError('복사 능력으로 캐릭터 종류나 레벨을 바꿀 수 없어요.');
          avatar[field]=value;return true;
        }
      });
      if(key==='nativeAvatarLevel')return target.avatar.level;
      if(key==='constellationAbilityState')return copied.state;
      return target[key];
    },
    set(target,key,value){
      if(key==='constellationAbilityState'){
        copied.state=value;
        if(value?.ariesSleep?.endsAt>now){
          const native=validateConstellationAbilityState(target.constellationAbilityState);
          native.ariesSleep={...value.ariesSleep};target.constellationAbilityState=native;
        }
        if(value?.coronaTrial?.endsAt>now){
          const native=validateConstellationAbilityState(target.constellationAbilityState);
          native.coronaTrial={...value.coronaTrial,savedEquipmentSlots:[...value.coronaTrial.savedEquipmentSlots]};
          target.constellationAbilityState=native;
        }
        return true;
      }
      if(key==='avatar'){
        if(value?.level!==1||copied.constellationId!=='corona-borealis'||copied.level!==4)
          throw new GameError('복사 능력으로 캐릭터 레벨을 바꿀 수 없어요.');
        target.avatar={...target.avatar,level:1,xp:0,form:'asteroid'};return true;
      }
      target[key]=value;return true;
    }
  });
  const save=()=>{
    const current=validateConstellationAbilityState(player.constellationAbilityState);
    // 복사한 고래자리 보상은 임시 복사 상태가 교체되어도 사라지지 않도록 본인 장부로 옮깁니다.
    current.cetusUnclaimed+=copied.state.cetusUnclaimed??0;
    copied.state.cetusUnclaimed=0;
    current.ophiuchus.copied=copied;
    player.constellationAbilityState=validateConstellationAbilityState(current);
    settleCetusUnclaimed(player);
  };
  return {actor,copied,save};
}

// A copied Ophiuchus Lv4 may copy once more. Keep a single bounded active copy
// rather than persisting a recursive ability tree or extending the original week.
export function promoteBorrowedOphiuchusCopy(borrowed){
  const next=borrowed.copied.state.ophiuchus?.copied;
  if(!next)return false;
  next.endsAt=Math.min(next.endsAt,borrowed.copied.endsAt);
  Object.assign(borrowed.copied,next);
  borrowed.save();
  return true;
}

export function chooseCopiedOphiuchusItem(player,itemId,now=Date.now()){
  const {actor,copied,save}=borrowedOphiuchusActor(player,now);
  if(!copied.used||!copied.state.pending)throw new GameError('선택할 복사 능력 아이템이 없어요.');
  const result=chooseConstellationItem(actor,itemId,now);save();return {...result,borrowed:true};
}

export function ophiuchusTransferDue(room,now=Date.now()){
  return students(room).some(player=>player.constellationAbilityState?.paralysis?.level===3&&player.constellationAbilityState.paralysis.endsAt<=now);
}

export function settleOphiuchusTransfers(room,now=Date.now()){
  const roster=students(room),expired=roster.filter(player=>player.constellationAbilityState?.paralysis?.level===3&&player.constellationAbilityState.paralysis.endsAt<=now);
  let changed=false;
  for(const carrier of expired){
    const record=carrier.constellationAbilityState.paralysis;
    carrier.constellationAbilityState={...validateConstellationAbilityState(carrier.constellationAbilityState),paralysis:null};changed=true;
    if(roster.length<2)continue;
    const index=roster.findIndex(player=>player.id===carrier.id);
    const missedDays=Math.floor((now-record.endsAt)/DAY);
    let next=null;
    for(let nextIndex=index+1+missedDays;nextIndex<roster.length;nextIndex++){
      const candidate=roster[nextIndex];
      if(candidate.id!==record.sourceId&&!active(candidate,now)){next=candidate;break;}
    }
    if(next){
      const state=validateConstellationAbilityState(next.constellationAbilityState);
      const startsAt=record.endsAt+missedDays*DAY;
      state.paralysis={level:3,sourceId:record.sourceId,startsAt,endsAt:startsAt+DAY};
      next.constellationAbilityState=state;
    }
  }
  return changed;
}
