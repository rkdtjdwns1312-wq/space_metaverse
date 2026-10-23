import {randomInt,randomUUID} from 'node:crypto';
import {SHARDS,SHOP} from '../shared/config.js';
import {weeklyAbilityFor,constellationWeekStart,CONSTELLATION_WEEK_MS,corvusBudget} from '../shared/constellation-weekly-abilities.js';
import {GameError} from './pin-auth.js';

export const freshConstellationAbilityState=()=>({usedWeek:null,lastResult:null,pending:null,changedWeek:null,warningWeek:null,warningCount:0,blackWeek:null,swanDaily:null,coronaTrial:null,coronaUnclaimed:0,ariesSleep:null,ariesUnclaimed:0,ophiuchus:null,paralysis:null,abilitySeal:null,leoChallenges:[],leoUnclaimed:0});
const validWeek=week=>week===null||(Number.isSafeInteger(week)&&week>=0&&week<=8640000000000000-CONSTELLATION_WEEK_MS&&constellationWeekStart(week)===week);
function invalidCancerResult(result,level){
  const {roll,reward,targetId,winnerId,choice,opponentChoice,rolls,deltaTo}=result;
  const win={2:1,3:2,4:4,5:6}[level],loss={2:0,3:1,4:2,5:3}[level];
  const sourceWon=winnerId!==targetId;
  if(roll!==null||typeof targetId!=='string'||!targetId||typeof winnerId!=='string'||!winnerId||
    !Array.isArray(rolls)||rolls.length!==(level===2?0:level===4?2:1)||
    rolls.some(n=>!Number.isInteger(n)||n<1||n>6)||
    reward!==(sourceWon?win:level===2?1:0)||deltaTo!==(sourceWon?-loss:win))return true;
  if(level===2){
    if(!['rock','paper','scissors'].includes(choice)||!['rock','paper','scissors'].includes(opponentChoice)||choice===opponentChoice)return true;
    return sourceWon!==({rock:'scissors',paper:'rock',scissors:'paper'}[choice]===opponentChoice);
  }
  if(level===3)return !['heads','tails'].includes(choice)||opponentChoice===(choice)||
    !['heads','tails'].includes(opponentChoice)||sourceWon!==((rolls[0]%2===1?'heads':'tails')===choice);
  if(level===4)return choice!==null||opponentChoice!==null||rolls[0]===rolls[1]||sourceWon!==(rolls[0]>rolls[1]);
  return !['odd','even'].includes(choice)||!['odd','even'].includes(opponentChoice)||opponentChoice===choice||
    sourceWon!==((rolls[0]%2===1?'odd':'even')===choice);
}
export function validateSwanDaily(value){
  if(value==null)return null;
  if(!value||typeof value!=='object'||Array.isArray(value)||!validWeek(value.week)||value.week===null||
    !Number.isSafeInteger(value.startedAt)||value.startedAt<value.week||
    !Number.isInteger(value.checkedMask)||value.checkedMask<0||value.checkedMask>62||
    !Number.isInteger(value.awardedMask)||value.awardedMask<0||value.awardedMask>62||
    (value.awardedMask&value.checkedMask)!==value.awardedMask||
    !Number.isSafeInteger(value.unclaimed)||value.unclaimed<0||value.unclaimed>10000||typeof value.cardBought!=='boolean')
    throw Error('백조자리 자동 보상 저장 데이터가 올바르지 않습니다.');
  return {week:value.week,startedAt:value.startedAt,checkedMask:value.checkedMask,awardedMask:value.awardedMask,unclaimed:value.unclaimed,cardBought:value.cardBought};
}
// Return only numeric values: private recipe ingredients never leave the server.
export function corvusChoices(recipes=[]){
  const cache=new Map(),visiting=new Set();
  const valueOf=id=>{
    if(cache.has(id))return cache.get(id);
    const item=SHOP.items.find(i=>i.id===id);
    if(!item||visiting.has(id))return null;
    if(item.level===1)return Number.isSafeInteger(item.price)&&item.price>0?item.price:null;
    visiting.add(id);
    const values=recipes.filter(r=>r.output?.id===id&&!r.currency&&!r.cosmicEnergy&&(r.output.quantity??1)===1).map(r=>{
      if(!Array.isArray(r.ingredients)||!r.ingredients.length)return null;
      let sum=1;
      for(const part of r.ingredients){const ingredient=SHOP.items.find(i=>i.id===part.id),value=valueOf(part.id);
        if(!ingredient||ingredient.level>=item.level||value===null||!Number.isSafeInteger(part.quantity)||part.quantity<1||part.quantity>99)return null;
        sum+=value*part.quantity;
      }
      return Number.isSafeInteger(sum)?sum:null;
    }).filter(v=>v!==null);
    visiting.delete(id);const value=values.length?Math.min(...values):null;cache.set(id,value);return value;
  };
  return SHOP.items.filter(item=>!item.shopHidden).map(item=>({id:item.id,value:valueOf(item.id)})).filter(v=>v.value!==null&&v.value>0);
}
export function validateConstellationAbilityState(value){
  if(value===undefined)return freshConstellationAbilityState();
  const bad=()=>{throw Error('별자리 주간 능력 저장 데이터가 올바르지 않습니다.');};
  if(!value||typeof value!=='object'||Array.isArray(value))bad();
  const {usedWeek,lastResult}=value;
  const trial=value.coronaTrial??null;
  if(trial&&(!validWeek(trial.week)||trial.week===null||trial.endsAt!==trial.week+8*86400000||
    !Number.isSafeInteger(trial.savedXp)||trial.savedXp<0||trial.savedXp>30||
    (trial.savedLevel!==undefined&&(!Number.isInteger(trial.savedLevel)||trial.savedLevel<4||trial.savedLevel>5))||
    !Array.isArray(trial.savedEquipmentSlots)||trial.savedEquipmentSlots.length!==3||
    trial.savedEquipmentSlots.some(id=>id!==null&&typeof id!=='string')))bad();
  const unclaimed=value.coronaUnclaimed??0;
  if(!Number.isSafeInteger(unclaimed)||unclaimed<0||unclaimed>1000000)bad();
  const sleep=value.ariesSleep??null,sleepUnclaimed=value.ariesUnclaimed??0;
  if(sleep&&(!sleep||typeof sleep!=='object'||Array.isArray(sleep)||typeof sleep.sourceId!=='string'||!sleep.sourceId||
    !Number.isSafeInteger(sleep.startsAt)||sleep.startsAt<0||!Number.isSafeInteger(sleep.endsAt)||sleep.endsAt<=sleep.startsAt||
    sleep.endsAt-sleep.startsAt>3*86400000||!Number.isInteger(sleep.reward)||sleep.reward<0||sleep.reward>3||
    ![0,1].includes(sleep.wakeCost)))bad();
  if(!Number.isSafeInteger(sleepUnclaimed)||sleepUnclaimed<0||sleepUnclaimed>1000000)bad();
  const serpent=value.ophiuchus??null,paralysis=value.paralysis??null,seal=value.abilitySeal??null;
  const challenges=value.leoChallenges??[],leoUnclaimed=value.leoUnclaimed??0;
  if(!Array.isArray(challenges)||challenges.length>100||challenges.some(entry=>!entry||typeof entry.sourceId!=='string'||!entry.sourceId||
    ![2,3,4,5].includes(entry.level)||!Number.isSafeInteger(entry.startsAt)||entry.startsAt<0||
    !Number.isSafeInteger(entry.endsAt)||entry.endsAt!==entry.startsAt+86400000||typeof entry.rewarded!=='boolean')||
    !Number.isSafeInteger(leoUnclaimed)||leoUnclaimed<0||leoUnclaimed>1000000)bad();
  if(serpent&&(!validWeek(serpent.week)||serpent.week===null||!Array.isArray(serpent.usedLevels)||serpent.usedLevels.length>3||
    new Set(serpent.usedLevels).size!==serpent.usedLevels.length||serpent.usedLevels.some(n=>![2,3,4].includes(n))||
    (serpent.copied!==null&&serpent.copied!==undefined&&(!serpent.copied||typeof serpent.copied.fromId!=='string'||!serpent.copied.fromId||
      typeof serpent.copied.constellationId!=='string'||!weeklyAbilityFor(serpent.copied.constellationId,serpent.copied.level).configured||
      typeof serpent.copied.used!=='boolean'||
      !Number.isInteger(serpent.copied.useCount??0)||(serpent.copied.useCount??0)<0||(serpent.copied.useCount??0)>3||
      !Array.isArray(serpent.copied.usedLevels??[])||(serpent.copied.usedLevels??[]).length>3||
      new Set(serpent.copied.usedLevels??[]).size!==(serpent.copied.usedLevels??[]).length||
      (serpent.copied.usedLevels??[]).some(level=>![2,3,4].includes(level))||
      (serpent.copied.usedLevels??[]).length>0&&serpent.copied.constellationId!=='ophiuchus'||
      !Number.isSafeInteger(serpent.copied.endsAt)||serpent.copied.endsAt<serpent.week||serpent.copied.endsAt>serpent.week+2*CONSTELLATION_WEEK_MS||
      !serpent.copied.state||serpent.copied.state.ophiuchus?.copied!=null))))bad();
  if(serpent?.copied)validateConstellationAbilityState(serpent.copied.state);
  if(paralysis&&(![2,3,4].includes(paralysis.level)||typeof paralysis.sourceId!=='string'||!paralysis.sourceId||
    !Number.isSafeInteger(paralysis.startsAt)||paralysis.startsAt<0||!Number.isSafeInteger(paralysis.endsAt)||paralysis.endsAt<=paralysis.startsAt||
    paralysis.endsAt-paralysis.startsAt>(paralysis.level===2?2:1)*86400000))bad();
  if(seal&&(!Number.isSafeInteger(seal.endsAt)||seal.endsAt<0||typeof seal.sourceId!=='string'||!seal.sourceId))bad();
  const extra={changedWeek:value.changedWeek??null,warningWeek:value.warningWeek??null,warningCount:value.warningCount??0,blackWeek:value.blackWeek??null,swanDaily:validateSwanDaily(value.swanDaily),coronaTrial:trial?{week:trial.week,endsAt:trial.endsAt,savedXp:trial.savedXp,savedLevel:trial.savedLevel??4,savedEquipmentSlots:[...trial.savedEquipmentSlots]}:null,coronaUnclaimed:unclaimed,
    ariesSleep:sleep?{sourceId:sleep.sourceId,startsAt:sleep.startsAt,endsAt:sleep.endsAt,reward:sleep.reward,wakeCost:sleep.wakeCost}:null,ariesUnclaimed:sleepUnclaimed,
    ophiuchus:serpent?{week:serpent.week,usedLevels:[...serpent.usedLevels],copied:serpent.copied?{
      fromId:serpent.copied.fromId,constellationId:serpent.copied.constellationId,level:serpent.copied.level,
      used:serpent.copied.used,useCount:serpent.copied.useCount??0,usedLevels:[...(serpent.copied.usedLevels??[])],
      endsAt:serpent.copied.endsAt,state:validateConstellationAbilityState(serpent.copied.state)}:null}:null,
    paralysis:paralysis?{level:paralysis.level,sourceId:paralysis.sourceId,startsAt:paralysis.startsAt,endsAt:paralysis.endsAt}:null,
    abilitySeal:seal?{sourceId:seal.sourceId,endsAt:seal.endsAt}:null,
    leoChallenges:challenges.map(entry=>({sourceId:entry.sourceId,level:entry.level,startsAt:entry.startsAt,endsAt:entry.endsAt,rewarded:entry.rewarded})),leoUnclaimed};
  if(!validWeek(extra.changedWeek)||!validWeek(extra.warningWeek)||!validWeek(extra.blackWeek)||!Number.isInteger(extra.warningCount)||extra.warningCount<0||extra.warningCount>2||(extra.warningWeek===null)!==(extra.warningCount===0))bad();
  if(usedWeek===null){if(lastResult!==null||value.pending!=null)bad();return {...freshConstellationAbilityState(),...extra};}
  if(!Number.isSafeInteger(usedWeek)||usedWeek<0||usedWeek>8640000000000000-CONSTELLATION_WEEK_MS||constellationWeekStart(usedWeek)!==usedWeek)bad();
  if(!lastResult||typeof lastResult!=='object'||Array.isArray(lastResult))bad();
  const {constellationId,level,roll,reward}=lastResult,ability=weeklyAbilityFor(constellationId,level);
  if(!ability.configured||!Number.isSafeInteger(reward))bad();
  if(ability.rollCount){
    if(!Array.isArray(lastResult.rolls)||lastResult.rolls.length!==ability.rollCount||lastResult.rolls.some(n=>!Number.isInteger(n)||n<1||n>6)||roll!==lastResult.rolls[0]||
      reward!==(ability.card?0:Math.abs(lastResult.rolls[0]-lastResult.rolls[1])))bad();
  }else if(ability.challenge?(roll!==null||reward!==0||!Array.isArray(lastResult.targetIds)||
    lastResult.targetIds.length!==(level===4?1:2)||new Set(lastResult.targetIds).size!==lastResult.targetIds.length||
    lastResult.targetIds.some(id=>typeof id!=='string'||!id)):
    ability.corona?(roll!==null||reward!==0||!['food','both','trial'].includes(lastResult.choice)||
    (level===2&&lastResult.choice!=='food')||(level===3&&lastResult.choice!=='both')||
    (level===4&&!['both','trial'].includes(lastResult.choice))||
    !Number.isSafeInteger(lastResult.expiresAt)||lastResult.expiresAt<=usedWeek):
    ability.cancerDuel?invalidCancerResult(lastResult,level):
    ability.sleep?(roll!==null||reward!==0||!Number.isInteger(lastResult.days)||lastResult.days<1||lastResult.days>3||
      (level===2&&(lastResult.days!==1||typeof lastResult.targetId!=='string'||!lastResult.targetId))||
      (level===3&&lastResult.targetId!==undefined)||
      (level>=4&&(lastResult.days!==1||!Array.isArray(lastResult.targetIds)||lastResult.targetIds.length<1||
        lastResult.targetIds.length>(level===4?6:10)||new Set(lastResult.targetIds).size!==lastResult.targetIds.length||
        lastResult.targetIds.some(id=>typeof id!=='string'||!id)))):
    ability.compliment?(roll!==null||reward!==1||!Number.isInteger(lastResult.uses)||lastResult.uses<1||lastResult.uses>2||typeof lastResult.targetId!=='string'||!lastResult.targetId):
    ability.campaign?(roll!==null||![0,3].includes(reward)||typeof lastResult.campaignText!=='string'||lastResult.campaignText.length<1||lastResult.campaignText.length>80||
      !Number.isSafeInteger(lastResult.submittedAt)||lastResult.submittedAt<usedWeek||
      (reward===3?!Number.isSafeInteger(lastResult.approvedAt)||lastResult.approvedAt<lastResult.submittedAt:lastResult.approvedAt!==null)):
    ability.pair?(roll!==null||reward!==0||typeof lastResult.targetId!=='string'||!lastResult.targetId):
    ability.warningHunter?(roll!==null||reward!==0||!Number.isInteger(lastResult.uses)||lastResult.uses<1||lastResult.uses>ability.uses||
      !['warning','black-star','department'].includes(lastResult.mode)||
      (level<=3&&lastResult.mode!=='warning')||(level===4&&lastResult.mode!=='black-star')||
      (level===5&&lastResult.mode==='warning')||(lastResult.mode==='department'&&lastResult.uses!==ability.uses)||
      (lastResult.mode==='warning'&&(typeof lastResult.warningId!=='string'||!lastResult.warningId))||
      (lastResult.mode==='department'&&(typeof lastResult.planetId!=='string'||!lastResult.planetId))):
    (ability.dice?(!Number.isInteger(roll)||roll<1||roll>6||reward!==(ability.craft?0:ability.rewards[roll-1])):(roll!==null||reward!==(ability.copy||ability.manualXp?0:ability.reward))))bad();
  const result={constellationId,level,roll,reward};
  if(ability.corona){result.choice=lastResult.choice;result.expiresAt=lastResult.expiresAt;}
  if(ability.challenge)result.targetIds=[...lastResult.targetIds];
  if(ability.sleep){result.days=lastResult.days;if(lastResult.targetId)result.targetId=lastResult.targetId;if(lastResult.targetIds)result.targetIds=[...lastResult.targetIds];}
  if(ability.cancerDuel){result.targetId=lastResult.targetId;result.winnerId=lastResult.winnerId;result.choice=lastResult.choice;result.opponentChoice=lastResult.opponentChoice;result.rolls=[...lastResult.rolls];result.deltaTo=lastResult.deltaTo;}
  if(ability.compliment){result.uses=lastResult.uses;result.targetId=lastResult.targetId;}
  if(ability.campaign){result.campaignText=lastResult.campaignText;result.submittedAt=lastResult.submittedAt;result.approvedAt=lastResult.approvedAt;}
  if(ability.pair)result.targetId=lastResult.targetId;
  if(ability.warningHunter){result.mode=lastResult.mode;result.uses=lastResult.uses;if(lastResult.warningId)result.warningId=lastResult.warningId;if(lastResult.planetId)result.planetId=lastResult.planetId;}
  if(ability.rollCount)result.rolls=[...lastResult.rolls];
  if(ability.card){
    const itemId=new Set(lastResult.rolls).size<ability.rollCount?'silver-draw-card':'star-card';
    if(lastResult.itemId!==itemId)bad();result.itemId=itemId;
  }
  if(ability.craft||ability.copy){
    if(lastResult.budget!==(ability.copy?ability.budget:corvusBudget(level,roll)))bad();result.budget=lastResult.budget;
    if(lastResult.itemId!==undefined){if(!SHOP.items.some(i=>i.id===lastResult.itemId))bad();result.itemId=lastResult.itemId;}
  }
  let pending=null;
  if(value.pending!=null){
    const p=value.pending;
    if(!(ability.craft||ability.copy)||p.mode!==(ability.copy?'copy':'craft')||result.itemId||p.week!==usedWeek||p.budget!==result.budget||p.roll!==roll||p.budget<=0||!Array.isArray(p.choices)||!p.choices.length||p.choices.length>SHOP.items.length)bad();
    const ids=new Set();
    for(const choice of p.choices){if(!choice||ids.has(choice.id)||!SHOP.items.some(i=>i.id===choice.id)||!Number.isSafeInteger(choice.value)||choice.value<1||choice.value>p.budget)bad();ids.add(choice.id);}
    pending={week:usedWeek,budget:p.budget,roll,mode:p.mode,choices:p.choices.map(({id,value})=>({id,value}))};
  }
  return {usedWeek,lastResult:result,pending,...extra};
}
export const constellationChangedThisWeek=(player,now=Date.now())=>{
  const week=player.constellationAbilityState?.changedWeek;
  return week!=null&&week>=constellationWeekStart(now);
};
export function markConstellationChange(player,now=Date.now()){
  if(player.role!=='student')return;
  const state=validateConstellationAbilityState(player.constellationAbilityState);
  player.constellationAbilityState={...state,changedWeek:Math.max(state.changedWeek??0,constellationWeekStart(now))};
}
function denial(player,ability,state,week,now){
  if(player.role!=='student'||player.avatar?.teacherPreview)return '학생만 별자리 능력 보상을 받을 수 있어요.';
  if(!player.connected||player.away)return '먼저 교실에 입장해주세요.';
  if(constellationChangedThisWeek(player,week))return '별자리를 바꾼 주에는 능력을 사용할 수 없어요. 다음 일요일에 다시 사용할 수 있어요.';
  if(state.abilitySeal?.endsAt>now)return '뱀주인자리의 고급 마비로 별자리 능력이 봉인됐어요.';
  if(ability.corona&&ability.passive)return '자리·급식 우선권이 항상 적용돼요. 선생님이 현실 교실에서 확인해 주세요.';
  if(ability.passive)return '경고를 받을 때 자동으로 적용되는 능력이에요.';
  if(ability.swanDaily)return '오후 3시에 자동으로 판정하는 능력이에요.';
  if(player.avatar?.blackStar&&!ability.warningHunter)return '검은별 상태에서는 능력을 사용할 수 없어요.';
  if(state.ariesSleep?.endsAt>now)return '수면 중에는 별자리 능력을 사용할 수 없어요.';
  if(ability.paralysis){
    const allowed=player.avatar.level===5?[2,3,4]:[player.avatar.level];
    if(allowed.every(level=>state.ophiuchus?.week===week&&state.ophiuchus.usedLevels.includes(level)))return '이번 주 뱀주인자리 능력을 모두 사용했어요.';
  }
  if(!ability.configured)return '이 별자리의 능력은 준비 중이에요.';
  if(state.usedWeek!==null&&state.usedWeek>=week&&!ability.paralysis&&!(ability.warningHunter&&state.usedWeek===week&&state.lastResult?.constellationId==='sagittarius'&&state.lastResult.level===player.avatar?.level&&state.lastResult.uses<ability.uses&&state.lastResult.mode!=='department')&&
    !(ability.compliment&&state.usedWeek===week&&state.lastResult?.constellationId==='cygnus'&&state.lastResult.level===2&&state.lastResult.uses<2))return '이번 주 별자리 능력은 이미 사용했어요. 다음 일요일에 다시 쓸 수 있어요.';
  if(!Number.isSafeInteger(player.starShards)||player.starShards<0||player.starShards>SHARDS.max)return '별 파편 잔액을 확인해주세요.';
  if(player.starShards<ability.minBalance)return `주사위를 굴리려면 별 파편 ${ability.minBalance}개가 있어야 해요.`;
  if(player.starShards>SHARDS.max-ability.maxReward)return '별 파편을 더 담을 수 없어요.';
  return null;
}
export function constellationAbilityStatus(player,now=Date.now()){
  const level=player.avatar?.level??1,constellationId=player.avatar?.constellationId??null;
  const ability=weeklyAbilityFor(constellationId,level),state=validateConstellationAbilityState(player.constellationAbilityState),week=constellationWeekStart(now);
  const message=denial(player,ability,state,week,now);
  const warningUsed=state.warningWeek!==null&&state.warningWeek>=week?state.warningCount:0,blackUsed=state.blackWeek!==null&&state.blackWeek>=week?1:0;
  const sameWeek=state.usedWeek!==null&&state.usedWeek>=week;
  const used=ability.paralysis?(level===5?[2,3,4]:[level]).every(slot=>state.ophiuchus?.week===week&&state.ophiuchus.usedLevels.includes(slot)):
    ability.swanDaily?false:ability.passive?warningUsed>=ability.warningLimit&&blackUsed>=ability.blackLimit:
    ability.compliment&&sameWeek&&state.lastResult?.constellationId==='cygnus'&&state.lastResult.level===2?state.lastResult.uses>=2:
    ability.warningHunter&&sameWeek&&state.lastResult?.constellationId==='sagittarius'&&state.lastResult.level===level?
      state.lastResult.uses>=ability.uses||state.lastResult.mode==='department':sameWeek;
  const blockedByChange=constellationChangedThisWeek(player,now),day=new Date(now+9*3600000).getUTCDay();
  const pending=state.pending?.week===week?state.pending:null;
  const lastResult=!ability.passive&&sameWeek&&state.lastResult?(()=>{
    const {roll,rolls,reward,budget,itemId,targetId,constellationId,mode,uses,planetId,warningId,campaignText,approvedAt}=state.lastResult;
    return {roll,reward,...(rolls?{rolls}:{}),...(budget!==undefined?{budget,mode:constellationId==='gemini'?'copy':'craft'}:{}),...(itemId?{itemId}:{}),...(targetId?{targetId}:{}),...(constellationId==='sagittarius'?{mode,uses,planetId,warningId}:{}),...(constellationId==='cygnus'&&level===2?{uses}:{}),...(campaignText?{campaignText,approved:approvedAt!==null}:{}),...(constellationId==='corona-borealis'?{choice:state.lastResult.choice,expiresAt:state.lastResult.expiresAt}:{}),...(constellationId==='aries'?{days:state.lastResult.days,targetIds:state.lastResult.targetIds}:{}),...(constellationId==='cancer'?{winnerId:state.lastResult.winnerId,choice:state.lastResult.choice,opponentChoice:state.lastResult.opponentChoice,deltaTo:state.lastResult.deltaTo}:{} )};
  })():null;
  return {configured:ability.configured,used,canUse:!message,passive:!!ability.passive||!!ability.swanDaily,blockedByChange,
    uses:(ability.warningHunter||ability.compliment)&&sameWeek&&state.lastResult?.constellationId===constellationId?state.lastResult.uses:0,useLimit:ability.warningHunter||ability.compliment?ability.uses:0,
    warningUsed,warningLimit:ability.warningLimit??0,blackUsed,blackLimit:ability.blackLimit??0,
    ophiuchus:ability.paralysis?{usedLevels:state.ophiuchus?.week===week?[...state.ophiuchus.usedLevels]:[],
      copied:state.ophiuchus?.copied?.endsAt>now?(()=>{const copied=state.ophiuchus.copied,pending=copied.state.pending;
        return {fromId:copied.fromId,constellationId:copied.constellationId,level:copied.level,used:copied.used,endsAt:copied.endsAt,
          usedLevels:copied.constellationId==='ophiuchus'?[...copied.usedLevels]:[],
          description:weeklyAbilityFor(copied.constellationId,copied.level).description,
          pending:pending?{mode:pending.mode,choices:pending.choices.map(({id,value})=>({id,name:SHOP.items.find(item=>item.id===id)?.name||id,value}))}:null};})():null}:null,
    paralysis:state.paralysis?.endsAt>now?{level:state.paralysis.level,endsAt:state.paralysis.endsAt,cost:state.paralysis.level===2?1:state.paralysis.level===3?2:3}:null,
    remindUnused:ability.configured&&!ability.passive&&!used&&!blockedByChange&&player.role==='student'&&!player.avatar?.teacherPreview&&(!player.avatar?.blackStar||!!ability.warningHunter)&&player.connected&&!player.away&&(day===5||day===6),
    description:ability.description,level,constellationId,nextResetAt:Math.max(week,state.usedWeek??week,state.changedWeek??week,state.warningWeek??week,state.blackWeek??week)+CONSTELLATION_WEEK_MS,
    swanDaily:ability.swanDaily?{checkedMask:state.swanDaily?.week===week?state.swanDaily.checkedMask:0,awardedMask:state.swanDaily?.week===week?state.swanDaily.awardedMask:0,unclaimed:state.swanDaily?.unclaimed??0,cardBought:state.swanDaily?.week===week?state.swanDaily.cardBought:false}:null,
    coronaTrial:state.coronaTrial?{endsAt:state.coronaTrial.endsAt}:null,coronaUnclaimed:state.coronaUnclaimed,
    ariesSleep:state.ariesSleep?.endsAt>now?{endsAt:state.ariesSleep.endsAt,wakeCost:state.ariesSleep.wakeCost,reward:state.ariesSleep.reward}:null,ariesUnclaimed:state.ariesUnclaimed,
    lastResult,pending:pending?{budget:pending.budget,roll:pending.roll,mode:pending.mode,expiresAt:pending.week+CONSTELLATION_WEEK_MS}:null,
    choices:pending?pending.choices.map(({id,value})=>{const item=SHOP.items.find(i=>i.id===id),owned=player.inventory?.find(i=>i.id===id);
      return {id,name:item.name,level:item.level,value,icon:item.icon,art:item.art,available:!blockedByChange&&player.role==='student'&&!player.avatar?.teacherPreview&&player.connected&&!player.away&&!player.avatar?.blackStar&&(pending.mode!=='copy'||owned?.quantity>0)&&(owned?owned.quantity<Math.min(SHOP.maxStack,item.maxOwned??Infinity):player.inventory.length<SHOP.maxKinds)};
    }):[],message:pending&&!blockedByChange?`아이템 1개를 골라 ${pending.mode==='copy'?'복사':'제작'}를 마쳐 주세요. 다음 일요일에는 선택 대기가 만료돼요.`:message};
}
// Synchronous transaction owned by action(): currency and the common week stamp save together.
export function useConstellationAbility(player,now=Date.now(),die=()=>randomInt(1,7),recipes=[]){
  const status=constellationAbilityStatus(player,now);
  if(!status.canUse)throw new GameError(status.message);
  const ability=weeklyAbilityFor(status.constellationId,status.level);
  if(ability.pair)throw new GameError('짝이 될 친구를 골라 신청해 주세요.');
  if(ability.cancerDuel)throw new GameError('대결할 친구를 골라 신청해 주세요.');
  if(ability.warningHunter)throw new GameError('삭제할 내 경고 또는 검은별을 골라주세요.');
  if(ability.compliment)throw new GameError('칭찬할 친구와 메시지를 골라주세요.');
  if(ability.campaign)throw new GameError('캠페인 푯말 문구를 작성해 주세요.');
  if(ability.swanDaily)throw new GameError('백조자리 자동 보상은 오후 3시에 판정돼요.');
  if(ability.corona)throw new GameError('왕관자리 능력의 효과를 골라 주세요.');
  if(ability.paralysis)throw new GameError('뱀주인자리 마비 단계와 대상 친구를 골라 주세요.');
  if(ability.card){
    if(!Array.isArray(player.inventory)||['silver-draw-card','star-card'].some(id=>{
      const item=SHOP.items.find(i=>i.id===id),owned=player.inventory.find(i=>i.id===id);
      return !item||(owned?owned.quantity>=Math.min(SHOP.maxStack,item.maxOwned??Infinity):player.inventory.length>=SHOP.maxKinds);
    }))throw new GameError('가방에 두 종류의 카드 중 어느 것이 나오더라도 담을 수 있는 자리가 필요해요.');
  }
  const rolls=ability.rollCount?Array.from({length:ability.rollCount},()=>die()):null;
  const roll=rolls?rolls[0]:ability.dice?die():null;
  if((ability.dice||ability.rollCount)&&[...(rolls||[roll])].some(n=>!Number.isInteger(n)||n<1||n>6))throw Error('Invalid server die');
  const picking=ability.craft||ability.copy,reward=ability.rollCount?(ability.card?0:Math.abs(rolls[0]-rolls[1])):picking||ability.manualXp?0:ability.dice?ability.rewards[roll-1]:ability.reward;
  const itemId=ability.card?(new Set(rolls).size<ability.rollCount?'silver-draw-card':'star-card'):null;
  if(itemId){
    const item=SHOP.items.find(i=>i.id===itemId),owned=player.inventory?.find(i=>i.id===itemId);
    if(!item||!Array.isArray(player.inventory)||(owned?owned.quantity>=Math.min(SHOP.maxStack,item.maxOwned??Infinity):player.inventory.length>=SHOP.maxKinds))throw new GameError('가방에 카드를 담을 자리가 없어요. 자리를 만든 뒤 다시 사용해 주세요.');
  }
  const budget=ability.copy?ability.budget:ability.craft?corvusBudget(status.level,roll):undefined;
  const choices=picking?corvusChoices(recipes).filter(i=>i.value<=budget&&(!ability.copy||player.inventory.some(owned=>owned.id===i.id&&owned.quantity>0))):[];
  if(ability.copy&&!choices.length)throw new GameError('복사할 수 있는 가치 이하의 보유 아이템이 없어요. 이번 주 사용은 남아 있어요.');
  player.starShards+=reward;
  if(itemId){const owned=player.inventory.find(i=>i.id===itemId);if(owned)owned.quantity++;else player.inventory.push({id:itemId,quantity:1});}
  if(ability.manualXp){
    player.abilityState??={usedWeek:null,usedCount:0,pending:null,markers:[],blocks:[]};
    if(!Array.isArray(player.abilityState.markers)||player.abilityState.markers.length>=30)throw new GameError('선생님 확인 목록이 가득 찼어요. 처리한 뒤 다시 사용해 주세요.');
    player.abilityState.markers.push({id:randomUUID(),constellationId:'libra',level:2,at:now,note:'주차별 경험치 확인 대기',targetName:'',sourceDescription:ability.description});
  }
  const week=constellationWeekStart(now);
  player.constellationAbilityState={...validateConstellationAbilityState(player.constellationAbilityState),usedWeek:week,lastResult:{constellationId:status.constellationId,level:status.level,roll,reward,...(rolls?{rolls}:{}),...(itemId?{itemId}:{}),...(picking?{budget}:{})},pending:choices.length?{week,budget,roll,mode:ability.copy?'copy':'craft',choices}:null};
  return {...constellationAbilityStatus(player,now),reward,roll,starShards:player.starShards,
    message:ability.manualXp?'선생님 확인 목록에 등록했어요. 선생님이 주차를 확인하면 경험치를 받아요.':itemId?`${SHOP.items.find(i=>i.id===itemId).name} 1장을 받았어요.`:ability.copy?'보유 아이템 1개를 골라 복사해 주세요.':ability.craft?(choices.length?'아이템 1개를 골라 제작을 마쳐 주세요.':`제작 가치는 ${budget}개예요. 만들 수 있는 아이템이 없어 이번 주 사용을 마쳤어요.`):reward<0?`별 파편 ${-reward}개를 잃었어요.`:reward===0?'이번 주 능력을 사용했어요. 이번 보상은 별 파편 0개예요.':`별 파편 ${reward}개를 받았어요.`};
}
export function completePiscesPair(player,targetId,now=Date.now()){
  const status=constellationAbilityStatus(player,now);
  if(!status.canUse||status.constellationId!=='pisces')throw new GameError(status.message||'물고기자리 능력을 사용할 수 없어요.');
  if(typeof targetId!=='string'||!targetId||targetId===player.id)throw new GameError('짝이 될 다른 친구를 골라주세요.');
  const week=constellationWeekStart(now);
  player.constellationAbilityState={...validateConstellationAbilityState(player.constellationAbilityState),usedWeek:week,lastResult:{constellationId:'pisces',level:status.level,roll:null,reward:0,targetId},pending:null};
  return constellationAbilityStatus(player,now);
}
export function completeSwanCompliment(player,targetId,now=Date.now()){
  const status=constellationAbilityStatus(player,now);
  if(!status.canUse||status.constellationId!=='cygnus'||status.level!==2)throw new GameError(status.message||'백조자리 칭찬 능력을 사용할 수 없어요.');
  if(typeof targetId!=='string'||!targetId||targetId===player.id)throw new GameError('칭찬할 다른 친구를 골라주세요.');
  const week=constellationWeekStart(now),uses=status.uses+1;
  player.starShards++;
  player.constellationAbilityState={...validateConstellationAbilityState(player.constellationAbilityState),usedWeek:week,lastResult:{constellationId:'cygnus',level:2,roll:null,reward:1,uses,targetId},pending:null};
  return {...constellationAbilityStatus(player,now),reward:1,starShards:player.starShards,message:`칭찬 메시지를 보내고 별 파편 1개를 받았어요. (${uses}/2회)`};
}
export function submitSwanCampaign(player,campaignText,now=Date.now()){
  const status=constellationAbilityStatus(player,now);
  if(!status.canUse||status.constellationId!=='cygnus'||status.level!==3)throw new GameError(status.message||'백조자리 캠페인 능력을 사용할 수 없어요.');
  if(typeof campaignText!=='string'||!campaignText.trim()||campaignText.trim().length>80)throw new GameError('캠페인 문구를 1~80자로 적어주세요.');
  const week=constellationWeekStart(now);
  player.constellationAbilityState={...validateConstellationAbilityState(player.constellationAbilityState),usedWeek:week,lastResult:{constellationId:'cygnus',level:3,roll:null,reward:0,campaignText:campaignText.trim(),submittedAt:now,approvedAt:null},pending:null};
  return {...constellationAbilityStatus(player,now),message:'캠페인 푯말 문구를 선생님께 보냈어요. 선생님이 확인하면 광장에 설치되고 별 파편 3개를 받아요.'};
}
export function approveSwanCampaign(player,now=Date.now()){
  const state=validateConstellationAbilityState(player.constellationAbilityState),last=state.lastResult;
  if(state.abilitySeal?.endsAt>now)throw new GameError('별자리 능력이 봉인된 동안에는 푯말을 승인할 수 없어요.');
  if(state.usedWeek!==constellationWeekStart(now)||last?.constellationId!=='cygnus'||last.level!==3||last.approvedAt!==null)
    throw new GameError('이번 주에 확인할 백조자리 캠페인 푯말이 없어요.');
  if(player.starShards>SHARDS.max-3)throw new GameError('학생의 별 파편 가방이 가득 찼어요. 사용한 뒤 다시 확인해 주세요.');
  player.starShards+=3;
  player.constellationAbilityState={...state,lastResult:{...last,reward:3,approvedAt:now}};
  return {campaignText:last.campaignText,reward:3};
}
export function validateSagittariusUse(player,mode,now=Date.now()){
  const status=constellationAbilityStatus(player,now),ability=weeklyAbilityFor(status.constellationId,status.level);
  if(!status.canUse||!ability.warningHunter)throw new GameError(status.message||'사수자리 능력을 사용할 수 없어요.');
  if(status.lastResult?.mode&&status.lastResult.mode!==mode)throw new GameError('이번 주에는 처음 고른 방식을 계속 사용해 주세요.');
  const previous=status.lastResult?.mode==='department'?ability.uses:status.lastResult?.uses??0;
  const uses=mode==='department'?ability.uses:previous+1;
  if(uses>ability.uses||levelModeInvalid(status.level,mode))throw new GameError('현재 단계에서 선택할 수 없는 능력이에요.');
  return {status,uses};
}
export function completeSagittariusUse(player,mode,{warningId=null,planetId=null}={},now=Date.now()){
  const {status,uses}=validateSagittariusUse(player,mode,now);
  if(mode==='warning'&&(typeof warningId!=='string'||!warningId)||mode==='department'&&(typeof planetId!=='string'||!planetId))throw new GameError('삭제할 내 경고나 부서를 골라주세요.');
  const week=constellationWeekStart(now);
  player.constellationAbilityState={...validateConstellationAbilityState(player.constellationAbilityState),usedWeek:week,lastResult:{constellationId:'sagittarius',level:status.level,roll:null,reward:0,mode,uses,...(warningId?{warningId}:{}),...(planetId?{planetId}:{})},pending:null};
  return constellationAbilityStatus(player,now);
}
const levelModeInvalid=(level,mode)=>level<=3?mode!=='warning':level===4?mode!=='black-star':!['black-star','department'].includes(mode);
export function chooseConstellationItem(player,itemId,now=Date.now()){
  const state=validateConstellationAbilityState(player.constellationAbilityState),pending=state.pending;
  const fail=message=>{throw new GameError(message);};
  if(player.role!=='student'||player.avatar?.teacherPreview||!player.connected||player.away||player.avatar?.blackStar)fail('지금은 아이템을 만들 수 없어요.');
  if(state.abilitySeal?.endsAt>now)fail('뱀주인자리의 고급 마비로 별자리 능력이 봉인됐어요.');
  if(constellationChangedThisWeek(player,now))fail('별자리를 바꾼 주에는 능력을 사용할 수 없어요. 다음 일요일에 다시 사용할 수 있어요.');
  if(!pending||pending.week!==constellationWeekStart(now))fail('진행 중인 별자리 아이템 선택이 없어요.');
  const choice=pending.choices.find(i=>i.id===itemId),item=SHOP.items.find(i=>i.id===itemId);
  if(!choice||!item)fail('주사위 가치로 만들 수 있는 아이템을 골라주세요.');
  const owned=player.inventory.find(i=>i.id===itemId);
  if(pending.mode==='copy'&&!(owned?.quantity>0))fail('복사할 원본 아이템을 지금 가지고 있어야 해요.');
  if((owned?.quantity??0)>=Math.min(SHOP.maxStack,item.maxOwned??Infinity))fail('그 아이템을 더 담을 수 없어요.');
  if(!owned&&player.inventory.length>=SHOP.maxKinds)fail('가방이 가득 찼어요.');
  if(owned)owned.quantity++;else player.inventory.push({id:itemId,quantity:1});
  player.constellationAbilityState={...state,pending:null,lastResult:{...state.lastResult,itemId}};
  return {...constellationAbilityStatus(player,now),reward:0,roll:state.lastResult.roll,itemId,quantity:1,message:`${item.name} 1개를 ${pending.mode==='copy'?'복사했어요':'만들었어요'}.`};
}

