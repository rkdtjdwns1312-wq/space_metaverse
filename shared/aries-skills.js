import {transformedSkill} from './transformation.js';
export const ARIES_VFX=Object.freeze(Object.fromEntries(['attack','skill-lv2','skill-lv3','skill-lv4'].map(id=>[
  id,Object.freeze({id,url:`/assets/skills/aries/${id}.png`,iconUrl:`/assets/skills/aries/${id}-icon.png`,
    columns:6,rows:4,frames:24,frameSize:256,anchor:{x:.5,y:.5}})
])));
export const ARIES_NAMES=Object.freeze({attack:'양털뭉치',2:'달콤한 양털',3:'꿈꾸는 양의 꿈',4:'영원의 꿈'});
export function ariesSkillOf(player){
  const stage=Math.max(2,Math.min(4,player?.avatar?.level||2));
  return transformedSkill(player,{level:2,stage,mana:10,cooldownMs:20000,durationMs:5000,
    cloudScale:stage===2?1:stage===3?1.5:2,finishMultiplier:stage*2-2,effectAmount:1,maxTargets:3});
}
export function ariesFrameAt(elapsedMs,durationMs=5000){
  if(elapsedMs<600)return Math.max(0,Math.min(5,Math.floor(elapsedMs/600*6)));
  if(elapsedMs>=durationMs-500)return Math.min(23,18+Math.floor((elapsedMs-(durationMs-500))/500*6));
  return 6+Math.floor((elapsedMs-600)/1000*12)%12;
}
