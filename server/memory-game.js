import {randomInt,randomUUID} from 'node:crypto';
import {performance} from 'node:perf_hooks';
import {ensure} from './rooms.js';
import {currentWeekRecords} from './weekly-ranking.js';

const SYMBOLS=['🌙','⭐','🪐','☄️','🌌','🌟','🛰️','🌠','🔭','✨','🛸','💫','🌍','🌞','🚀','👽','🌈','🌸'];
export const MEMORY_RULES=Object.freeze({maxMs:60000,pairs:18,top:10,mismatchMs:600});
const order=(a,b)=>b.remainingMs-a.remainingMs||a.at-b.at||a.id.localeCompare(b.id);
export function memoryRanking(room){
  room.memoryRanking=currentWeekRecords(room.memoryRanking||[]).sort(order);
  return room.memoryRanking.map((r,i)=>({...r,rank:i+1}));
}
export function validateMemoryRanking(value){
  if(value===undefined)return [];
  if(!Array.isArray(value)||value.length>MEMORY_RULES.top||value.some(r=>
    !r||typeof r.id!=='string'||!r.id||typeof r.playerId!=='string'||!r.playerId||
    typeof r.nickname!=='string'||!/^[가-힣a-zA-Z0-9 _-]{1,12}$/.test(r.nickname)||
    !Number.isSafeInteger(r.remainingMs)||r.remainingMs<1||r.remainingMs>MEMORY_RULES.maxMs||
    !Number.isSafeInteger(r.at)||r.at<0))throw new Error('짝맞추기 순위 저장 데이터가 올바르지 않습니다.');
  return structuredClone(value).sort(order);
}
export function startMemoryRun(room,player,data,now=performance.now()){
  ensure(data.level==='high','상 난이도에서만 주간 기록을 남겨요.');
  const cards=SYMBOLS.flatMap(symbol=>[symbol,symbol]);
  for(let i=cards.length-1;i>0;i--){const j=randomInt(i+1);[cards[i],cards[j]]=[cards[j],cards[i]];}
  const run={runId:randomUUID(),cards,startedAt:now,step:0,open:[],matched:[],lockedUntil:0};
  room.memoryRuns??=new Map();room.memoryRuns.set(player.id,run);
  return {runId:run.runId,step:0,remainingMs:MEMORY_RULES.maxMs};
}
export function cancelMemoryRun(room,player,runId){
  if(room.memoryRuns?.get(player.id)?.runId===runId)room.memoryRuns.delete(player.id);
}
export function flipMemoryCard(room,player,data,now=performance.now()){
  const run=room.memoryRuns?.get(player.id);
  ensure(run&&run.runId===data.runId,'게임을 다시 시작해주세요.');
  // 성공 여부와 시간은 서버의 단조 시계로만 판정합니다. 마지막 카드도 마감 시각에는 실패합니다.
  const left=MEMORY_RULES.maxMs-(now-run.startedAt);
  if(left<=0){room.memoryRuns.delete(player.id);return {done:true,won:false,remainingMs:0};}
  ensure(Number.isInteger(data.step)&&data.step===run.step,'이미 처리된 카드예요.');
  ensure(Number.isInteger(data.index)&&data.index>=0&&data.index<run.cards.length,'카드를 확인해주세요.');
  ensure(now>=run.lockedUntil,'카드가 다시 닫힌 뒤 골라주세요.');
  ensure(!run.matched.includes(data.index)&&!run.open.includes(data.index),'다른 카드를 골라주세요.');
  run.open.push(data.index);run.step++;
  const result={done:false,step:run.step,index:data.index,symbol:run.cards[data.index],remainingMs:Math.ceil(left)};
  if(run.open.length===2){
    const [a,b]=run.open;result.pair=[a,b];result.match=run.cards[a]===run.cards[b];run.open=[];
    if(result.match)run.matched.push(a,b);else run.lockedUntil=now+MEMORY_RULES.mismatchMs;
  }
  if(run.matched.length===run.cards.length){
    const entry={id:run.runId,playerId:player.id,nickname:player.nickname,remainingMs:Math.ceil(left),at:Date.now()};
    room.memoryRanking=[...currentWeekRecords(room.memoryRanking||[]),entry].sort(order).slice(0,MEMORY_RULES.top);
    room.memoryRuns.delete(player.id);
    Object.assign(result,{done:true,won:true,ranking:memoryRanking(room),rank:room.memoryRanking.findIndex(r=>r.id===entry.id)+1||null});
  }
  return result;
}
