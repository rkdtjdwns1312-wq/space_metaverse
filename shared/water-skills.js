import {transformedSkill} from './transformation.js';

export const WATER_VFX=Object.freeze(Object.fromEntries(['cancer','cetus','pisces'].map(star=>[
  star,Object.freeze(Object.fromEntries(['attack','skill-lv2','skill-lv3','skill-lv4'].map(id=>[
    id,Object.freeze({id,url:`/assets/skills/${star}/${id}.png`,iconUrl:`/assets/skills/${star}/${id}-icon.png`,
      columns:6,rows:4,frames:24,frameSize:256,anchor:{x:.5,y:.5}})
  ])))
])));

export const WATER_NAMES=Object.freeze({
  cancer:{attack:'물방울 투척',2:'바다의 친구',3:'밀려오는 파도',4:'심해의 포옹'},
  cetus:{attack:'파도 치기',2:'거대해지는 숨결',3:'심해의 각성',4:'심연의 지배'},
  pisces:{attack:'별빛 물결',2:'별빛의 춤',3:'두 개의 흐름',4:'은하의 순환'}
});
export const waterStageOf=player=>Math.max(2,Math.min(4,player?.avatar?.level||2));
export const isWaterConstellation=player=>['cancer','cetus','pisces'].includes(player?.avatar?.constellationId);

export function waterSkillOf(player){
  const stage=waterStageOf(player),id=player?.avatar?.constellationId;
  if(id==='cancer')return transformedSkill(player,{level:2,stage,mana:10,cooldownMs:20000,durationMs:10000,
    rangeWidths:4,multiplier:stage-1});
  if(id==='cetus')return transformedSkill(player,{level:2,stage,mana:10,cooldownMs:20000,durationMs:10000,
    rangeWidths:2,defenseBonus:stage-1,maxTargets:3,areaDiameterWidths:4});
  if(id==='pisces')return transformedSkill(player,{level:2,stage,mana:5,cooldownMs:10000,
    rangeWidths:4,hits:stage===2?4:stage===3?2:1,multiplier:stage===2?1:stage===3?3:8});
  return null;
}

// 소환 오라 10초 중 처음/마지막 0.5초만 진입·퇴장, 중간 12장을 반복합니다.
export function waterFrameAt(elapsedMs,durationMs=10000){
  if(elapsedMs<500)return Math.max(0,Math.min(5,Math.floor(elapsedMs/500*6)));
  if(elapsedMs>=durationMs-500)return Math.min(23,18+Math.floor((elapsedMs-(durationMs-500))/500*6));
  return 6+Math.floor((elapsedMs-500)/1000*12)%12;
}

// 물고기는 전진 거리와 높이를 함께 바꿉니다. 시작/착지는 바닥, 중간은 최고점입니다.
export function waterProjectilePoint(cast,progress){
  const p=Math.max(0,Math.min(1,progress));
  const distance=cast.range*p;
  const fish=cast.kind==='pisces-skill';
  const lateral=fish?(cast.fishLane||0)*cast.size*.22*Math.sin(Math.PI*p):0;
  const rise=fish?cast.size*.625*4*p*(1-p):0;
  const x=cast.x+cast.dx*distance-cast.dy*lateral;
  const y=cast.y+cast.dy*distance+cast.dx*lateral-rise;
  if(!fish)return {x,y};
  const sideSlope=(cast.fishLane||0)*cast.size*.22*Math.PI*Math.cos(Math.PI*p);
  const riseSlope=cast.size*.625*4*(1-2*p);
  return {x,y,visualAngle:Math.atan2(cast.dy*cast.range+cast.dx*sideSlope-riseSlope,
    cast.dx*cast.range-cast.dy*sideSlope)};
}
export const waterProjectileAngle=cast=>Math.atan2(cast.dy??0,cast.dx??1);
