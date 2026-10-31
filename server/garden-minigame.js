import {randomUUID,randomInt} from 'node:crypto';
import {GameError} from './pin-auth.js';
import {GARDEN_RULES as R,GARDEN_ARROWS,gardenGrade,seedHandX,sunlightStageAt} from '../shared/garden-minigame.js';
const need=(ok,message='꽃밭 진행 상태가 바뀌었어요. 다시 열어 주세요.')=>{if(!ok)throw new GameError(message);};
const integer=(n,max=8640000000000000)=>Number.isSafeInteger(n)&&n>=0&&n<=max;
export function createGardenGame(now){return {version:2,generation:randomUUID(),revision:0,phase:'seed',positions:[],
  seedStartedAt:now,arrows:Array.from({length:R.sunlightCount},()=>GARDEN_ARROWS[randomInt(4)]),hits:[],
  sunlightStageStartedAt:null,nextAt:now,waterStartedAt:null,waterMs:null};}
export function validateGardenGame(g){
 if(g?.version===1&&Array.isArray(g.arrows)&&g.arrows.length===8){
  const arrows=Array.from({length:R.sunlightCount},(_,i)=>g.arrows[i%8]);
  const hits=['water','ready'].includes(g.phase)?Array.from({length:R.sunlightCount},(_,i)=>g.hits[i%8]):[...g.hits];
  g={...g,version:2,arrows,hits,seedStartedAt:g.nextAt,
    sunlightStageStartedAt:g.phase==='sunlight'?g.nextAt:null};
 }
 need(g&&g.version===2&&typeof g.generation==='string'&&/^[a-f0-9-]{36}$/.test(g.generation)&&integer(g.revision,100)&&['seed','sunlight','water','ready'].includes(g.phase));
 need(Array.isArray(g.positions)&&g.positions.length<=3&&g.positions.every(p=>p&&integer(p.x,100)&&integer(p.y,100)));
 need(Array.isArray(g.arrows)&&g.arrows.length===R.sunlightCount&&g.arrows.every(a=>GARDEN_ARROWS.includes(a))&&Array.isArray(g.hits)&&g.hits.length<=R.sunlightCount&&g.hits.every(v=>typeof v==='boolean'));
 need(integer(g.nextAt)&&(g.waterStartedAt===null||integer(g.waterStartedAt))&&(g.waterMs===null||integer(g.waterMs,R.waterMaxMs)));
 need(integer(g.seedStartedAt)&&(g.sunlightStageStartedAt===null||integer(g.sunlightStageStartedAt)));
 need(g.phase==='seed'?g.positions.length<3&&g.hits.length===0:g.positions.length===3);
 need(g.phase==='sunlight'?g.hits.length<R.sunlightCount&&g.sunlightStageStartedAt!==null:['water','ready'].includes(g.phase)?g.hits.length===R.sunlightCount:true);
 need(g.phase==='ready'?g.waterStartedAt!==null&&g.waterMs!==null:g.waterMs===null);
 need(['water','ready'].includes(g.phase)||g.waterStartedAt===null);
 return {...g,positions:g.positions.map(p=>({...p})),arrows:[...g.arrows],hits:[...g.hits]};
}
// Three phases contribute equally. Placement measures distance from the marked
// target and spacing; sunlight counts correct arrows; water measures server time.
export function gardenPhaseScores(g){
 const seed=g.positions.reduce((sum,p,i)=>{const t=R.seedTargets[i],distance=Math.hypot(p.x-t.x,p.y-t.y);const spaced=g.positions.every((q,j)=>i===j||Math.hypot(p.x-q.x,p.y-q.y)>=R.minimumSpacing);
   const inZone=Math.abs(p.x-t.x)<=R.seedZoneRadius&&p.x>5&&p.x<95;
   return sum+(inZone?Math.max(0,100-distance*4):Math.max(0,100-distance*4)*.5)*(spaced?1:.5);},0)/3;
 const sunlight=g.hits.filter(Boolean).length/R.sunlightCount*100;
 const water=g.waterMs===null?0:Math.max(0,100-Math.abs(g.waterMs-R.waterTargetMs)/R.waterTargetMs*100);
 return {seed:Math.round(seed),sunlight:Math.round(sunlight),water:Math.round(water)};
}
export function gardenScore(g){const s=gardenPhaseScores(g);return Math.round((s.seed+s.sunlight+s.water)/3);}
export function gardenGameView(pot,now){const g=pot.game;return {ready:g.phase==='ready',remainingMs:0,game:{...g,
  seedElapsedMs:Math.max(0,now-g.seedStartedAt),sunlightRemainingMs:g.phase==='sunlight'?Math.max(0,g.sunlightStageStartedAt+R.sunlightStageMs-now):null,
  waterElapsedMs:g.waterStartedAt===null?0:Math.max(0,Math.min(R.waterMaxMs,now-g.waterStartedAt)),phaseScores:g.phase==='ready'?gardenPhaseScores(g):null,score:g.phase==='ready'?gardenScore(g):null,grade:g.phase==='ready'?gardenGrade(gardenScore(g)).name:null}};}
