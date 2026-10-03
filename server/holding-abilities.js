import {randomInt,randomUUID} from 'node:crypto';
import {HOLDING_ITEMS,HOLDING_ITEM_IDS,holdingWeek,holdingUsed,validateHoldingState} from '../shared/holding-abilities.js';
import {nextRewardMonday} from '../shared/weekly-reward-time.js';
import {ITEM_USE,SHOP,SHARDS,itemOf} from '../shared/config.js';
import {ensure} from './rooms.js';
import {hasCardStatus} from './item-cards.js';
import {activeItemBlocks} from './constellation-abilities.js';
import {hasLv2ItemBlock,collectSunTax} from './lv2-item-effects.js';
import {requireStarCardItemAccess} from './star-cards.js';
import {warningCount,clearOneWarningFromPlanet} from './warnings.js';
import {createRabbitDraw,rabbitDrawView} from './rabbit-draw.js';
import {useLv4Holding,syncLv4Holdings} from './lv4-item-effects.js';
import {activatedSupernova} from '../shared/supernova-life.js';
import {addCardMarker} from './item-cards.js';

const quantity=(p,id)=>p.inventory?.find(e=>e.id===id)?.quantity||0;
const isSupernova=id=>id==='supernova-alpha-card'||id==='supernova-beta-card';
const used=(p,id,now)=>holdingUsed(p,id,now)||(isSupernova(id)&&['supernova-alpha-card','supernova-beta-card'].some(key=>holdingUsed(p,key,now)));
const level=p=>p.role==='teacher'?ITEM_USE.teacherLevel:p.avatar.level;
function give(p,id,n){const entry=p.inventory.find(e=>e.id===id);ensure((entry?.quantity||0)+n<=SHOP.maxStack&&(entry||p.inventory.length<SHOP.maxKinds),'보상 아이템을 받을 가방 공간이 부족해요.');if(entry)entry.quantity+=n;else p.inventory.push({id,quantity:n});}
function reason(room,p,id,now){
  if(!p||room.players.get(p.id)!==p||!p.connected||p.away)return '먼저 교실에 입장해주세요.';
  if(!quantity(p,id))return '가방에 그 보유능력 카드가 없어요.';
  if(level(p)<itemOf(id).level)return '캐릭터의 lv보다 높은 아이템으로 사용할 수 없습니다';
  if(used(p,id,now))return '이번 주에 이미 사용했어요.';
  if(hasCardStatus(p,'little-sun-card',now)||hasLv2ItemBlock(p,now)||activeItemBlocks(p,now).length)return '지금은 아이템을 사용할 수 없어요.';
  try{requireStarCardItemAccess(room,p,now);}catch(e){return e.message;}
  if(id==='rabbit-princess-card'&&p.rabbitDraw)return '진행 중인 뽑기를 먼저 마쳐주세요.';
  return null;
}
export function holdingStatus(room,p,itemId,now=Date.now()){
  ensure(!itemId||HOLDING_ITEM_IDS.includes(itemId),'보유능력이 없는 아이템이에요.');
  const week=holdingWeek(now),resetAt=nextRewardMonday(now);
  const preview={inventory:p.inventory,lv4State:structuredClone(p.lv4State)};syncLv4Holdings(preview,now);
  return {week,resetAt,items:HOLDING_ITEMS.filter(def=>!itemId||def.itemId===itemId).map(def=>{
    const id=def.itemId,denial=reason(room,p,id,now);
    return {itemId:id,used:used(p,id,now),canUse:!denial,reason:denial,quantity:quantity(p,id),
      activeUntil:def.duration&&quantity(p,id)&&(isSupernova(id)?activatedSupernova(p,now)===id:holdingUsed(p,id,now))&&(id!=='alien-creature-card'||p.cardMarkers?.some(m=>m.itemId===id&&m.holdingAbility&&m.until>now))?resetAt:null,
      stacks:preview.lv4State.stacks,teacherConfirmed:p.holdingState?.queenReadyWeek===week,
      planets:id==='comet-card'?[...room.planets.values()].map(planet=>({id:planet.id,name:planet.name,count:warningCount(planet,p.id)})).filter(planet=>planet.count>0):[]};
  })};
}
// 전체 방의 초안을 검증한 후 반영합니다. 디스크 실패는 호출자의 store.transact가 복구합니다.
export function useHoldingAbility(room,actor,data={},now=Date.now(),die=()=>randomInt(1,7)){
  ensure(Number.isSafeInteger(now)&&now>=0,'사용 시각을 확인해주세요.');
  const id=data.itemId;ensure(HOLDING_ITEM_IDS.includes(id),'보유능력이 없는 아이템이에요.');
  ensure(!data.playerId||data.playerId===actor?.id,'다른 학생의 보유능력을 사용할 수 없어요.');
  ensure(!data.targetId||data.targetId===actor?.id,'보유능력은 나에게만 사용할 수 있어요.');
  const denial=reason(room,actor,id,now);ensure(!denial,denial);
  const draft={...room,players:new Map([...room.players].map(([key,p])=>[key,structuredClone(p)])),planets:new Map([...room.planets].map(([key,p])=>[key,structuredClone(p)])),itemLog:[...(room.itemLog||[])]};
  const p=draft.players.get(actor.id);p.holdingState=validateHoldingState(p.holdingState);
  const week=holdingWeek(now);let message,roll,draw;
  // 초은하단의 기존 교환 함수에서 사용료와 주간 수령 기록을 함께 처리합니다.
  if(id==='supercluster-card')message=useLv4Holding(draft,p,{reward:data.reward,requestId:'holding:'+week},now).message;
  else{
    collectSunTax(draft,p,now);
    if(id==='galaxy-card'||id==='galaxy-cluster-card'){
      const n=Math.min(2,quantity(p,id))*(id==='galaxy-card'?1:2);ensure(p.starShards<=SHARDS.max-n,'별 파편 잔액이 가득 찼어요.');p.starShards+=n;message=`보유능력으로 별 파편 ${n}개를 받았어요.`;
    }else if(isSupernova(id)){
      p.holdingState.supernovaActiveId=id;message='초신성 α·β 보유능력을 이번 주 일요일까지 활성화했어요. 나중에 얻은 보유 종류가 적용돼요.';
    }else if(id==='rabbit-princess-card'){
      roll=die();ensure(Number.isInteger(roll)&&roll>=1&&roll<=6,'주사위 결과를 확인해주세요.');
      if(roll===6){give(p,'star-card',1);message='주사위 6! 별 카드 1장을 받았어요.';}
      else{p.rabbitDraw=createRabbitDraw(now);draw=rabbitDrawView(p.rabbitDraw);message=`주사위 ${roll}! 뽑기 기회를 받았어요.`;}
    }else if(id==='comet-card'){
      const planet=draft.planets.get(data.planetId);ensure(planet&&warningCount(planet,p.id)>0,'내 경고가 있는 부서를 골라주세요.');clearOneWarningFromPlanet(draft,planet,p);message=planet.name+'의 내 경고 1개를 삭제했어요.';
    }else if(id==='alien-creature-card'){
      Object.assign(addCardMarker(p,itemOf(id),p,nextRewardMonday(now),'이번 주 마감 기한 1일 연장 · 현실 과제는 선생님 확인'),{holdingAbility:true,remainingUses:1,at:now,fromLevel:level(p)});
      message='이번 주 일요일까지 마감 기한 1일 연장을 사용해요. 실제 과제 기한은 선생님이 확인해요.';
    }
    p.holdingState.usedWeeks[id]=week;
  }
  const item=itemOf(id);draft.itemLog.push({id:randomUUID(),at:now,userId:p.id,userNickname:p.nickname,targetId:p.id,targetNickname:p.nickname,itemId:id,itemName:item.name+' 보유능력',secret:false});
  if(draft.itemLog.length>ITEM_USE.logSize)draft.itemLog.shift();
  for(const [key,value] of draft.players)Object.assign(room.players.get(key),value);
  for(const [key,value] of draft.planets)Object.assign(room.planets.get(key),value);room.itemLog=draft.itemLog;
  return {message,status:holdingStatus(room,actor,id,now),inventory:structuredClone(actor.inventory),starShards:actor.starShards,...(roll===undefined?{}:{roll}),...(draw?{draw}:{})};
}
