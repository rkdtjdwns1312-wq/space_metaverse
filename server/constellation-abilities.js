import {randomUUID,randomInt} from 'node:crypto';
import {SHARDS} from '../shared/config.js';
import {constellationOf} from '../shared/constellations.js';

export const DICE_SIDES=6;
export const rollStarDie=()=>randomInt(1,DICE_SIDES+1);
export const freshAbilityState=()=>({usedWeek:null,pending:null,markers:[],blocks:[]});
const date=/^\d{4}-\d{2}-\d{2}$/;

export function validateAbilityState(value){
  if(value===undefined)return freshAbilityState();
  if(!value||typeof value!=='object'||Array.isArray(value)||
    (value.usedWeek!==null&&(typeof value.usedWeek!=='string'||!date.test(value.usedWeek)))||
    !Array.isArray(value.markers)||value.markers.length>30||!Array.isArray(value.blocks)||value.blocks.length>20)
    throw new Error('별자리 능력 저장 데이터가 올바르지 않습니다.');
  if(value.pending!==null){
    const pending=value.pending;
    if(!pending||!['shop-copy','dice-item'].includes(pending.mode)||!date.test(pending.week)||
      (pending.mode==='dice-item'&&(!Number.isInteger(pending.maxLevel)||pending.maxLevel<1||pending.maxLevel>3||
        !Number.isInteger(pending.roll)||pending.roll<2||pending.roll>6)))
      throw new Error('별자리 능력 저장 데이터가 올바르지 않습니다.');
  }
  for(const marker of value.markers){
    if(!marker||typeof marker.id!=='string'||!constellationOf(marker.constellationId)||
      !Number.isSafeInteger(marker.at)||marker.at<0||typeof marker.note!=='string'||marker.note.length>120||
      typeof marker.targetName!=='string'||marker.targetName.length>12)
      throw new Error('별자리 능력 저장 데이터가 올바르지 않습니다.');
  }
  for(const block of value.blocks){
    if(!block||typeof block.id!=='string'||!['ophiuchus','aries'].includes(block.sourceId)||
      !Number.isSafeInteger(block.until)||block.until<0||typeof block.fromId!=='string'||
      typeof block.fromNickname!=='string'||block.fromNickname.length>12||![0,1].includes(block.reward))
      throw new Error('별자리 능력 저장 데이터가 올바르지 않습니다.');
  }
  return structuredClone(value);
}

export function activeItemBlocks(player,now=Date.now()){
  return (player.abilityState?.blocks||[]).filter(block=>block.until>now);
}

export function addItemBlock(player,sourceId,actor,until,reward=0){
  player.abilityState??=freshAbilityState();
  const block={id:randomUUID(),sourceId,until,fromId:actor.id,fromNickname:actor.nickname,reward};
  player.abilityState.blocks.push(block);return block;
}

export function settleItemBlocks(player,now=Date.now()){
  const state=player.abilityState;if(!state)return false;
  let changed=false;
  state.blocks=state.blocks.filter(block=>{
    if(block.until>now)return true;
    if(block.reward&&player.starShards+block.reward>SHARDS.max)return true;
    if(block.reward)player.starShards+=block.reward;
    changed=true;return false;
  });
  return changed;
}

export function abilityBlockViews(player,now=Date.now()){
  return activeItemBlocks(player,now).map(block=>({itemId:null,icon:block.sourceId==='aries'?'💤':'🐍',
    label:block.sourceId==='aries'?'수면 · 아이템 사용 불가':'아이템 사용 정지',style:'card',until:block.until}));
}
