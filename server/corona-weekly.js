import {SHARDS,SHOP} from '../shared/config.js';
import {constellationWeekStart} from '../shared/constellation-weekly-abilities.js';
import {constellationAbilityStatus,validateConstellationAbilityState} from './constellation-weekly-abilities.js';
import {GameError} from './pin-auth.js';

const DAY=86400000;
export const CROWN_ITEMS=new Set(['crown-food-card','crown-suit-card']);
const sundayAfter=now=>constellationWeekStart(now)+7*DAY;
const mondayAfter=now=>constellationWeekStart(now)+8*DAY;

export function useCoronaWeekly(player,choice,now=Date.now()){
  const status=constellationAbilityStatus(player,now),level=status.level;
  if(!status.canUse||status.constellationId!=='corona-borealis'||level<2||level>4)
    throw new GameError(status.message||'왕관자리 능력을 사용할 수 없어요.');
  const chosen=level===2?'food':level===3?'both':choice;
  if(level===4&&!['trial','both'].includes(chosen))throw new GameError('두 효과 중 하나를 골라 주세요.');
  const week=constellationWeekStart(now);
  // Lv2/3 items last 24 hours. Lv4 cards last at most five days and vanish at Sunday 00:00 KST.
  const expiresAt=chosen==='trial'?mondayAfter(now):chosen==='both'&&level===4?Math.min(now+5*DAY,sundayAfter(now)):now+DAY;
  if(chosen!=='trial'){
    const reward=chosen==='food'?[['crown-food-card',1]]:[['crown-food-card',level===4?2:1],['crown-suit-card',level===4?2:1]];
    if(reward.some(([id])=>player.inventory.some(entry=>entry.id===id)))
      throw new GameError('이전에 받은 기간제 카드가 남아 있어요. 만료된 뒤 다시 사용해 주세요.');
    for(const [id,quantity] of reward){
      const item=SHOP.items.find(entry=>entry.id===id),owned=player.inventory.find(entry=>entry.id===id);
      if(!item||(owned?owned.quantity+quantity>Math.min(SHOP.maxStack,item.maxOwned??Infinity):player.inventory.length+reward.filter(([key])=>!player.inventory.some(entry=>entry.id===key)).length>SHOP.maxKinds))
        throw new GameError('가방에 기간제 아이템을 담을 자리가 부족해요.');
    }
    for(const [id,quantity] of reward){
      const owned=player.inventory.find(entry=>entry.id===id);
      if(owned){owned.quantity+=quantity;owned.expiresAt=expiresAt;}
      else player.inventory.push({id,quantity,expiresAt});
    }
  }else{
    player.constellationAbilityState={...validateConstellationAbilityState(player.constellationAbilityState),
      coronaTrial:{week,endsAt:expiresAt,savedXp:player.avatar.xp,savedEquipmentSlots:[...player.equipmentSlots]}};
    player.equipmentSlots=[null,null,null];
    player.avatar={...player.avatar,level:1,xp:0,form:'asteroid'};
  }
  const state=validateConstellationAbilityState(player.constellationAbilityState);
  player.constellationAbilityState={...state,usedWeek:week,lastResult:{constellationId:'corona-borealis',level,roll:null,reward:0,choice:chosen,expiresAt},pending:null};
  return {choice:chosen,expiresAt,inventory:[...player.inventory],message:chosen==='trial'?
    '이번 주에는 Lv1 모습으로 지내요. 다음 주 월요일 0시에 Lv4로 돌아오며 별 파편 5개와 경험치 5를 받아요.':
    `기간제 우주 식량${chosen==='both'?'과 우주복을':'을'} ${level===4?'각 2개씩 ':''}받았어요.`};
}

export function coronaDue(room,now=Date.now()){
  return [...room.players.values()].some(p=>p.role==='student'&&(
    p.constellationAbilityState?.coronaTrial?.endsAt<=now||
    (p.constellationAbilityState?.coronaUnclaimed>0&&p.starShards<SHARDS.max)||
    p.inventory.some(entry=>CROWN_ITEMS.has(entry.id)&&entry.expiresAt<=now)
  ));
}
export function settleCorona(room,now=Date.now()){
  let changed=false;
  for(const player of room.players.values()){
    if(player.role!=='student')continue;
    let playerChanged=false;
    const state=validateConstellationAbilityState(player.constellationAbilityState);
    if(state.coronaTrial?.endsAt<=now){
      const trial=state.coronaTrial;
      // Temporary Lv1 XP can be earned, but cannot push restored Lv4 beyond its normal XP requirement.
      player.avatar={...player.avatar,level:4,form:'constellation',xp:Math.min(30,trial.savedXp+player.avatar.xp+5)};
      player.equipmentSlots=[...trial.savedEquipmentSlots];
      state.coronaTrial=null;
      state.coronaUnclaimed+=5;
      changed=true;playerChanged=true;
    }
    if(state.coronaUnclaimed>0&&player.starShards<SHARDS.max){
      const paid=Math.min(state.coronaUnclaimed,SHARDS.max-player.starShards);
      player.starShards+=paid;state.coronaUnclaimed-=paid;changed=true;playerChanged=true;
    }
    const before=player.inventory.length;
    player.inventory=player.inventory.filter(entry=>!CROWN_ITEMS.has(entry.id)||entry.expiresAt>now);
    if(player.inventory.length!==before){changed=true;playerChanged=true;}
    if(playerChanged)player.constellationAbilityState=state;
  }
  return changed;
}
export function crownPriorities(room){
  return [...room.players.values()].filter(p=>p.role==='student'&&p.avatar?.constellationId==='corona-borealis'&&p.avatar?.level===5)
    .map(p=>({id:p.id,nickname:p.nickname}));
}
