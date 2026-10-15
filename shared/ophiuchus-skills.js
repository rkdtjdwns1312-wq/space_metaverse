import {sustainedSkill} from './skill-duration.js';
import {AQUARIUS_TIMING,aquariusAreaAt,aquariusTimingOf} from './aquarius-skills.js';

export const OPHIUCHUS_VFX=Object.freeze(Object.fromEntries(['attack','skill-lv2','skill-lv3','skill-lv4'].map(id=>[
  id,Object.freeze({id,url:`/assets/skills/ophiuchus/${id}.png`,iconUrl:`/assets/skills/ophiuchus/${id==='attack'?id:id.replace('skill-','poison-')}-icon.png`,
    columns:6,rows:4,frames:24,frameSize:256,anchor:{x:.5,y:.5}})
])));
export const OPHIUCHUS_NAMES=Object.freeze({attack:'검은 수정 파편',2:'독안개의 지대',3:'맹독의 지대',4:'심연의 독무'});
export function ophiuchusSkillOf(player){
  const stage=Math.max(2,Math.min(4,player?.avatar?.level||2));
  const {growMs,holdMs,fadeMs,durationMs}=AQUARIUS_TIMING;
  return sustainedSkill(player,{level:2,stage,mana:5,cooldownMs:5000,growMs,holdMs,fadeMs,durationMs,
    centerOffset:.25,radiusWidths:(stage+1)/2*1.2,verticalRatio:.5,
    directMultiplier:stage-1,poisonMs:({2:3000,3:5000,4:8000})[stage],effectAmount:1},['durationMs','holdMs']);
}
export const ophiuchusAreaAt=aquariusAreaAt;
export const ophiuchusTimingOf=aquariusTimingOf;
// 이전 단발 원화 렌더러의 프레임 API는 유지합니다. 새 지대는 AreaAt/TimingOf를 사용합니다.
export const ophiuchusFrameAt=elapsed=>Math.max(0,Math.min(23,Math.floor(elapsed/4000*24)));
