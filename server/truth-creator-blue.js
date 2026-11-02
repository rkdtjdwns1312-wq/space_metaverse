import {randomUUID} from 'node:crypto';
import {TRUTH_CREATOR_BLUE as RULE,TRUTH_CREATOR_BLUE_ACTIONS as ACTIONS} from '../shared/truth-creator-blue.js';
import {TRUTH_CREATOR} from '../shared/truth-creator.js';
import {mapOf,interactionDistance,interactionReach} from '../shared/config.js';
import {onOriginFloor} from '../shared/origin-floor.js';
import {ensureVitals} from './vitals.js';
import {defeatRecordPlayer} from './star-record-challenge.js';
import {ensure} from './rooms.js';

const present=(boss,p)=>p?.connected&&!p.away&&!p.avatar?.blackStar&&p.mapId===boss.mapId&&ensureVitals(p)?.hp>0;
const targetable=(boss,p)=>present(boss,p)&&!(p.role==='teacher'&&(p.avatar?.teacherPreview||!boss.teacherRetaliation?.has(p.id)));
const canInteract=(boss,p)=>present(boss,p)&&['student','teacher'].includes(p.role)&&!p.avatar?.teacherPreview;
const stateOf=boss=>boss.truthCreatorBlue??={mapId:boss.mapId,readyAt:0,orbs:[]};
const roll=random=>Math.max(0,Math.min(.999999999,Number(random())||0));
export function clearTruthCreatorBlue(boss){boss.truthCreatorBlue=null;}
function sequence(random){
  const result=Array.from({length:RULE.sequenceLength},()=>ACTIONS[Math.floor(roll(random)*ACTIONS.length)]);
  if(result.every(action=>action===result[0]))result[result.length-1]=result[0]==='attack'?'skill':'attack';
  return result;
}
function landingPoints(room,boss,random){
  const map=mapOf(boss.mapId),points=[],players=[...room.players.values()].filter(p=>present(boss,p));
  const offset=roll(random)*Math.PI*2;
  for(let i=0;i<RULE.count;i++){
    const candidates=[];
    for(const distance of [RULE.distance,360,270])for(let step=0;step<32;step++){
      const angle=offset+i*Math.PI*2/3+(roll(random)-.5)*.4+step*Math.PI/16;
      const x=boss.x+Math.cos(angle)*distance,y=boss.y+Math.sin(angle)*distance;
      if(!onOriginFloor(map,x,y,RULE.radius)||points.some(p=>Math.hypot(x-p.x,y-p.y)<RULE.radius*2+90))continue;
      if(Array.from({length:8},(_,n)=>(n+1)/8).some(t=>!onOriginFloor(map,boss.x+(x-boss.x)*t,boss.y+(y-boss.y)*t,RULE.radius)))continue;
      const separation=Math.min(400,...points.map(p=>Math.hypot(x-p.x,y-p.y)));
      const clearance=Math.min(180,...players.map(p=>Math.hypot(x-p.x,y-p.y)));
      const occupied=[...(room.monsters?.values()||[])].some(m=>m.hp>0&&m!==boss&&m.mapId===boss.mapId&&Math.hypot(x-m.x,y-m.y)<RULE.radius+m.radius+20);
      candidates.push({x,y,score:separation+clearance+(occupied?-200:0)-step*.5});
    }
    if(!candidates.length)return null;
    candidates.sort((a,b)=>b.score-a.score);const {x,y}=candidates[0];points.push({x,y});
  }
  return points;
}
export function tryTruthCreatorBlue(room,boss,target,now=Date.now(),random=Math.random){
  if(boss.typeId!==TRUTH_CREATOR.typeId||boss.hp<=0||!targetable(boss,target)||!Number.isFinite(now)||
    (boss.sleepUntil||0)>now||(boss.stunUntil||0)>now)return false;
  if(boss.truthCreatorChasers?.orbs?.length||boss.truthCreatorGalaxy?.orbs?.length||boss.truthCreatorGalaxy?.queue?.length)return false;
  const state=stateOf(boss);if(state.orbs.length||now<state.readyAt||boss.mp<RULE.mana)return false;
  const points=landingPoints(room,boss,random);if(!points){state.readyAt=now+1000;return false;}
  const landsAt=now+RULE.flightMs,endsAt=landsAt+RULE.durationMs;
  state.orbs=points.map(point=>({id:`${boss.id}-blue-${randomUUID()}`,fromX:boss.x,fromY:boss.y,x:point.x,y:point.y,radius:RULE.radius,
    startsAt:now,landsAt,endsAt,sequence:sequence(random),progress:0,revision:0,sessions:new Map()}));
  state.readyAt=now+RULE.cooldownMs;boss.mp-=RULE.mana;return true;
}
function orbView(orb,now){
  const fraction=Math.max(0,Math.min(1,(now-orb.startsAt)/(orb.landsAt-orb.startsAt)));
  return {id:orb.id,x:orb.fromX+(orb.x-orb.fromX)*fraction,y:orb.fromY+(orb.y-orb.fromY)*fraction,radius:orb.radius,
    phase:now<orb.landsAt?'flying':'landed',landsAt:orb.landsAt,endsAt:orb.endsAt};
}
const puzzleView=(orb,now)=>({...orbView(orb,now),sequence:[...orb.sequence],progress:orb.progress,revision:orb.revision});
export function truthCreatorBlueViews(boss,now){
  const state=boss.truthCreatorBlue;if(!state||boss.hp<=0||state.mapId!==boss.mapId)return [];
  return state.orbs.filter(orb=>now<orb.endsAt).map(orb=>orbView(orb,now));
}
function requireOrb(room,player,id,now){
  const boss=room.monsters?.get(TRUTH_CREATOR.monsterId),state=boss?.truthCreatorBlue;
  ensure(boss?.hp>0&&state&&state.mapId===boss.mapId&&room.players.get(player?.id)===player&&canInteract(boss,player),'지금은 파란 구체를 해제할 수 없어요.');
  ensure(typeof id==='string','파란 구체를 선택해 주세요.');
  const orb=state.orbs.find(orb=>orb.id===id);
  ensure(orb&&now>=orb.landsAt&&now<orb.endsAt,'파란 구체가 아직 날아가거나 해제 시간이 끝났어요.');
  ensure(interactionDistance(player,orb)<=interactionReach(orb),'파란 구체 가까이에서 다시 시도해 주세요.');
  return {boss,state,orb};
}
export function openTruthCreatorBlue(room,player,orbId,now=Date.now()){
  const {orb}=requireOrb(room,player,orbId,now),interactionToken=randomUUID();
  orb.sessions.set(player.id,{interactionToken,socketId:player.socketId});
  return {orb:puzzleView(orb,now),interactionToken,serverNow:now};
}
export function inputTruthCreatorBlue(room,player,data,now=Date.now()){
  const {state,orb}=requireOrb(room,player,data?.orbId,now),session=orb.sessions.get(player.id);
  ensure(session&&session.socketId===player.socketId&&session.interactionToken===data?.interactionToken,'파란 구체를 다시 조사해 주세요.');
  ensure(ACTIONS.includes(data?.action)&&Number.isSafeInteger(data?.revision)&&data.revision>=0,'공격 또는 스킬 순서 입력을 확인해 주세요.');
  // Stale packets and simultaneous inputs never advance twice or reset another player's progress.
  if(data.revision!==orb.revision)return {orb:puzzleView(orb,now),correct:false,disarmed:false,stale:true,serverNow:now};
  const correct=data.action===orb.sequence[orb.progress];orb.progress=correct?orb.progress+1:0;orb.revision++;
  const disarmed=orb.progress===orb.sequence.length;
  if(disarmed){state.orbs=state.orbs.filter(value=>value!==orb);orb.sessions.clear();}
  return {orb:disarmed?null:puzzleView(orb,now),correct,disarmed,serverNow:now};
}
export function tickTruthCreatorBlue(room,boss,now){
  const state=boss.truthCreatorBlue,hits=[];if(!state)return hits;
  if(boss.hp<=0||state.mapId!==boss.mapId||![...room.players.values()].some(player=>targetable(boss,player))){clearTruthCreatorBlue(boss);return hits;}
  for(const orb of state.orbs)for(const [id,session] of orb.sessions){const player=room.players.get(id);if(!canInteract(boss,player)||session.socketId!==player.socketId)orb.sessions.delete(id);}
  const expired=state.orbs.filter(orb=>now>=orb.endsAt);if(!expired.length)return hits;
  state.orbs=state.orbs.filter(orb=>now<orb.endsAt);
  // Simultaneous deadlines cause one map-wide blast, not duplicate immunity/hit events.
  for(const player of room.players.values())if(targetable(boss,player))hits.push({monsterId:boss.id,mapId:boss.mapId,x:player.x,y:player.y,targetId:player.id,
    skillKind:'truth-creator-blue-timeout',durationMs:450,noEffect:true,...defeatRecordPlayer(room,player,now)});
  return hits;
}
