import {transformedSkill} from './transformation.js';
export const LEO_VFX=Object.freeze(Object.fromEntries(['attack','skill-lv2','skill-lv3','skill-lv4'].map(id=>[
  id,Object.freeze({id,url:`/assets/skills/leo/${id}.png`,
    iconUrl:id==='attack'?'/assets/skills/leo/attack/frames/03.png':`/assets/skills/leo/${id}-icon.png`,
    columns:6,rows:4,frames:24,frameSize:256})
])));
export const LEO_NAMES=Object.freeze({attack:'황금의 갈퀴',2:'사자의 포효',3:'황금의 포효',4:'천하의 사자'});
export function leoSkillOf(player){
  const stage=Math.max(2,Math.min(4,player?.avatar?.level||2));
  return transformedSkill(player,{level:2,stage,mana:5,cooldownMs:10000,durationMs:10000,
    multiplier:stage*2,attackBonus:stage,rangeWidths:4});
}