export function applyHerculesWeekly(player,event,now=Date.now()){
  const outer=validateConstellationAbilityState(player.constellationAbilityState),copied=outer.ophiuchus?.copied;
  const borrowed=player.avatar?.constellationId==='ophiuchus'&&copied?.used&&copied?.endsAt>now&&copied.constellationId==='hercules';
  const level=borrowed?copied.level:player.avatar?.level;
  const ability=weeklyAbilityFor(borrowed?'hercules':player.avatar?.constellationId,level);
  if(player.role!=='student'||player.avatar?.teacherPreview||!ability.passive||constellationChangedThisWeek(player,now)||outer.abilitySeal?.endsAt>now)return null;
  const state=borrowed?validateConstellationAbilityState(copied.state):outer,week=constellationWeekStart(now),black=event==='black';
  if(!['warning','black'].includes(event))return null;
  if(black){if(!ability.blackLimit||(state.blackWeek!==null&&state.blackWeek>=week))return null;state.blackWeek=week;}
  else{const count=state.warningWeek!==null&&state.warningWeek>=week?state.warningCount:0;if(state.warningWeek>week||count>=ability.warningLimit)return null;state.warningWeek=week;state.warningCount=count+1;}
  const negated=!black&&level===2,amount=black?8:negated?0:level===5?4:3;
  const reward=Number.isSafeInteger(player.starShards)&&player.starShards>=0&&player.starShards<=SHARDS.max-amount?amount:0;
  player.starShards+=reward;
  if(borrowed){outer.ophiuchus.copied.state=state;player.constellationAbilityState=outer;}
  else player.constellationAbilityState=state;
  return {negated,reward,message:negated?'별자리 능력으로 이번 경고 1회는 무효가 됩니다':reward?`별자리 능력으로 별 파편 ${reward}개를 받았어요.`:'별 파편 상한으로 이번 자동 보상은 받지 못했어요. 사용 횟수는 기록됐어요.'};
}
