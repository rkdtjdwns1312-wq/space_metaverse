import {ensureVitals,damagePlayer} from './vitals.js';
import {defeatRecordPlayer} from './star-record-challenge.js';

export const STAR_RECORD_FLOW=Object.freeze({mana:10,cooldownMs:30000,durationMs:10000,decisionMs:3000,chance:.45});
const directions=['동','서','남','북'];
const roll=(random,length)=>Math.min(length-1,Math.max(0,Math.floor((Number(random())||0)*length)));
function shuffled(random){const result=[...directions];for(let i=result.length-1;i>0;i--){const j=roll(random,i+1);[result[i],result[j]]=[result[j],result[i]];}return result;}
function directionOf(x,y){if(Math.abs(x)<.25&&Math.abs(y)<.25)return null;
  if(Math.abs(x)>Math.abs(y)*1.2)return x>0?'동':'서';
  if(Math.abs(y)>Math.abs(x)*1.2)return y>0?'남':'북';
  return null;
}
export function tryStarRecordFlow(room,boss,now=Date.now(),random=Math.random){
  const rule=STAR_RECORD_FLOW;
  if(boss.typeId!=='star-record'||boss.hp<=0||boss.recordFlow||boss.recordChallenge||boss.recordMath||boss.starRecordCast||
    now<(boss.recordFlowReadyAt||0)||now<(boss.recordFlowDecisionAt||0)||boss.mp<rule.mana)return false;
  boss.recordFlowDecisionAt=now+rule.decisionMs;
  if((Number(random())||0)>=rule.chance)return false;
  const players=[...room.players.values()].filter(player=>player.connected&&!player.away&&player.mapId===boss.mapId&&ensureVitals(player)?.hp>0);
  if(!players.length)return false;
  boss.mp-=rule.mana;boss.recordFlowReadyAt=now+rule.cooldownMs;
  boss.recordFlow={startsAt:now,endsAt:now+rule.durationMs,participants:new Map(players.map(player=>[player.id,
    {sequence:shuffled(random),index:0,lastDirection:directionOf(player.input?.x||0,player.input?.y||0),done:false}]))};
  boss.moving=false;return true;
}
export function recordStarRecordMovement(room,player,x,y,now=Date.now()){
  const boss=room.monsters?.get('star-record-boss'),flow=boss?.recordFlow,entry=flow?.participants.get(player.id);
  if(!entry||entry.done||now>=flow.endsAt||player.mapId!==boss.mapId||ensureVitals(player)?.hp<=0)return null;
  const direction=directionOf(x,y);
  if(!direction){entry.lastDirection=null;return null;}
  if(entry.lastDirection===direction)return null;
  entry.lastDirection=direction;
  if(direction===entry.sequence[entry.index]){entry.index++;if(entry.index===4)entry.done=true;return {correct:true,done:entry.done};}
  entry.index=0;
  const hit=damagePlayer(player,30,now,{room});
  return {correct:false,hit:hit&&{monsterId:boss.id,mapId:boss.mapId,x:player.x,y:player.y,
    targetId:player.id,skillKind:'star-record-flow-wrong',...hit}};
}
export function tickStarRecordFlow(room,boss,now=Date.now()){
  const flow=boss.recordFlow;if(!flow)return {busy:false,hits:[]};
  boss.moving=false;if(now<flow.endsAt){if([...flow.participants.values()].every(entry=>entry.done))boss.recordFlow=null;return {busy:true,hits:[]};}
  boss.recordFlow=null;
  const hits=[];for(const [id,entry] of flow.participants){
    if(entry.done)continue;const player=room.players.get(id);
    if(!player?.connected||player.away||player.mapId!==boss.mapId||ensureVitals(player)?.hp<=0)continue;
    hits.push({monsterId:boss.id,mapId:boss.mapId,x:player.x,y:player.y,targetId:id,
      skillKind:'star-record-flow-timeout',...defeatRecordPlayer(room,player,now)});
  }
  return {busy:true,hits};
}
export function starRecordFlowView(boss,now=Date.now()){
  const flow=boss.recordFlow;if(!flow||now>=flow.endsAt)return null;
  return {line:'세계의 자연스러운 흐름을 느껴라',endsAt:flow.endsAt,
    prompts:[...flow.participants].filter(([,entry])=>!entry.done).map(([playerId,entry])=>({playerId,
      remaining:entry.sequence.slice(entry.index),endsAt:flow.endsAt}))};
}
