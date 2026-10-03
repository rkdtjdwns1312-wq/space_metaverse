import {transformedSkill} from './transformation.js';

export const SWAN_VFX=Object.freeze(Object.fromEntries(['attack','skill-lv2','skill-lv3','skill-lv4'].map(id=>[
  id,Object.freeze({id,url:`/assets/skills/cygnus/${id}.png`,iconUrl:`/assets/skills/cygnus/${id}-icon.png`,
    columns:6,rows:4,frames:24,frameSize:256,anchor:{x:.5,y:.5}})
])));
export const SWAN_NAMES=Object.freeze({attack:'빛의 깃털',2:'첫 번째 날개',3:'두 번째 날개',4:'세 번째 날개'});

export function swanSkillOf(player){
  const stage=Math.max(2,Math.min(4,player?.avatar?.level||2));
  return transformedSkill(player,{level:2,stage,mana:10,durationMs:20000,cooldownMs:10000,
    maxAttacks:10,rangeWidths:4,wingPairs:stage-1,feathers:stage, effectAmount:1});
}

// 24F 시작 6장, 유지 중간 12장 반복, 끝 6장입니다.
export function swanFrameAt(elapsedMs,durationMs=20000){
  if(elapsedMs<500)return Math.max(0,Math.min(5,Math.floor(elapsedMs/500*6)));
  if(elapsedMs>=durationMs-500)return Math.min(23,18+Math.floor((elapsedMs-(durationMs-500))/500*6));
  return 6+Math.floor((elapsedMs-500)/1000*12)%12;
}
