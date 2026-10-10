import {randomInt,randomUUID} from 'node:crypto';
import {ensure} from './rooms.js';
import {currentWeekRecords} from './weekly-ranking.js';

const order=(a,b)=>b.stage-a.stage||a.at-b.at||a.id.localeCompare(b.id);
export function signalRanking(room){
  room.signalRanking=currentWeekRecords(room.signalRanking||[]).sort(order);
  return room.signalRanking.map((record,index)=>({...record,rank:index+1}));
}
export function validateSignalRanking(value){
  if(value===undefined)return [];
  if(!Array.isArray(value)||value.length>30||value.some(record=>!record||typeof record.id!=='string'||!record.id||
    typeof record.playerId!=='string'||!record.playerId||typeof record.nickname!=='string'||record.nickname.length>12||
    !Number.isSafeInteger(record.stage)||record.stage<1||record.stage>6||!Number.isSafeInteger(record.at)||record.at<0))throw new Error('우주 신호 랭킹 저장 데이터가 올바르지 않습니다.');
  return structuredClone(value).sort(order);
}
export function createSignalRuns(){
  return {
    start(player){
      const run={runId:randomUUID(),round:1,sequence:[randomInt(4),randomInt(4)],index:0,lives:3};
      player.signalRun=run;
      return {runId:run.runId,round:run.round,sequence:[...run.sequence],lives:run.lives};
    },
    choose(room,player,data,now=Date.now()){
      const run=player.signalRun;
      ensure(run&&run.runId===data?.runId,'우주 신호 게임을 다시 시작해 주세요.');
      ensure(Number.isSafeInteger(data.signal)&&data.signal>=0&&data.signal<4,'신호를 골라 주세요.');
      if(data.signal!==run.sequence[run.index]){
        run.lives--;run.index=0;
        const done=run.lives===0;if(done)delete player.signalRun;
        return {correct:false,done,won:false,round:run.round,lives:run.lives,...(done?{}:{sequence:[...run.sequence]})};
      }
      run.index++;
      if(run.index<run.sequence.length)return {correct:true,done:false,round:run.round,lives:run.lives};
      const stageCleared=run.round;
      room.signalRanking=currentWeekRecords(room.signalRanking||[]);
      const existing=room.signalRanking.find(record=>record.playerId===player.id);
      if(!existing||existing.stage<stageCleared){
        if(existing){existing.stage=stageCleared;existing.at=now;}
        else room.signalRanking.push({id:randomUUID(),playerId:player.id,nickname:player.nickname,stage:stageCleared,at:now});
        room.signalRanking.sort(order);
      }
      if(run.round===6){delete player.signalRun;return {correct:true,done:true,won:true,stageCleared,round:6,lives:run.lives,ranking:signalRanking(room)};}
      run.round++;run.sequence.push(randomInt(4));run.index=0;
      return {correct:true,done:false,stageCleared,round:run.round,lives:run.lives,sequence:[...run.sequence],ranking:signalRanking(room)};
    }
  };
}
