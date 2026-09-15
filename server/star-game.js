import {randomInt,randomUUID} from 'node:crypto';
import {performance} from 'node:perf_hooks';
import {ensure} from './rooms.js';
import {currentWeekRecords} from './weekly-ranking.js';

export const STAR_GAME=Object.freeze({cells:16,clicks:10,top:10,maxMs:300000});
const targetAfter=previous=>{let n=randomInt(STAR_GAME.cells-1);return n>=previous?n+1:n;};
export function starRanking(room){room.starRanking=currentWeekRecords(room.starRanking||[]);return room.starRanking.map((r,i)=>({...r,rank:i+1}));}
export function validateStarRanking(value){
  if(value===undefined)return [];
  if(!Array.isArray(value)||value.length>STAR_GAME.top||value.some(r=>!r||typeof r.id!=='string'||typeof r.playerId!=='string'||typeof r.nickname!=='string'||r.nickname.length>12||!Number.isSafeInteger(r.elapsedMs)||r.elapsedMs<1||r.elapsedMs>STAR_GAME.maxMs||!Number.isSafeInteger(r.at)))throw new Error('별 찾기 순위 저장 데이터가 올바르지 않습니다.');
  return structuredClone(value).sort((a,b)=>a.elapsedMs-b.elapsedMs||a.at-b.at);
}
export function startStarRun(room,player,now=performance.now()){
  room.starRuns??=new Map();
  const run={runId:randomUUID(),step:0,target:randomInt(STAR_GAME.cells),startedAt:now};
  room.starRuns.set(player.id,run);return {runId:run.runId,step:run.step,target:run.target,elapsedMs:0};
}
export function cancelStarRun(room,player,runId){
  if(room.starRuns?.get(player.id)?.runId===runId)room.starRuns.delete(player.id);
}
export function clickStar(room,player,data,now=performance.now()){
  const run=room.starRuns?.get(player.id);
  ensure(run&&run.runId===data.runId,'게임을 다시 시작해주세요.');
  ensure(now-run.startedAt<=STAR_GAME.maxMs,'5분이 지나 게임이 끝났어요. 다시 시작해주세요.');
  ensure(Number.isInteger(data.step)&&data.step===run.step,'이미 처리된 클릭이에요. 다음 별을 눌러주세요.');
  ensure(Number.isInteger(data.target)&&data.target===run.target,'빛나는 별을 눌러주세요.');
  run.step++;
  const elapsedMs=Math.max(1,Math.ceil(now-run.startedAt));
  if(run.step===STAR_GAME.clicks){
    room.starRuns.delete(player.id);
    // 경험치/재화는 주지 않습니다. 소규모 교실의 최고 기록 열 개만 보관합니다.
    const entry={id:run.runId,playerId:player.id,nickname:player.nickname,elapsedMs,at:Date.now()};
    room.starRanking=[...currentWeekRecords(room.starRanking||[]),entry].sort((a,b)=>a.elapsedMs-b.elapsedMs||a.at-b.at).slice(0,STAR_GAME.top);
    return {done:true,step:run.step,elapsedMs,rank:room.starRanking.findIndex(r=>r.id===entry.id)+1||null,ranking:starRanking(room)};
  }
  run.target=targetAfter(run.target);
  return {done:false,runId:run.runId,step:run.step,target:run.target,elapsedMs};
}
