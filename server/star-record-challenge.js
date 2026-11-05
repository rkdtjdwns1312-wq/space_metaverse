import {ensureVitals,playerVitals,libraProtectors} from './vitals.js';

export const STAR_RECORD_CHALLENGE=Object.freeze({mana:10,cooldownMs:40000,totalMs:10000,rounds:2,decisionMs:3000,chance:.55});
export const RECORD_PLANETS=Object.freeze(['금성','지구','화성','목성','토성','천왕성','해왕성']);
const roll=(random,length)=>Math.min(length-1,Math.max(0,Math.floor((Number(random())||0)*length)));
const eligible=(room,boss)=>[...room.players.values()].filter(player=>player.connected&&!player.away&&player.mapId===boss.mapId&&
  !player.avatar?.blackStar&&ensureVitals(player)?.hp>0);
export function defeatRecordPlayer(room,player,now,{bypassProtection=false}={}){
  if(!bypassProtection&&libraProtectors(room,player,now).length)return {damage:0,vitals:playerVitals(player),defeated:false,immune:true};
  const value=ensureVitals(player),damage=value.hp;
  value.hp=0;value.defeatedAt=now;player.input={x:0,y:0,at:0};
  (player.damageNumbers??=[]).push({targetId:player.id,targetKind:'player',mapId:player.mapId,x:player.x,y:player.y,damage});
  if(player.damageNumbers.length>40)player.damageNumbers.shift();
  return {damage,vitals:playerVitals(player),defeated:true};
}
export function tryStarRecordChallenge(room,boss,now=Date.now(),random=Math.random){
  if(boss.typeId!=='star-record'||boss.hp<=0||boss.recordChallenge||boss.recordMath||boss.recordFlow||boss.starRecordCast||
    now<(boss.recordChallengeReadyAt||0)||now<(boss.recordChallengeDecisionAt||0)||boss.mp<STAR_RECORD_CHALLENGE.mana)return false;
  boss.recordChallengeDecisionAt=now+STAR_RECORD_CHALLENGE.decisionMs;
  if((Number(random())||0)>=STAR_RECORD_CHALLENGE.chance)return false;
  const players=eligible(room,boss);if(!players.length)return false;
  const participants=new Map(players.map(player=>{
    const first=roll(random,RECORD_PLANETS.length),secondChoices=RECORD_PLANETS.filter((_,index)=>index!==first);
    return [player.id,{planets:[RECORD_PLANETS[first],secondChoices[roll(random,secondChoices.length)]],round:0,done:false}];
  }));
  boss.mp-=STAR_RECORD_CHALLENGE.mana;
  boss.recordChallengeReadyAt=now+STAR_RECORD_CHALLENGE.cooldownMs;
  boss.recordChallenge={startsAt:now,endsAt:now+STAR_RECORD_CHALLENGE.totalMs,participants};
  boss.moving=false;return true;
}
export function answerStarRecordChallenge(room,player,text,now=Date.now()){
  const boss=room.monsters?.get('star-record-boss'),challenge=boss?.recordChallenge,entry=challenge?.participants.get(player.id);
  if(!entry||entry.done||player.mapId!==boss.mapId||!player.connected||player.away||ensureVitals(player)?.hp<=0)return false;
  if(now>=challenge.endsAt||text!==entry.planets[entry.round])return false;
  entry.round++;if(entry.round>=STAR_RECORD_CHALLENGE.rounds)entry.done=true;
  return true;
}
export function tickStarRecordChallenge(room,boss,now=Date.now()){
  const challenge=boss.recordChallenge;if(!challenge)return {busy:false,hits:[]};
  const hits=[];
  for(const [id,entry] of challenge.participants){
    if(entry.done)continue;
    const player=room.players.get(id);
    if(!player?.connected||player.away||player.mapId!==boss.mapId||ensureVitals(player)?.hp<=0){entry.done=true;continue;}
    if(now<challenge.endsAt)continue;
    entry.done=true;
    hits.push({monsterId:boss.id,mapId:boss.mapId,x:player.x,y:player.y,skillKind:'star-record-challenge',durationMs:450,
      targetId:id,...defeatRecordPlayer(room,player,now)});
  }
  boss.moving=false;
  if(now>=challenge.endsAt||[...challenge.participants.values()].every(entry=>entry.done))boss.recordChallenge=null;
  return {busy:true,hits};
}
export function starRecordChallengeView(boss,now=Date.now()){
  const challenge=boss.recordChallenge;if(!challenge)return null;
  return {line:'세계를 올바르게 기록하여라',startsAt:challenge.startsAt,endsAt:challenge.endsAt,
    prompts:[...challenge.participants].filter(([,entry])=>!entry.done&&now<challenge.endsAt)
      .map(([playerId,entry])=>({playerId,planet:entry.planets[entry.round],round:entry.round+1,
        endsAt:challenge.endsAt}))};
}
