import {randomInt,randomUUID} from 'node:crypto';
import {performance} from 'node:perf_hooks';
import {ensure} from './rooms.js';
import {currentWeekRecords} from './weekly-ranking.js';

export const TETRIS_SIZE=Object.freeze({width:10,height:20});
const SHAPES=[
  [[0,1],[1,1],[2,1],[3,1]], // I
  [[1,0],[2,0],[1,1],[2,1]], // O
  [[1,0],[0,1],[1,1],[2,1]], // T
  [[1,0],[2,0],[0,1],[1,1]], // S
  [[0,0],[1,0],[1,1],[2,1]], // Z
  [[0,0],[0,1],[1,1],[2,1]], // J
  [[2,0],[0,1],[1,1],[2,1]]  // L
];
const order=(a,b)=>b.lines-a.lines||a.at-b.at||a.id.localeCompare(b.id);
const cells=(type,rotation)=>{
  let points=SHAPES[type].map(([x,y])=>[x,y]);
  for(let turn=0;turn<rotation;turn++){
    points=points.map(([x,y])=>[-y,x]);
    const minX=Math.min(...points.map(p=>p[0])),minY=Math.min(...points.map(p=>p[1]));
    points=points.map(([x,y])=>[x-minX,y-minY]);
  }
  return points;
};
const speedAt=elapsed=>Math.max(115,850-Math.floor(elapsed/20000)*85);
const spawnDelayAt=elapsed=>Math.max(70,360-Math.floor(elapsed/20000)*35);
const emptyBoard=()=>Array.from({length:TETRIS_SIZE.height},()=>Array(TETRIS_SIZE.width).fill(0));

export function validateTetrisRanking(value){
  if(value===undefined)return [];
  if(!Array.isArray(value)||value.length>30||value.some(r=>!r||typeof r.id!=='string'||!r.id||
    typeof r.playerId!=='string'||!r.playerId||typeof r.nickname!=='string'||r.nickname.length>12||
    !Number.isSafeInteger(r.lines)||r.lines<1||r.lines>10000||!Number.isSafeInteger(r.at)||r.at<0))
    throw new Error('별 테트리스 순위 저장 데이터가 올바르지 않습니다.');
  return structuredClone(value).sort(order);
}
export function tetrisRanking(room){
  room.tetrisRanking=currentWeekRecords(room.tetrisRanking||[]).sort(order);
  return room.tetrisRanking.map((entry,index)=>({...entry,rank:index+1}));
}

export function createTetrisRuns({randomPiece=()=>randomInt(7)}={}){
  const pick=()=>{const type=randomPiece();ensure(Number.isInteger(type)&&type>=0&&type<7,'테트리스 블록을 준비하지 못했어요.');return type;};
  const fits=(run,piece)=>cells(piece.type,piece.rotation).every(([dx,dy])=>{
    const x=piece.x+dx,y=piece.y+dy;
    return x>=0&&x<TETRIS_SIZE.width&&y<TETRIS_SIZE.height&&(y<0||run.board[y][x]===0);
  });
  const spawn=run=>{
    const type=run.nextType;run.nextType=pick();
    const width=Math.max(...cells(type,0).map(p=>p[0]))+1;
    run.current={type,x:Math.floor((TETRIS_SIZE.width-width)/2),y:0,rotation:0};
    if(!fits(run,run.current)){run.current=null;run.done=true;}
  };
  const lock=run=>{
    for(const [dx,dy] of cells(run.current.type,run.current.rotation)){
      const x=run.current.x+dx,y=run.current.y+dy;
      if(y>=0)run.board[y][x]=run.current.type+1;
    }
    const kept=run.board.filter(row=>row.some(value=>value===0));
    const cleared=TETRIS_SIZE.height-kept.length;
    run.board=[...Array.from({length:cleared},()=>Array(TETRIS_SIZE.width).fill(0)),...kept];
    run.lines+=cleared;run.current=null;return cleared;
  };
  const advance=(run,now)=>{
    let steps=0;
    while(!run.done&&now>=run.nextAt&&steps++<1000){
      const at=run.nextAt,elapsed=Math.max(0,at-run.startedAt);
      if(!run.current){spawn(run);run.nextAt=at+speedAt(elapsed);continue;}
      const next={...run.current,y:run.current.y+1};
      if(fits(run,next)){run.current=next;run.nextAt=at+speedAt(elapsed);}
      else{lock(run);run.nextAt=at+spawnDelayAt(elapsed);}
    }
  };
  const view=(run,now)=>({runId:run.runId,board:run.board.map(row=>[...row]),
    current:run.current?{...run.current,cells:cells(run.current.type,run.current.rotation)}:null,
    nextType:run.nextType,lines:run.lines,done:run.done,speedMs:speedAt(Math.max(0,now-run.startedAt)),
    elapsedMs:Math.max(0,Math.floor(now-run.startedAt))});
  const active=(player,runId)=>{
    const run=player.tetrisRun;ensure(run&&run.runId===runId,'별 테트리스를 다시 시작해 주세요.');return run;
  };
  return {
    start(player,now=performance.now()){
      const run={runId:randomUUID(),board:emptyBoard(),current:null,nextType:pick(),lines:0,done:false,startedAt:now,nextAt:now};
      spawn(run);run.nextAt=now+speedAt(0);player.tetrisRun=run;return view(run,now);
    },
    state(player,data,now=performance.now()){
      const run=active(player,data?.runId);advance(run,now);return view(run,now);
    },
    move(player,data,now=performance.now()){
      const run=active(player,data?.runId);advance(run,now);
      ensure(['left','right','rotate'].includes(data?.move),'움직일 방향을 골라 주세요.');
      if(!run.done&&run.current){
        const base=run.current;
        const candidate=data.move==='left'?{...base,x:base.x-1}:data.move==='right'?{...base,x:base.x+1}:{...base,rotation:(base.rotation+1)%4};
        const offsets=data.move==='rotate'?[0,-1,1,-2,2]:[0];
        for(const offset of offsets){const shifted={...candidate,x:candidate.x+offset};if(fits(run,shifted)){run.current=shifted;break;}}
      }
      return view(run,now);
    },
    finish(room,player,data,now=performance.now(),at=Date.now()){
      const run=active(player,data?.runId);advance(run,now);
      ensure(run.done,'블록이 꼭대기에 닿으면 기록을 저장할 수 있어요.');
      delete player.tetrisRun;
      if(run.lines>0){
        room.tetrisRanking=currentWeekRecords(room.tetrisRanking||[]);
        const existing=room.tetrisRanking.find(r=>r.playerId===player.id);
        if(!existing||run.lines>existing.lines){
          if(existing){existing.lines=run.lines;existing.at=at;existing.nickname=player.nickname;}
          else room.tetrisRanking.push({id:randomUUID(),playerId:player.id,nickname:player.nickname,lines:run.lines,at});
          room.tetrisRanking.sort(order);room.tetrisRanking=room.tetrisRanking.slice(0,30);
        }
      }
      return {...view(run,now),ranking:tetrisRanking(room)};
    }
  };
}
