import {randomInt,randomUUID} from 'node:crypto';
import {performance} from 'node:perf_hooks';
import {ensure} from './rooms.js';
import {currentWeekRecords} from './weekly-ranking.js';

export const DODGE_RULES=Object.freeze({
  width:600,height:420,playerRadius:14,playerSpeed:230,starRadius:10,
  baseWaveCount:2,waveMs:4000,baseStarSpeed:82,speedStep:7,
  inputStaleMs:300,maxStepMs:50,broadcastMs:50,maxActiveStars:120,top:10
});

const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));
const eligible=(room,player)=>!!player&&room?.players instanceof Map&&room.players.get(player.id)===player&&
  player.connected&&!player.away&&player.mapId==='star-street'&&
  (player.role==='student'||player.role==='teacher');

function normalize(x,y){
  if(!Number.isFinite(x)||!Number.isFinite(y))return {x:0,y:0};
  const length=Math.hypot(x,y);
  if(length>1)return {x:x/length,y:y/length};
  return {x:clamp(x,-1,1),y:clamp(y,-1,1)};
}

function starView(star){
  return {id:star.id,x:star.x,y:star.y,vx:star.vx,vy:star.vy,radius:star.radius};
}

function stateOf(run){
  return {
    runId:run.runId,status:run.status,arenaWidth:DODGE_RULES.width,arenaHeight:DODGE_RULES.height,
    elapsedMs:run.elapsedMs,wave:run.waveIndex+1,waveCount:DODGE_RULES.baseWaveCount+run.waveIndex,
    starSpeed:run.starSpeed,maxActiveStars:DODGE_RULES.maxActiveStars,
    player:{x:run.playerBody.x,y:run.playerBody.y,radius:run.playerBody.radius},
    stars:run.stars.map(starView)
  };
}

function spawnStar(run){
  const side=run.starSerial%4,along=()=>randomInt(20,side%2===0?DODGE_RULES.height-19:DODGE_RULES.width-19);
  const cross=(randomInt(501)-250)/1000;
  let x,y,dx,dy;
  if(side===0){x=-DODGE_RULES.starRadius;y=along();dx=1;dy=cross;}
  else if(side===1){x=along();y=-DODGE_RULES.starRadius;dx=cross;dy=1;}
  else if(side===2){x=DODGE_RULES.width+DODGE_RULES.starRadius;y=along();dx=-1;dy=cross;}
  else{x=along();y=DODGE_RULES.height+DODGE_RULES.starRadius;dx=cross;dy=-1;}
  const length=Math.hypot(dx,dy);
  run.stars.push({id:`${run.runId}:${++run.starSerial}`,x,y,
    vx:dx/length*run.starSpeed,vy:dy/length*run.starSpeed,radius:DODGE_RULES.starRadius});
}

function spawnWave(run,count){
  const available=Math.max(0,DODGE_RULES.maxActiveStars-run.stars.length);
  for(let i=0;i<Math.min(count,available);i++)spawnStar(run);
}

function increaseSpeed(run){
  run.starSpeed=DODGE_RULES.baseStarSpeed+DODGE_RULES.speedStep*run.waveIndex;
  for(const star of run.stars){
    const old=Math.hypot(star.vx,star.vy);
    if(old>0){star.vx=star.vx/old*run.starSpeed;star.vy=star.vy/old*run.starSpeed;}
  }
}

function segmentDistanceSquared(ax,ay,bx,by){
  const dx=bx-ax,dy=by-ay,lengthSquared=dx*dx+dy*dy;
  if(lengthSquared===0)return ax*ax+ay*ay;
  const t=clamp(-(ax*dx+ay*dy)/lengthSquared,0,1),x=ax+dx*t,y=ay+dy*t;
  return x*x+y*y;
}

function sweptHit(playerFrom,playerTo,starFrom,starTo,radius){
  return segmentDistanceSquared(starFrom.x-playerFrom.x,starFrom.y-playerFrom.y,
    starTo.x-playerTo.x,starTo.y-playerTo.y)<=radius*radius;
}

function naturallyGone(star){
  const r=star.radius;
  return (star.x < -r&&star.vx<=0)||(star.x>DODGE_RULES.width+r&&star.vx>=0)||
    (star.y < -r&&star.vy<=0)||(star.y>DODGE_RULES.height+r&&star.vy>=0);
}

export function dodgeRanking(room){
  room.dodgeRanking=currentWeekRecords(room.dodgeRanking||[]);
  room.dodgeRanking.sort((a,b)=>b.elapsedMs-a.elapsedMs||a.at-b.at||a.id.localeCompare(b.id));
  return room.dodgeRanking.map((record,index)=>({...record,rank:index+1}));
}

export function validateDodgeRanking(value){
  if(value===undefined)return [];
  const invalid=!Array.isArray(value)||value.length>DODGE_RULES.top||value.some(record=>
    !record||typeof record.id!=='string'||!record.id||typeof record.playerId!=='string'||!record.playerId||
    typeof record.nickname!=='string'||!/^[가-힣a-zA-Z0-9 _-]{1,12}$/.test(record.nickname)||
    !Number.isSafeInteger(record.elapsedMs)||record.elapsedMs<1||
    !Number.isSafeInteger(record.at)||record.at<0);
  if(invalid)throw new Error('별 피하기 순위 저장 데이터가 올바르지 않습니다.');
  return structuredClone(value).sort((a,b)=>b.elapsedMs-a.elapsedMs||a.at-b.at||a.id.localeCompare(b.id));
}

