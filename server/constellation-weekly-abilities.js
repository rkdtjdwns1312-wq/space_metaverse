import {randomInt,randomUUID} from 'node:crypto';
import {SHARDS,SHOP} from '../shared/config.js';
import {weeklyAbilityFor,constellationWeekStart,CONSTELLATION_WEEK_MS,corvusBudget} from '../shared/constellation-weekly-abilities.js';
import {GameError} from './pin-auth.js';

export const freshConstellationAbilityState=()=>({usedWeek:null,lastResult:null,pending:null,changedWeek:null,warningWeek:null,warningCount:0,blackWeek:null});
const validWeek=week=>week===null||(Number.isSafeInteger(week)&&week>=0&&week<=8640000000000000-CONSTELLATION_WEEK_MS&&constellationWeekStart(week)===week);
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
  const extra={changedWeek:value.changedWeek??null,warningWeek:value.warningWeek??null,warningCount:value.warningCount??0,blackWeek:value.blackWeek??null};
  if(!validWeek(extra.changedWeek)||!validWeek(extra.warningWeek)||!validWeek(extra.blackWeek)||!Number.isInteger(extra.warningCount)||extra.warningCount<0||extra.warningCount>2||(extra.warningWeek===null)!==(extra.warningCount===0))bad();
  if(usedWeek===null){if(lastResult!==null||value.pending!=null)bad();return {...freshConstellationAbilityState(),...extra};}
  if(!Number.isSafeInteger(usedWeek)||usedWeek<0||usedWeek>8640000000000000-CONSTELLATION_WEEK_MS||constellationWeekStart(usedWeek)!==usedWeek)bad();
  if(!lastResult||typeof lastResult!=='object'||Array.isArray(lastResult))bad();
  const {constellationId,level,roll,reward}=lastResult,ability=weeklyAbilityFor(constellationId,level);
  if(!ability.configured||!Number.isSafeInteger(reward))bad();
  if(ability.rollCount){
    if(!Array.isArray(lastResult.rolls)||lastResult.rolls.length!==ability.rollCount||lastResult.rolls.some(n=>!Number.isInteger(n)||n<1||n>6)||roll!==lastResult.rolls[0]||
      reward!==(ability.card?0:Math.abs(lastResult.rolls[0]-lastResult.rolls[1])))bad();
  }else if(ability.dice?(!Number.isInteger(roll)||roll<1||roll>6||reward!==(ability.craft?0:ability.rewards[roll-1])):(roll!==null||reward!==(ability.copy||ability.manualXp?0:ability.reward)))bad();
  const result={constellationId,level,roll,reward};
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
function denial(player,ability,state,week){
  if(player.role!=='student'||player.avatar?.teacherPreview)return '학생만 별자리 능력 보상을 받을 수 있어요.';
  if(!player.connected||player.away)return '먼저 교실에 입장해주세요.';
  if(constellationChangedThisWeek(player,week))return '별자리를 바꾼 주에는 능력을 사용할 수 없어요. 다음 일요일에 다시 사용할 수 있어요.';
  if(ability.passive)return '경고를 받을 때 자동으로 적용되는 능력이에요.';
  if(player.avatar?.blackStar)return '검은별 상태에서는 능력을 사용할 수 없어요.';
  if(!ability.configured)return '이 별자리의 능력은 준비 중이에요.';
  if(state.usedWeek!==null&&state.usedWeek>=week)return '이번 주 별자리 능력은 이미 사용했어요. 다음 일요일에 다시 쓸 수 있어요.';
  if(!Number.isSafeInteger(player.starShards)||player.starShards<0||player.starShards>SHARDS.max)return '별 파편 잔액을 확인해주세요.';
  if(player.starShards<ability.minBalance)return `주사위를 굴리려면 별 파편 ${ability.minBalance}개가 있어야 해요.`;
  if(player.starShards>SHARDS.max-ability.maxReward)return '별 파편을 더 담을 수 없어요.';
  return null;
}
export function constellationAbilityStatus(player,now=Date.now()){
  const level=player.avatar?.level??1,constellationId=player.avatar?.constellationId??null;
  const ability=weeklyAbilityFor(constellationId,level),state=validateConstellationAbilityState(player.constellationAbilityState),week=constellationWeekStart(now);
  const message=denial(player,ability,state,week);
  const warningUsed=state.warningWeek!==null&&state.warningWeek>=week?state.warningCount:0,blackUsed=state.blackWeek!==null&&state.blackWeek>=week?1:0;
  const used=ability.passive?warningUsed>=ability.warningLimit&&blackUsed>=ability.blackLimit:state.usedWeek!==null&&state.usedWeek>=week;
  const blockedByChange=constellationChangedThisWeek(player,now),day=new Date(now+9*3600000).getUTCDay();
  const pending=state.pending?.week===week?state.pending:null;
  const lastResult=!ability.passive&&state.usedWeek!==null&&state.usedWeek>=week&&state.lastResult?(({roll,rolls,reward,budget,itemId,constellationId})=>({roll,reward,...(rolls?{rolls}:{}),...(budget!==undefined?{budget,mode:constellationId==='gemini'?'copy':'craft'}:{}),...(itemId?{itemId}:{})}))(state.lastResult):null;
  return {configured:ability.configured,used,canUse:!message,passive:!!ability.passive,blockedByChange,
    warningUsed,warningLimit:ability.warningLimit??0,blackUsed,blackLimit:ability.blackLimit??0,
    remindUnused:ability.configured&&!ability.passive&&!used&&!blockedByChange&&player.role==='student'&&!player.avatar?.teacherPreview&&!player.avatar?.blackStar&&player.connected&&!player.away&&(day===5||day===6),
    description:ability.description,level,constellationId,nextResetAt:Math.max(week,state.usedWeek??week,state.changedWeek??week,state.warningWeek??week,state.blackWeek??week)+CONSTELLATION_WEEK_MS,
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
export function chooseConstellationItem(player,itemId,now=Date.now()){
  const state=validateConstellationAbilityState(player.constellationAbilityState),pending=state.pending;
  const fail=message=>{throw new GameError(message);};
  if(player.role!=='student'||player.avatar?.teacherPreview||!player.connected||player.away||player.avatar?.blackStar)fail('지금은 아이템을 만들 수 없어요.');
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
  const ability=weeklyAbilityFor(player.avatar?.constellationId,player.avatar?.level);
  if(player.role!=='student'||player.avatar?.teacherPreview||!ability.passive||constellationChangedThisWeek(player,now))return null;
  const state=validateConstellationAbilityState(player.constellationAbilityState),week=constellationWeekStart(now),black=event==='black';
  if(!['warning','black'].includes(event))return null;
  if(black){if(!ability.blackLimit||(state.blackWeek!==null&&state.blackWeek>=week))return null;state.blackWeek=week;}
  else{const count=state.warningWeek!==null&&state.warningWeek>=week?state.warningCount:0;if(state.warningWeek>week||count>=ability.warningLimit)return null;state.warningWeek=week;state.warningCount=count+1;}
  const negated=!black&&player.avatar.level===2,amount=black?8:negated?0:player.avatar.level===5?4:3;
  const reward=Number.isSafeInteger(player.starShards)&&player.starShards>=0&&player.starShards<=SHARDS.max-amount?amount:0;
  player.starShards+=reward;player.constellationAbilityState=state;
  return {negated,reward,message:negated?'별자리 능력으로 이번 경고 1회는 무효가 됩니다':reward?`별자리 능력으로 별 파편 ${reward}개를 받았어요.`:'별 파편 상한으로 이번 자동 보상은 받지 못했어요. 사용 횟수는 기록됐어요.'};
}
