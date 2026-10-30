import {randomUUID} from 'node:crypto';
import {STAR_ACTIVITIES,STAR_AXES,STAR_EVENTS,STAR_CAREERS} from '../shared/star-raising.js';
import {GameError} from './pin-auth.js';
const need=(ok)=>{if(!ok)throw new GameError('아기별 이야기의 현재 단계를 확인해주세요. 다시 열어 이어갈 수 있어요.');};
const time=v=>Number.isSafeInteger(v)&&v>=0&&v<=8640000000000000;
const activity=v=>STAR_ACTIVITIES.some(a=>a.id===v);
const type=v=>typeof v==='string'&&/^[IE][SN][FT][PJ]$/.test(v);
const uuid=v=>typeof v==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(v);
function ending(raw){
 need(raw&&type(raw.type)&&time(raw.completedAt));const job=STAR_CAREERS.find(c=>c.id===raw.careerId);need(job&&job.track===raw.track);
 return {careerId:job.id,careerName:job.name,description:job.description,learningTip:job.learningTip,type:raw.type,track:job.track,completedAt:raw.completedAt};
}
export function starScores(turns){
 const scores=Object.fromEntries(STAR_AXES.flatMap(a=>a.letters).map(l=>[l,0])),tracks=Object.fromEntries(STAR_ACTIVITIES.map(a=>[a.id,0]));
 turns.forEach((t,i)=>{scores[STAR_AXES[STAR_EVENTS[i].axis].letters[Number(t.choiceId)]]++;tracks[t.activityId]++;});return {scores,tracks};
}
export function starEnding(turns,completedAt){
 need(turns.length===12);const {scores,tracks}=starScores(turns),letters=STAR_AXES.map(a=>scores[a.letters[0]]>scores[a.letters[1]]?a.letters[0]:a.letters[1]);
 // Track ties use catalog order. Last three letters select one of eight story endings;
 // this is a game lookup, not a claim that real careers belong to a personality type.
 const track=STAR_ACTIVITIES.reduce((best,a)=>tracks[a.id]>tracks[best.id]?a:best).id;
 const index=letters.slice(1).reduce((n,l,i)=>n*2+Number(l===STAR_AXES[i+1].letters[1]),0);
 return ending({careerId:`${track}-${index}`,track,type:letters.join(''),completedAt});
}
export function validateStarRaising(raw){
 if(raw===undefined)return {run:null,album:[],recent:[]};
 need(raw&&typeof raw==='object'&&!Array.isArray(raw)&&Array.isArray(raw.album)&&raw.album.length<=48&&Array.isArray(raw.recent)&&raw.recent.length<=8);
 const album=raw.album.map(ending),recent=raw.recent.map(ending);need(new Set(album.map(e=>e.careerId)).size===album.length);
 let run=null;if(raw.run!==null){const r=raw.run;need(r&&uuid(r.id)&&time(r.startedAt)&&Array.isArray(r.turns)&&r.turns.length<=12);
  const turns=r.turns.map(t=>{need(t&&activity(t.activityId)&&['0','1'].includes(t.choiceId));return {activityId:t.activityId,choiceId:t.choiceId};});
  need(turns.length===12?time(r.completedAt)&&r.completedAt>=r.startedAt:r.completedAt===null);
  run={id:r.id,startedAt:r.startedAt,turns,completedAt:r.completedAt};
 }return {run,album,recent};
}
export function starView(raw){
 const s=validateStarRaising(raw),r=s.run,step=r?.turns.length??0,complete=step===12,last=step?STAR_EVENTS[step-1].choices.find(c=>c.id===r.turns[step-1].choiceId):null;
 return {runId:r?.id??null,step,status:complete?'complete':r?'playing':'idle',event:r&&!complete?structuredClone(STAR_EVENTS[step]):null,...starScores(r?.turns??[]),lastFeedback:last?.feedback??'',ending:complete?starEnding(r.turns,r.completedAt):null,album:s.album,recent:s.recent};
}
// Mutates only the caller's validated copy; actCozy commits after all reward checks.
export function actStarRaising(pet,data,now){
 const s=pet.raising,r=s.run;need(time(now));
 if(data.action==='raising:start'){
  need(data.runId===(r?.id??null)&&(!r||r.turns.length===12));
  s.run={id:randomUUID(),startedAt:now,turns:[],completedAt:null};return false;
 }
 need(data.action==='raising:choose'&&r&&r.turns.length<12&&data.runId===r.id&&Number.isInteger(data.step)&&data.step===r.turns.length&&activity(data.activityId)&&['0','1'].includes(data.choiceId));
 r.turns.push({activityId:data.activityId,choiceId:data.choiceId});
 if(r.turns.length!==12)return false;
 need(now>=r.startedAt&&Number.isSafeInteger(pet.careCount+3));pet.careCount+=3;r.completedAt=now;
 const result=starEnding(r.turns,now);if(!s.album.some(e=>e.careerId===result.careerId))s.album.push(result);
 s.recent=[result,...s.recent].slice(0,8);return true;
}
