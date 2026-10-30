import {randomUUID,randomInt} from 'node:crypto';
import {GameError} from './pin-auth.js';
import {GARDEN_RULES as R,GARDEN_ARROWS,gardenGrade} from '../shared/garden-minigame.js';
const need=(ok,message='꽃밭 진행 상태가 바뀌었어요. 다시 열어 주세요.')=>{if(!ok)throw new GameError(message);};
const integer=(n,max=8640000000000000)=>Number.isSafeInteger(n)&&n>=0&&n<=max;
export function createGardenGame(now){return {version:1,generation:randomUUID(),revision:0,phase:'seed',positions:[],arrows:Array.from({length:R.sunlightCount},()=>GARDEN_ARROWS[randomInt(4)]),hits:[],nextAt:now,waterStartedAt:null,waterMs:null};}
export function validateGardenGame(g){
 need(g&&g.version===1&&typeof g.generation==='string'&&/^[a-f0-9-]{36}$/.test(g.generation)&&integer(g.revision,100)&&['seed','sunlight','water','ready'].includes(g.phase));
 need(Array.isArray(g.positions)&&g.positions.length<=3&&g.positions.every(p=>p&&integer(p.x,100)&&integer(p.y,100)));
 need(Array.isArray(g.arrows)&&g.arrows.length===R.sunlightCount&&g.arrows.every(a=>GARDEN_ARROWS.includes(a))&&Array.isArray(g.hits)&&g.hits.length<=R.sunlightCount&&g.hits.every(v=>typeof v==='boolean'));
 need(integer(g.nextAt)&&(g.waterStartedAt===null||integer(g.waterStartedAt))&&(g.waterMs===null||integer(g.waterMs,R.waterMaxMs)));
 need(g.phase==='seed'?g.positions.length<3&&g.hits.length===0:g.positions.length===3);
 need(g.phase==='sunlight'?g.hits.length<R.sunlightCount:['water','ready'].includes(g.phase)?g.hits.length===R.sunlightCount:true);
 need(g.phase==='ready'?g.waterStartedAt!==null&&g.waterMs!==null:g.waterMs===null);
 need(['water','ready'].includes(g.phase)||g.waterStartedAt===null);
 return {...g,positions:g.positions.map(p=>({...p})),arrows:[...g.arrows],hits:[...g.hits]};
}
// Three phases contribute equally. Placement measures distance from the marked
// target and spacing; sunlight counts correct arrows; water measures server time.
export function gardenPhaseScores(g){
 const seed=g.positions.reduce((sum,p,i)=>{const t=R.seedTargets[i],distance=Math.hypot(p.x-t.x,p.y-t.y);const spaced=g.positions.every((q,j)=>i===j||Math.hypot(p.x-q.x,p.y-q.y)>=R.minimumSpacing);return sum+Math.max(0,100-distance*4)*(spaced?1:.5);},0)/3;
 const sunlight=g.hits.filter(Boolean).length/R.sunlightCount*100;
 const water=g.waterMs===null?0:Math.max(0,100-Math.abs(g.waterMs-R.waterTargetMs)/R.waterTargetMs*100);
 return {seed:Math.round(seed),sunlight:Math.round(sunlight),water:Math.round(water)};
}
export function gardenScore(g){const s=gardenPhaseScores(g);return Math.round((s.seed+s.sunlight+s.water)/3);}
export function gardenGameView(pot,now){const g=pot.game;return {ready:g.phase==='ready',remainingMs:0,game:{...g,waterElapsedMs:g.waterStartedAt===null?0:Math.max(0,Math.min(R.waterMaxMs,now-g.waterStartedAt)),phaseScores:g.phase==='ready'?gardenPhaseScores(g):null,score:g.phase==='ready'?gardenScore(g):null,grade:g.phase==='ready'?gardenGrade(gardenScore(g)).name:null}};}
export function actGardenGame(pot,data,now){
 const g=pot.game;need(g&&data.generation===g.generation&&data.revision===g.revision);need(integer(now));
 if(data.action==='harvest'){need(g.phase==='ready','세 가지 가꾸기 놀이를 마쳐 주세요.');return gardenGrade(gardenScore(g)).multiplier;}
 if(data.action==='seed-place'){
  need(g.phase==='seed'&&integer(data.x,100)&&integer(data.y,100));need(now>=g.nextAt,'조금 천천히 심어 주세요.');
  g.positions.push({x:data.x,y:data.y});g.nextAt=now+R.inputGapMs;if(g.positions.length===3)g.phase='sunlight';
 }else if(data.action==='sunlight'){
  need(g.phase==='sunlight'&&GARDEN_ARROWS.includes(data.arrow));need(now>=g.nextAt,'화살표를 하나씩 눌러 주세요.');
  g.hits.push(data.arrow===g.arrows[g.hits.length]);g.nextAt=now+R.inputGapMs;if(g.hits.length===R.sunlightCount)g.phase='water';
 }else if(data.action==='water-start'){
  need(g.phase==='water'&&g.waterStartedAt===null,'이미 물을 주는 중이에요. 손을 떼어 마쳐 주세요.');g.waterStartedAt=now;
 }else if(data.action==='water-release'){
  need(g.phase==='water'&&g.waterStartedAt!==null&&now>=g.waterStartedAt);g.waterMs=Math.min(R.waterMaxMs,now-g.waterStartedAt);g.phase='ready';pot.watered=true;
 }else need(false,'현재 단계의 놀이를 진행해 주세요.');
 g.revision++;return null;
}
