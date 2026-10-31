import {currentWeekRecords} from './weekly-ranking.js';
import {ensure} from './rooms.js';

const validName=value=>typeof value==='string'&&/^[가-힣a-zA-Z0-9 _-]{1,12}$/.test(value);

export function validateOmokWinRecords(value){
  if(value===undefined)return [];
  if(!Array.isArray(value)||value.length>20000||value.some(row=>!row||typeof row.id!=='string'||!row.id||
    typeof row.playerId!=='string'||!row.playerId||!validName(row.nickname)||!Number.isSafeInteger(row.at)||row.at<0))
    throw new Error('오목 명예의 전당 저장 데이터가 올바르지 않습니다.');
  return structuredClone(value);
}

export function recordOmokWin(room,{matchId,playerId,nickname,at=Date.now()}){
  ensure(room&&typeof matchId==='string'&&matchId&&typeof playerId==='string'&&playerId&&validName(nickname)&&Number.isSafeInteger(at)&&at>=0,
    '오목 승리 기록을 확인해주세요.');
  const rows=currentWeekRecords(room.omokWinRecords||[],at);
  if(rows.some(row=>row.id===matchId))return false;
  room.omokWinRecords=[...rows,{id:matchId,playerId,nickname,at}];
  return true;
}

const leadersAt=(rows,valueOf,{bestMode=false}={})=>{
  if(!rows.length)return [];
  const scores=new Map();
  for(const row of rows){const current=scores.get(row.playerId)||{playerId:row.playerId,nickname:row.nickname,score:bestMode?-Infinity:0};
    current.score=bestMode?Math.max(current.score,valueOf(row)):current.score+valueOf(row);scores.set(row.playerId,current);}
  const all=[...scores.values()],best=Math.max(...all.map(row=>row.score));
  return all.filter(row=>row.score===best).map(({nickname,score})=>({nickname,score})).sort((a,b)=>a.nickname.localeCompare(b.nickname,'ko'));
};
const game=(id,title,rows,valueOf,options)=>{const leaders=leadersAt(rows,valueOf,options);return {id,title,winners:leaders.map(row=>row.nickname),leaders};};

export function hallOfFame(room,now=Date.now()){
  const records={
    memory:currentWeekRecords(room?.memoryRanking||[],now),
    dodge:currentWeekRecords(room?.dodgeRanking||[],now),
    tetris:currentWeekRecords(room?.tetrisRanking||[],now),
    signal:currentWeekRecords(room?.signalRanking||[],now),
    omok:currentWeekRecords(room?.omokWinRecords||[],now)
  };
  const games=[
    game('memory','별 그림 짝 맞추기 · 상 난이도 · 이번 주',records.memory,row=>row.remainingMs,{bestMode:true}),
    game('dodge','별 피하기 · 이번 주',records.dodge,row=>row.elapsedMs,{bestMode:true}),
    game('tetris','별 테트리스 · 이번 주',records.tetris,row=>row.lines,{bestMode:true}),
    game('signal','우주 신호 따라하기 · 이번 주',records.signal,row=>row.stage,{bestMode:true}),
    game('omok','별 오목 · 이번 주 승리',records.omok,()=>1)
  ];
  return {games,memory:games[0],omok:games.at(-1)};
}