export function startDodgeRun(room,player,now=performance.now()){
  ensure(eligible(room,player),'오색별빛 쉼터에서 연결된 상태로 이용해주세요.');
  room.dodgeRuns??=new Map();
  ensure(room.dodgeRuns.get(player.id)?.status!=='pending','끝난 기록을 저장하는 중이에요. 잠시만 기다려주세요.');
  const run={
    runId:randomUUID(),playerId:player.id,status:'running',startedAt:now,lastAdvancedAt:now,
    elapsedMs:0,lastBroadcastAt:now,waveIndex:0,starSpeed:DODGE_RULES.baseStarSpeed,starSerial:0,stars:[],
    playerBody:{x:DODGE_RULES.width/2,y:DODGE_RULES.height/2,radius:DODGE_RULES.playerRadius},
    input:{x:0,y:0,at:now}
  };
  spawnWave(run,DODGE_RULES.baseWaveCount);
  room.dodgeRuns.set(player.id,run);
  return stateOf(run);
}

export function setDodgeInput(room,player,{runId,x,y}={},now=performance.now()){
  const run=room?.dodgeRuns?.get(player?.id);
  if(!run||run.runId!==runId||run.status!=='running')return;
  const direction=normalize(x,y);
  run.input={...direction,at:now};
}

export function cancelDodgeRun(room,player,runId){
  const run=room?.dodgeRuns?.get(player?.id);
  if(run?.runId===runId&&run.status==='running')room.dodgeRuns.delete(player.id);
}

export function advanceDodgeRuns(room,now=performance.now()){
  const updates=[];
  if(!(room?.dodgeRuns instanceof Map))return updates;
  for(const [playerId,run] of [...room.dodgeRuns]){
    if(run.status==='pending'){
      if(run.retryAt===undefined||now>=run.retryAt)updates.push({playerId,state:stateOf(run),finished:true});
      continue;
    }
    const player=room.players?.get(playerId);
    if(!eligible(room,player)){room.dodgeRuns.delete(playerId);continue;}

    const stepMs=Math.min(DODGE_RULES.maxStepMs,Math.max(0,now-run.lastAdvancedAt));
    run.elapsedMs+=stepMs;
    const targetWave=Math.floor(run.elapsedMs/DODGE_RULES.waveMs);
    while(run.waveIndex<targetWave){
      run.waveIndex++;
      increaseSpeed(run);
      spawnWave(run,DODGE_RULES.baseWaveCount+run.waveIndex);
    }

    const dt=stepMs/1000;
    if(now>run.lastAdvancedAt)run.lastAdvancedAt=now;
    const playerFrom={x:run.playerBody.x,y:run.playerBody.y};
    const fresh=now-run.input.at<=DODGE_RULES.inputStaleMs,ix=fresh?run.input.x:0,iy=fresh?run.input.y:0;
    const playerTo={
      x:clamp(playerFrom.x+ix*DODGE_RULES.playerSpeed*dt,run.playerBody.radius,DODGE_RULES.width-run.playerBody.radius),
      y:clamp(playerFrom.y+iy*DODGE_RULES.playerSpeed*dt,run.playerBody.radius,DODGE_RULES.height-run.playerBody.radius)
    };
    let hit=false;
    for(const star of run.stars){
      const starFrom={x:star.x,y:star.y},starTo={x:star.x+star.vx*dt,y:star.y+star.vy*dt};
      star.x=starTo.x;star.y=starTo.y;
      if(sweptHit(playerFrom,playerTo,starFrom,starTo,run.playerBody.radius+star.radius))hit=true;
    }
    run.playerBody.x=playerTo.x;run.playerBody.y=playerTo.y;
    if(hit){
      run.status='pending';run.elapsedMs=Math.max(1,Math.ceil(run.elapsedMs));
      updates.push({playerId,state:stateOf(run),finished:true});
      continue;
    }
    run.stars=run.stars.filter(star=>!naturallyGone(star));
    // Allow sub-millisecond timer jitter without skipping an otherwise 50ms broadcast.
    if(now-run.lastBroadcastAt>=DODGE_RULES.broadcastMs-0.5){
      run.lastBroadcastAt=now;
      updates.push({playerId,state:stateOf(run),finished:false});
    }
  }
  return updates;
}

export function completeDodgeRun(room,player,runId){
  const run=room?.dodgeRuns?.get(player?.id);
  ensure(run&&run.runId===runId&&run.status==='pending','끝난 별 피하기 기록을 찾지 못했어요.');
  room.dodgeRanking=currentWeekRecords(room.dodgeRanking||[]);
  const entry={id:run.runId,playerId:player.id,nickname:player.nickname,elapsedMs:run.elapsedMs,at:Date.now()};
  room.dodgeRanking.push(entry);
  room.dodgeRanking.sort((a,b)=>b.elapsedMs-a.elapsedMs||a.at-b.at||a.id.localeCompare(b.id));
  room.dodgeRanking=room.dodgeRanking.slice(0,DODGE_RULES.top);
  const rank=room.dodgeRanking.findIndex(record=>record.id===entry.id);
  room.dodgeRuns.delete(player.id);
  return {elapsedMs:entry.elapsedMs,rank:rank<0?null:rank+1,ranking:dodgeRanking(room)};
}
