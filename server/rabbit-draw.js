import {randomInt,randomUUID} from 'node:crypto';

const DRAW_COUNT=54;
const DRAW_ITEM=(itemId,name,amount=1)=>({kind:'item',amount,itemId,name});
const DRAW_CATALOG=[
  ...Array.from({length:18},()=>({kind:'none',amount:0,name:'우주 먼지'})),
  ...[4,4,4,6,6,10].map(amount=>({kind:'shards',amount,name:amount===4?'눈부신 별':amount===6?'찬란한 별':'태초의 별'})),
  ...[['space-food-card','우주 식량'],['space-robot-card','우주 로봇'],['alien-card','외계인'],['little-sun-card','꼬마 해'],['little-moon-card','꼬마 달'],['space-suit-card','우주복']].flatMap(([id,name])=>[DRAW_ITEM(id,name),DRAW_ITEM(id,name)]),
  ...[['asteroid-card','소행성'],['spaceship-card','우주선'],['android-card','안드로이드'],['sun-rabbit-card','해 토끼'],['alien-rabbit-card','외계 토끼']].map(([id,name])=>DRAW_ITEM(id,name)),
  ...Array.from({length:3},()=>DRAW_ITEM('star-card','별 카드')),
  ...[...Array(6).fill(2),...Array(2).fill(5),...Array(2).fill(10)].map(amount=>({kind:'xp',amount,name:amount===2?'성장':amount===5?'급성장':'과다 성장'}))
];
export const RABBIT_DRAW_CATALOG=Object.freeze(DRAW_CATALOG.map(Object.freeze));

// 1~10개 모두 나올 수 있고, 100회 기준 가중합은 정확히 300개입니다.
export const RABBIT_REWARD_WEIGHTS=Object.freeze([35,19,14,10,7,5,4,3,2,1]);
export const RABBIT_CARD_COUNT=10;
export const RABBIT_DRAW_COUNT=DRAW_COUNT;

export function rabbitReward(roll=randomInt(100)){
  if(!Number.isInteger(roll)||roll<0||roll>=100)throw new RangeError('뽑기 난수는 0~99여야 합니다.');
  let cursor=0;
  for(let index=0;index<RABBIT_REWARD_WEIGHTS.length;index++){
    cursor+=RABBIT_REWARD_WEIGHTS[index];
    if(roll<cursor)return index+1;
  }
  throw new Error('뽑기 확률 설정을 확인해주세요.');
}

export function createRabbitDraw(now=Date.now()){
  const cards=RABBIT_DRAW_CATALOG.map(reward=>({id:randomUUID(),reward:structuredClone(reward)}));
  for(let i=cards.length-1;i>0;i--){const j=randomInt(i+1);[cards[i],cards[j]]=[cards[j],cards[i]];}
  return {id:randomUUID(),startedAt:now,markerId:null,cards};
}

export function rabbitDrawView(draw){
  // 보상과 카드별 id/순서는 서버에만 남깁니다.
  return draw?{id:draw.id,count:draw.cards.length}:null;
}

function validNewReward(reward){
  return reward&&['shards','item','xp','none'].includes(reward.kind)&&Number.isSafeInteger(reward.amount)&&reward.amount>=0&&
    (reward.kind==='item'?typeof reward.itemId==='string'&&typeof reward.name==='string'&&reward.amount===1:
      reward.kind==='none'?reward.amount===0:reward.amount>0);
}

export function validateRabbitDraw(value){
  if(value===undefined||value===null)return null;
  const old=value&&Array.isArray(value.cards)&&value.cards.length===10&&value.cards.every(card=>card&&Number.isInteger(card.reward));
  if(old){
    if(!value||typeof value.id!=='string'||!Number.isSafeInteger(value.startedAt)||value.startedAt<0||(value.markerId!==null&&typeof value.markerId!=='string')||
      value.cards.some(card=>typeof card.id!=='string'||card.reward<1||card.reward>10)||new Set(value.cards.map(card=>card.id)).size!==10)
      throw new Error('달토끼 뽑기 저장 데이터가 올바르지 않습니다.');
    return structuredClone(value);
  }
  if(!value||typeof value.id!=='string'||!Number.isSafeInteger(value.startedAt)||value.startedAt<0||(value.markerId!==null&&typeof value.markerId!=='string')||
    !Array.isArray(value.cards)||value.cards.length!==DRAW_COUNT||value.cards.some(card=>!card||typeof card.id!=='string'||!validNewReward(card.reward))||
    new Set(value.cards.map(card=>card.id)).size!==DRAW_COUNT) throw new Error('달토끼 뽑기 저장 데이터가 올바르지 않습니다.');
  const actual=value.cards.map(card=>JSON.stringify(card.reward)).sort();
  const expected=RABBIT_DRAW_CATALOG.map(JSON.stringify).sort();
  if(JSON.stringify(actual)!==JSON.stringify(expected))throw new Error('달토끼 뽑기 카드 구성이 올바르지 않습니다.');
  return structuredClone(value);
}
