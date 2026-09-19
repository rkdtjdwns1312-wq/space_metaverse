import {SHARDS,SHOP} from '../shared/config.js';
import {gainExperience} from '../server/progression.js';
import {ensure} from '../server/rooms.js';
import {RABBIT_DRAW_CATALOG} from '../server/rabbit-draw.js';

const items=new Map(RABBIT_DRAW_CATALOG.filter(r=>r.kind==='item').map(r=>[r.itemId,r]));
const nameOf=id=>items.get(id)?.name||({
  'asteroid-card':'소행성','spaceship-card':'우주선','android-card':'안드로이드','sun-rabbit-card':'해 토끼','alien-rabbit-card':'외계 토끼','star-card':'별 카드'
}[id]);
export function awardDrawReward(player,reward){
  const legacy=Number.isInteger(reward)&&reward>=1&&reward<=10;
  if(legacy)reward={kind:'shards',amount:reward,name:'이전 뽑기 보상'};
  ensure(player&&reward&&['shards','item','xp','none'].includes(reward.kind),'뽑기 보상을 확인해주세요.');
  ensure(Number.isSafeInteger(reward.amount)&&reward.amount>=0,'뽑기 보상을 확인해주세요.');
  ensure(legacy||RABBIT_DRAW_CATALOG.some(candidate=>JSON.stringify(candidate)===JSON.stringify(reward)),'뽑기 보상을 확인해주세요.');
  const nextShards=Number.isSafeInteger(player.starShards)?player.starShards:0;
  ensure(Array.isArray(player.inventory)&&player.avatar,'플레이어 상태를 확인해주세요.');
  let shards=0,xp=0,itemId=null,name=reward.name||'';
  if(reward.kind==='shards'){ensure(reward.amount>0,'뽑기 보상을 확인해주세요.');shards=reward.amount;}
  if(reward.kind==='item'){ensure(reward.amount===1&&typeof reward.itemId==='string'&&nameOf(reward.itemId)===reward.name,'뽑기 물품을 확인해주세요.');itemId=reward.itemId;name=nameOf(itemId);}
  if(reward.kind==='xp'){ensure(reward.amount>0,'뽑기 보상을 확인해주세요.');xp=reward.amount;}
  const avatar=structuredClone(player.avatar);
  const gained=reward.kind==='xp'?gainExperience(avatar,xp):avatar;
  const overflow=reward.kind==='xp'?xp-(gained.xp-avatar.xp):0;
  shards+=overflow;
  ensure(nextShards+shards<=SHARDS.max,'별 파편을 더 담을 수 없어요.');
  const inventory=player.inventory.map(i=>({...i}));
  if(itemId){const item=SHOP.items.find(i=>i.id===itemId);ensure(item,'등록되지 않은 보상이에요.');let entry=inventory.find(i=>i.id===itemId);const cap=item.maxOwned||SHOP.maxStack;ensure(!entry||entry.quantity<cap,'이 물품은 '+cap+'개까지만 가질 수 있어요.');if(entry)entry.quantity++;else{ensure(inventory.length<SHOP.maxKinds,'가방이 가득 찼어요.');inventory.push({id:itemId,quantity:1});}}
  player.starShards=nextShards+shards;player.avatar=gained;player.inventory=inventory;
  return {text:reward.kind==='none'?'우주 먼지예요. 보상이 없어요.':reward.kind==='shards'?'별 파편 '+reward.amount+'개를 받았어요.':reward.kind==='item'?name+'을(를) 받았어요.':'경험치 '+(xp-overflow)+'을 받았어요.'+(overflow?' 초과 경험치 '+overflow+'을 별 파편 '+overflow+'개로 바꾸었어요.':''),deltas:{shards,xp:xp-overflow,itemId},reward:structuredClone(reward)};
}
