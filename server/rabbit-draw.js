import {randomInt,randomUUID} from 'node:crypto';

// 1~10개 모두 나올 수 있고, 100회 기준 가중합은 정확히 300개입니다.
export const RABBIT_REWARD_WEIGHTS=Object.freeze([35,19,14,10,7,5,4,3,2,1]);
export const RABBIT_CARD_COUNT=10;

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
  return {id:randomUUID(),startedAt:now,markerId:null,cards:Array.from({length:RABBIT_CARD_COUNT},()=>({id:randomUUID(),reward:rabbitReward()}))};
}

export function rabbitDrawView(draw){
  return draw?{id:draw.id,cards:draw.cards.map(card=>({id:card.id}))}:null;
}

export function validateRabbitDraw(value){
  if(value===undefined||value===null)return null;
  if(!value||typeof value.id!=='string'||!Number.isSafeInteger(value.startedAt)||value.startedAt<0||
    typeof value.markerId!=='string'||!Array.isArray(value.cards)||value.cards.length!==RABBIT_CARD_COUNT||
    value.cards.some(card=>!card||typeof card.id!=='string'||!Number.isInteger(card.reward)||card.reward<1||card.reward>10)||
    new Set(value.cards.map(card=>card.id)).size!==RABBIT_CARD_COUNT)
    throw new Error('달토끼 뽑기 저장 데이터가 올바르지 않습니다.');
  return structuredClone(value);
}