function advanceSunlight(g,now){
 while(g.phase==='sunlight'&&now>=g.sunlightStageStartedAt+R.sunlightStageMs){
  const stage=sunlightStageAt(g.hits.length);
  g.hits.push(...Array(stage.end-g.hits.length).fill(false));
  g.sunlightStageStartedAt+=R.sunlightStageMs;
  if(g.hits.length===R.sunlightCount)g.phase='water';
 }
}
export function actGardenGame(pot,data,now){
 const g=pot.game;need(g&&data.generation===g.generation&&data.revision===g.revision);need(integer(now));
 if(data.action==='harvest'){need(g.phase==='ready','세 가지 가꾸기 놀이를 마쳐 주세요.');return gardenGrade(gardenScore(g)).multiplier;}
 if(data.action==='seed-place'){
  need(g.phase==='seed');need(now>=g.nextAt,'조금 천천히 심어 주세요.');
  g.positions.push({x:seedHandX(g.seedStartedAt,now),y:50});g.nextAt=now+R.inputGapMs;
  if(g.positions.length===3){g.phase='sunlight';g.sunlightStageStartedAt=now;}
 }else if(data.action==='sunlight'){
  need(g.phase==='sunlight'&&GARDEN_ARROWS.includes(data.arrow));need(now>=g.nextAt,'화살표를 하나씩 눌러 주세요.');
  if(now>=g.sunlightStageStartedAt+R.sunlightStageMs)advanceSunlight(g,now);
  else{
   const stage=sunlightStageAt(g.hits.length);
   g.hits.push(data.arrow===g.arrows[g.hits.length]);g.nextAt=now+R.inputGapMs;
   if(g.hits.length===stage.end){if(g.hits.length===R.sunlightCount)g.phase='water';else g.sunlightStageStartedAt=now;}
  }
 }else if(data.action==='sunlight-timeout'){
  need(g.phase==='sunlight'&&now>=g.sunlightStageStartedAt+R.sunlightStageMs,'아직 시간이 남았어요.');
  advanceSunlight(g,now);
 }else if(data.action==='water-start'){
  need(g.phase==='water'&&g.waterStartedAt===null,'이미 물을 주는 중이에요. 손을 떼어 마쳐 주세요.');g.waterStartedAt=now;
 }else if(data.action==='water-release'){
  need(g.phase==='water'&&g.waterStartedAt!==null&&now>=g.waterStartedAt);g.waterMs=Math.min(R.waterMaxMs,now-g.waterStartedAt);g.phase='ready';pot.watered=true;
 }else need(false,'현재 단계의 놀이를 진행해 주세요.');
 g.revision++;return null;
}
