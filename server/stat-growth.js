import {randomInt} from 'node:crypto';
import {STAT_GROWTH_KEYS,statGrowthRule} from '../shared/stat-growth.js';
import {ensure} from './rooms.js';
import {isMaster} from '../shared/master-account.js';

export function validateStatGrowth(value){
  if(value===undefined)return {bonuses:{hp:0,mp:0,attack:0,defense:0},lastPurchaseDay:null};
  if(!value||!value.bonuses||STAT_GROWTH_KEYS.some(key=>!Number.isSafeInteger(value.bonuses[key])||value.bonuses[key]<0||value.bonuses[key]>1_000_000)||
    value.lastPurchaseDay!==null&&(typeof value.lastPurchaseDay!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(value.lastPurchaseDay)))throw Error('영구 능력치 저장 데이터가 올바르지 않습니다.');
  return {bonuses:Object.fromEntries(STAT_GROWTH_KEYS.map(key=>[key,value.bonuses[key]])),lastPurchaseDay:value.lastPurchaseDay};
}
export function statGrowthInfo(player,now=Date.now()){
  const state=validateStatGrowth(player.statGrowth),dayKey=new Date(now+9*3600_000).toISOString().slice(0,10),purchasedToday=state.lastPurchaseDay!==null&&state.lastPurchaseDay>=dayKey;
  const level=player.avatar?.level??1,rule=statGrowthRule(level),cost=rule?(isMaster(player)?0:rule.cost):null;
  return {level,eligible:!!rule,cost,dayKey,purchasedToday,canBuy:!!rule&&player.role==='student'&&!purchasedToday&&(player.cosmicEnergy??0)>=cost,cosmicEnergy:player.cosmicEnergy??0,bonuses:state.bonuses,weights:rule?.weights??null,amounts:rule?.amounts??null};
}
export function buyStatGrowth(player,now=Date.now(),draw=()=>randomInt(100)){
  ensure(player?.role==='student','학생만 영구 능력치를 구매할 수 있어요.');
  const info=statGrowthInfo(player,now);
  ensure(info.eligible,'Lv2로 진화한 뒤 영구 능력치를 구매할 수 있어요.');
  ensure(!info.purchasedToday,'오늘은 이미 영구 능력치를 구매했어요. 한국 시간 자정 이후 다시 구매할 수 있어요.');
  ensure(Number.isSafeInteger(player.cosmicEnergy)&&player.cosmicEnergy>=info.cost,`우주에너지 ${info.cost}개가 필요해요.`);
  const roll=draw();ensure(Number.isInteger(roll)&&roll>=0&&roll<100,'능력치를 정하지 못했어요. 다시 시도해주세요.');
  let boundary=0;const stat=STAT_GROWTH_KEYS.find(key=>roll<(boundary+=info.weights[key])),amount=info.amounts[stat];
  ensure(info.bonuses[stat]<=1_000_000-amount,'이 능력치는 더 올릴 수 없어요.');
  player.statGrowth={bonuses:{...info.bonuses,[stat]:info.bonuses[stat]+amount},lastPurchaseDay:info.dayKey};
  player.cosmicEnergy-=info.cost;
  return {...statGrowthInfo(player,now),stat,amount,message:({hp:'최대 HP',mp:'최대 MP',attack:'공격력',defense:'방어력'})[stat]+`이 영구적으로 ${amount} 올랐어요.`};
}
