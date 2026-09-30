import {transformedSkill} from './transformation.js';

export const AQUARIUS_VFX=Object.freeze(Object.fromEntries(['attack','skill-lv2','skill-lv3','skill-lv4'].map(id=>[id,Object.freeze({
  id,url:`/assets/skills/aquarius/${id}.png`,iconUrl:`/assets/skills/aquarius/${id}-icon.png`,
  columns:6,rows:4,frames:24,frameSize:256,anchor:{x:.5,y:id==='attack'?.5:.75}
})])));
export const AQUARIUS_NAMES={2:'샘솟는 물병',3:'거대한 샘물',4:'천공의 물결'};
export function aquariusSkillOf(player){
  const stage=Math.max(2,Math.min(4,player?.avatar?.level||2));
  return transformedSkill(player,{level:2,stage,mana:10,cooldownMs:20000,durationMs:5000,ticks:5,
    summonWidths:3,radiusWidths:(stage+1)/2,verticalRatio:.5,
    multiplier:(stage-1)*2,healingAmount:(stage-1)*10,effectAmount:.5});
}
// 발동·반복·소멸을 나누어 24F의 중간 프레임을 5초 안에서 반복합니다.
export function aquariusFrameAt(elapsedMs,basic=false){
  if(basic)return Math.min(23,Math.max(0,Math.floor(elapsedMs/650*24)));
  if(elapsedMs<500)return Math.max(0,Math.floor(elapsedMs/500*6));
  if(elapsedMs>=4500)return Math.min(23,18+Math.floor((elapsedMs-4500)/500*6));
  return 6+Math.floor((elapsedMs-500)/1000*12)%12;
}
