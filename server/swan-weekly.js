import {SHARDS,SHOP} from '../shared/config.js';
import {constellationWeekStart} from '../shared/constellation-weekly-abilities.js';
import {constellationChangedThisWeek,validateConstellationAbilityState} from './constellation-weekly-abilities.js';
import {GameError} from './pin-auth.js';

const DAY=86400000,HOUR=3600000,FRIDAY=5;
const currentDay=(now,week)=>Math.floor((now-week)/DAY);
const warningBefore=(room,player,start,end)=>[...room.planets.values()].some(planet=>(planet.warnings?.entries||[])
  .some(entry=>entry.targetId===player.id&&entry.at>=start&&entry.at<end));
const qualifying=(player,now)=>player.role==='student'&&!player.avatar?.teacherPreview&&
  player.avatar?.constellationId==='cygnus'&&[4,5].includes(player.avatar?.level)&&!constellationChangedThisWeek(player,now);

export function swanDailyDue(room,now=Date.now()){
  const week=constellationWeekStart(now);
  return [...room.players.values()].some(player=>{
    const ledger=player.constellationAbilityState?.swanDaily;
    if(ledger?.unclaimed&&player.starShards<SHARDS.max)return true;
    if(!qualifying(player,now))return false;
    if(!ledger||ledger.week!==week)return true;
    for(let day=1;day<=(player.avatar.level===4?5:4);day++){
      const cutoff=week+day*DAY+15*HOUR;
      if(now>=cutoff&&ledger.startedAt<=cutoff&&!(ledger.checkedMask&(1<<day)))return true;
    }
    return false;
  });
}

// Date-derived cutoffs and a persisted bitmask make reconnects/restarts idempotent.
// Inactive warning entries still count: deleting a warning never retroactively awards a calm day.
export function settleSwanDaily(room,now=Date.now()){
  const week=constellationWeekStart(now),awards=[];
  let changed=false;
  for(const player of room.players.values()){
    if(player.role!=='student')continue;
    const state=validateConstellationAbilityState(player.constellationAbilityState);
    let ledger=state.swanDaily;
    if(qualifying(player,now)){
      if(!ledger||ledger.week!==week){ledger={week,startedAt:now,checkedMask:0,awardedMask:0,unclaimed:ledger?.unclaimed??0,cardBought:false};changed=true;}
      for(let day=1;day<=(player.avatar.level===4?5:4);day++){
        const start=week+day*DAY,cutoff=start+15*HOUR,bit=1<<day;
        if(now<cutoff||ledger.startedAt>cutoff||ledger.checkedMask&bit)continue;
        ledger.checkedMask|=bit;changed=true;
        if(!player.avatar.blackStar&&!warningBefore(room,player,start,cutoff)){
          ledger.awardedMask|=bit;ledger.unclaimed++;awards.push({playerId:player.id,day});
        }
      }
    }
    if(ledger?.unclaimed&&player.starShards<SHARDS.max){
      const paid=Math.min(ledger.unclaimed,SHARDS.max-player.starShards);
      player.starShards+=paid;ledger.unclaimed-=paid;changed=true;
    }
    if(ledger!==state.swanDaily){state.swanDaily=ledger;player.constellationAbilityState=state;}
    else if(changed&&ledger)player.constellationAbilityState=state;
  }
  return {changed,awards};
}

export function swanCardOffer(room,player,now=Date.now()){
  const week=constellationWeekStart(now),day=currentDay(now,week),ledger=validateConstellationAbilityState(player.constellationAbilityState).swanDaily;
  if(!qualifying(player,now)||player.avatar.level!==5||player.avatar.blackStar||day<FRIDAY||day>6||ledger?.week!==week||ledger.cardBought)return false;
  return !warningBefore(room,player,week+DAY,week+FRIDAY*DAY);
}

export function buySwanStarCard(room,player,now=Date.now()){
  if(!swanCardOffer(room,player,now))throw new GameError('이번 주 별 카드 구매 기회가 없어요.');
  if(player.starShards<4)throw new GameError('별 카드를 사려면 별 파편 4개가 필요해요.');
  const item=SHOP.items.find(value=>value.id==='star-card'),owned=player.inventory.find(value=>value.id===item.id);
  if(owned?owned.quantity>=Math.min(SHOP.maxStack,item.maxOwned??Infinity):player.inventory.length>=SHOP.maxKinds)
    throw new GameError('가방에 별 카드를 담을 자리가 없어요.');
  player.starShards-=4;
  if(owned)owned.quantity++;else player.inventory.push({id:item.id,quantity:1});
  const state=validateConstellationAbilityState(player.constellationAbilityState);
  state.swanDaily.cardBought=true;player.constellationAbilityState=state;
  return {starShards:player.starShards,inventory:[...player.inventory],message:'별 파편 4개로 별 카드 1장을 구매했어요.'};
}

export function swanCampaignSigns(room,now=Date.now()){
  const week=constellationWeekStart(now);
  const signs=[...room.players.values()].filter(player=>player.role==='student').flatMap(player=>{
    const state=validateConstellationAbilityState(player.constellationAbilityState),result=state.lastResult;
    return state.usedWeek===week&&result?.constellationId==='cygnus'&&result.level===3&&result.approvedAt!==null?
      [{id:'swan-campaign-'+player.id,playerId:player.id,nickname:player.nickname,text:result.campaignText,approvedAt:result.approvedAt}]:[];
  }).sort((a,b)=>a.approvedAt-b.approvedAt||a.id.localeCompare(b.id));
  return signs.map((sign,index)=>{
    const angle=2*Math.PI*index/Math.max(signs.length,1)-Math.PI/2;
    return {...sign,x:1800+Math.cos(angle)*690,y:1320+Math.sin(angle)*390,radius:38,kind:'campaign-sign',name:`${sign.nickname}의 캠페인 푯말`};
  });
}
export function swanCampaignRequests(room,now=Date.now()){
  const week=constellationWeekStart(now);
  return [...room.players.values()].filter(player=>player.role==='student').flatMap(player=>{
    const state=validateConstellationAbilityState(player.constellationAbilityState),result=state.lastResult;
    return state.usedWeek===week&&result?.constellationId==='cygnus'&&result.level===3&&result.approvedAt===null?
      [{playerId:player.id,nickname:player.nickname,text:result.campaignText,submittedAt:result.submittedAt}]:[];
  }).sort((a,b)=>a.submittedAt-b.submittedAt);
}
