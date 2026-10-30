import {sustainedSkill} from './skill-duration.js';

export const AQUARIUS_VFX=Object.freeze(Object.fromEntries(['attack','skill-lv2','skill-lv3','skill-lv4'].map(id=>[id,Object.freeze({
  id,url:`/assets/skills/aquarius/${id}.png`,iconUrl:`/assets/skills/aquarius/${id}-icon.png`,
  columns:6,rows:4,frames:24,frameSize:256,anchor:{x:.5,y:id==='attack'?.5:.75}
})])));
export const AQUARIUS_NAMES={2:'샘솟는 별물결',3:'거대한 샘물',4:'천공의 물결'};
export const AQUARIUS_TIMING=Object.freeze({growMs:2000,holdMs:10000,fadeMs:2000,durationMs:14000,tickMs:1000,amountTicks:5});
export function aquariusSkillOf(player){
  const stage=Math.max(2,Math.min(4,player?.avatar?.level||2));
  return sustainedSkill(player,{level:2,stage,mana:10,cooldownMs:20000,...AQUARIUS_TIMING,
    centerOffset:.25,radiusWidths:(stage+1)*.8,verticalRatio:.5,
    multiplier:(stage-1)*2},['durationMs','holdMs']);
}
// 그림과 서버 판정이 같은 시간별 타원을 사용합니다. rx/ry는 최대 반경입니다.
export function aquariusTimingOf(cast={}){
  const {growMs,fadeMs}=AQUARIUS_TIMING;
  const durationMs=cast.durationMs??AQUARIUS_TIMING.durationMs;
  return {growMs,fadeMs,durationMs,holdMs:durationMs-growMs-fadeMs};
}
export function aquariusAreaAt(cast,elapsedMs){
  const {growMs,holdMs,fadeMs,durationMs}=aquariusTimingOf(cast);
  const scale=elapsedMs<0||elapsedMs>=durationMs?0:elapsedMs<growMs?elapsedMs/growMs:
    elapsedMs<growMs+holdMs?1:(durationMs-elapsedMs)/fadeMs;
  return {x:cast.x,y:cast.y,rx:cast.rx*scale,ry:cast.ry*scale,scale};
}
// Q의 원화 프레임과 E의 진행 표시를 유지합니다. E 자체는 canvas로 그립니다.
export function aquariusFrameAt(elapsedMs,basic=false,cast={}){
  if(basic)return Math.min(23,Math.max(0,Math.floor(elapsedMs/650*24)));
  const {growMs,holdMs,fadeMs}=aquariusTimingOf(cast),fadeAt=growMs+holdMs;
  if(elapsedMs<growMs)return Math.max(0,Math.floor(elapsedMs/growMs*6));
  if(elapsedMs>=fadeAt)return Math.min(23,18+Math.floor((elapsedMs-fadeAt)/fadeMs*6));
  return 6+Math.floor((elapsedMs-growMs)/1000*12)%12;
}
