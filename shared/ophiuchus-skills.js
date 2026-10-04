import {transformedSkill} from './transformation.js';

export const OPHIUCHUS_VFX=Object.freeze(Object.fromEntries(['attack','skill-lv2','skill-lv3','skill-lv4'].map(id=>[
  id,Object.freeze({id,url:`/assets/skills/ophiuchus/${id}.png`,iconUrl:`/assets/skills/ophiuchus/${id}-icon.png`,
    columns:6,rows:4,frames:24,frameSize:256,anchor:{x:.5,y:.5}})
])));
export const OPHIUCHUS_NAMES=Object.freeze({attack:'검은 수정 파편',2:'맹독의 뱀',3:'쌍독의 뱀',4:'심연의 대뱀'});
export function ophiuchusSkillOf(player){
  const stage=Math.max(2,Math.min(4,player?.avatar?.level||2));
  return transformedSkill(player,{level:2,stage,mana:5,cooldownMs:5000,
    snakeScale:stage===2?2:stage===3?2.5:3,rangeWidths:stage===2?2:stage===3?2.5:3,
    halfWidthWidths:stage===2?1:stage===3?1.25:1.5,
    directMultiplier:stage-1,poisonMs:(stage*2)*1000,effectAmount:1});
}
export const ophiuchusFrameAt=elapsed=>Math.max(0,Math.min(23,Math.floor(elapsed/4000*24)));
