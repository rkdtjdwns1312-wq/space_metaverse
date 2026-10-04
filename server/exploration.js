import {randomInt,randomUUID} from 'node:crypto';
import {EXPLORATION_CARDS,EXPLORATION_GOAL} from '../shared/exploration.js';
import {ITEM_USE,MAP,PLAZA_ID} from '../shared/config.js';
import {ensure} from './rooms.js';
import {isNear} from './world.js';
import {hasCardStatus} from './item-cards.js';
import {hasLv2ItemBlock,collectSunTax} from './lv2-item-effects.js';
import {activeItemBlocks} from './constellation-abilities.js';

const MAX_RESULTS=300;
const device=MAP.objects.find(object=>object.kind==='exploration');
const nonnegative=value=>Number.isSafeInteger(value)&&value>=0;
const validCard=card=>card&&typeof card.title==='string'&&card.title.trim().length>0&&card.title.length<=40&&
  typeof card.story==='string'&&card.story.trim().length>0&&card.story.length<=240&&nonnegative(card.energy)&&card.energy<=EXPLORATION_GOAL;
const cardsOf=room=>EXPLORATION_CARDS.map(card=>({...card,...room.exploration.cards?.[card.id]}));
export function validateExploration(value){
  if(value===undefined)return {energy:0,results:[]};
  if(!value||!nonnegative(value.energy)||value.energy>EXPLORATION_GOAL||!Array.isArray(value.results)||value.results.length>MAX_RESULTS||
    value.results.some(result=>!result||typeof result.id!=='string'||typeof result.playerId!=='string'||typeof result.nickname!=='string'||
      !EXPLORATION_CARDS.some(card=>card.id===result.cardId)||!nonnegative(result.at)||
      (result.card!==undefined&&(!validCard(result.card)||result.card.id!==result.cardId)))||
    (value.cards!==undefined&&(!value.cards||typeof value.cards!=='object'||Array.isArray(value.cards)||
      Object.entries(value.cards).some(([id,card])=>!EXPLORATION_CARDS.some(base=>base.id===id)||!validCard(card)))))throw Error('우주 탐사 저장 데이터가 올바르지 않습니다.');
  return structuredClone({energy:value.energy,results:value.results,...(value.cards?{cards:value.cards}:{})});
}
export function validateExplorationChances(value){
  if(value===undefined)return 0;
  if(!nonnegative(value)||value>99)throw Error('탐사 기회 저장 데이터가 올바르지 않습니다.');
  return value;
}
function access(room,player){
  ensure(player&&room.players.get(player.id)===player&&player.connected&&!player.away&&player.mapId===PLAZA_ID&&isNear(player,device),
    '광장의 우주 탐사 장치 가까이에서 확인해주세요.');
}
export function explorationView(room,player,now=Date.now()){
  const contributions=new Map();for(const result of room.exploration.results){const old=contributions.get(result.playerId)||{playerId:result.playerId,nickname:result.nickname,energy:0};old.energy+=(result.card||EXPLORATION_CARDS.find(card=>card.id===result.cardId)).energy;contributions.set(result.playerId,old);}
  return {energy:room.exploration.energy,goal:EXPLORATION_GOAL,festival:room.exploration.energy>=EXPLORATION_GOAL,
    chances:player.explorationChances||0,teacher:player.role==='teacher',
    ...(player.role==='teacher'?{cards:cardsOf(room)}:{}),
    ...(player.role==='teacher'?{priorityRows:[...room.players.values()].filter(p=>p.role==='student'&&(p.lv4State?.priorityUntil||0)>now)
      .map(p=>({nickname:p.nickname,until:p.lv4State.priorityUntil})).sort((a,b)=>a.until-b.until||a.nickname.localeCompare(b.nickname,'ko'))}:{}),
    contributors:[...contributions.values()].sort((a,b)=>b.energy-a.energy||a.nickname.localeCompare(b.nickname,'ko')),
    results:room.exploration.results.map(result=>({...result,card:result.card||EXPLORATION_CARDS.find(card=>card.id===result.cardId)}))};
}
export function readExploration(room,player,now=Date.now()){access(room,player);return explorationView(room,player,now);}
export function updateExplorationCards(room,player,cards,now=Date.now()){
  access(room,player);ensure(player.role==='teacher','선생님만 탐사 카드를 수정할 수 있어요.');
  ensure(Array.isArray(cards)&&cards.length===EXPLORATION_CARDS.length&&
    cards.every(card=>card&&EXPLORATION_CARDS.some(base=>base.id===card.id)&&validCard(card))&&
    new Set(cards.map(card=>card.id)).size===EXPLORATION_CARDS.length,'카드 이름·이야기·기운을 확인해주세요.');
  room.exploration.cards=Object.fromEntries(cards.map(card=>[card.id,{title:card.title.trim(),story:card.story.trim(),energy:card.energy}]));
  return explorationView(room,player,now);
}
export function useExplorationTicket(room,player,now=Date.now()){
  ensure(player&&room.players.get(player.id)===player&&player.connected&&!player.away,'먼저 교실에 입장해주세요.');
  const entry=player.inventory.find(item=>item.id==='exploration-ticket');
  ensure(entry?.quantity>0,'탐사권이 가방에 없어요.');
  ensure((player.explorationChances||0)<99,'탐사 기회는 99번까지 모을 수 있어요.');
  ensure(!hasCardStatus(player,'little-sun-card',now)&&!hasLv2ItemBlock(player,now)&&!activeItemBlocks(player,now).length,
    '지금은 아이템을 사용할 수 없어요.');
  ensure(now-(player.lastItemUseAt||0)>=ITEM_USE.cooldownMs,'조금 천천히 써요.');
  collectSunTax(room,player,now);
  entry.quantity--;if(entry.quantity===0)player.inventory=player.inventory.filter(item=>item!==entry);
  player.explorationChances=(player.explorationChances||0)+1;
  player.lastItemUseAt=now;
  return {message:'탐사 기회가 1번 생겼어요. 광장의 우주 탐사 장치로 가 보세요!',chances:player.explorationChances};
}
export function explore(room,player,now=Date.now(),pick=randomInt){
  access(room,player);ensure(player.explorationChances>0,'먼저 탐사권을 사용해주세요.');
  ensure(room.exploration.energy<EXPLORATION_GOAL,'기운이 가득 찼어요. 선생님이 축제를 마친 뒤 다시 탐사해요.');
  ensure(room.exploration.results.length<MAX_RESULTS,'이번 주 탐사 기록이 가득 찼어요. 선생님께 알려주세요.');
  const before=room.exploration.energy,available=cardsOf(room).filter(card=>card.energy<=EXPLORATION_GOAL-before);
  ensure(available.length>0,'남은 기운에 맞는 탐사 카드가 없어요. 선생님이 카드를 수정해야 해요.');
  const index=pick(available.length);ensure(Number.isInteger(index)&&index>=0&&index<available.length,'탐사 결과를 뽑지 못했어요.');
  const card=available[index];room.exploration.energy=before+card.energy;
  player.explorationChances--;
  // 베텔기우스를 사용한 바로 그 한국 날짜에 얻은 기운만큼 급식 우선 기간을 더합니다.
  const day=new Date(now+9*3600000).toISOString().slice(0,10);
  if(card.energy&&player.lv4State?.betelgeuseDay===day)player.lv4State.priorityUntil=Math.max(now,player.lv4State.priorityUntil||0)+card.energy*7*86400000;
  const result={id:randomUUID(),playerId:player.id,nickname:player.nickname,cardId:card.id,card:{...card},at:now};
  room.exploration.results.push(result);
  return {message:`${card.title} · 찬란한 별의 기운 ${room.exploration.energy-before} 획득!`,result:{...result,card},...explorationView(room,player,now)};
}
export function clearExplorationResults(room,player,now=Date.now()){access(room,player);ensure(player.role==='teacher','선생님만 이번 주 결과를 내릴 수 있어요.');
  room.exploration.results=[];return explorationView(room,player,now);
}
export function resetExploration(room,player,now=Date.now()){access(room,player);ensure(player.role==='teacher','선생님만 축제를 초기화할 수 있어요.');
  ensure(room.exploration.energy===EXPLORATION_GOAL,'기운이 가득 찼을 때 초기화할 수 있어요.');
  room.exploration={...room.exploration,energy:0,results:[]};return explorationView(room,player,now);
}
