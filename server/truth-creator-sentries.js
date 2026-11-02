import {mapOf} from '../shared/config.js';
import {onOriginFloor} from '../shared/origin-floor.js';
import {ensureVitals,damagePlayer} from './vitals.js';

export const TRUTH_CREATOR_SENTRIES=Object.freeze({mana:1,cooldownMs:20000,pulseMs:2000,hp:1000,radius:48,typeId:'truth-creator-star'});
const eligible=(boss,p)=>p?.connected&&!p.away&&!p.avatar?.blackStar&&p.mapId===boss.mapId&&ensureVitals(p)?.hp>0&&
  !(p.role==='teacher'&&(p.avatar?.teacherPreview||!boss.teacherRetaliation?.has(p.id)));
const stateOf=boss=>boss.truthCreatorSentries??={mapId:boss.mapId,sequence:0,readyAt:0,nextPulseAt:null,ids:new Set()};
export function clearTruthCreatorSentries(room,boss){
  for(const id of boss.truthCreatorSentries?.ids||[])room?.monsters?.delete(id);
  boss.truthCreatorSentries=null;
}
export function tryTruthCreatorSentry(room,boss,target,now){
  const rule=TRUTH_CREATOR_SENTRIES;
  if(boss.typeId!=='truth-creator'||boss.hp<=0||!eligible(boss,target)||(boss.sleepUntil||0)>now||(boss.stunUntil||0)>now)return false;
  const state=stateOf(boss);if(now<state.readyAt||boss.mp<rule.mana)return false;
  const map=mapOf(boss.mapId);let point=null;
  // The sequence changes the angle. Existing sentries may overlap when crowded: no hidden count cap.
  for(let step=0;step<32;step++){
    const angle=(state.sequence*2.399963+step*Math.PI/8),distance=boss.radius+rule.radius+70+(step>=16?100:0),x=boss.x+Math.cos(angle)*distance,y=boss.y+Math.sin(angle)*distance;
    if(onOriginFloor(map,x,y,rule.radius)){point={x,y};break;}
  }
  if(!point)point={x:boss.x,y:boss.y};
  const id=`${boss.id}-sentry-${++state.sequence}`,monster={id,typeId:rule.typeId,mapId:boss.mapId,...point,radius:rule.radius,
    hp:rule.hp,maxHp:rule.hp,mp:0,maxMp:0,respawnAt:null,spawnX:point.x,spawnY:point.y,summonerId:boss.id,
    targetId:null,attackers:new Map(),contributors:new Map(),meleePresence:new Map(),attackOrder:0,mapExitCount:0,nextAttackAt:0,
    dx:0,dy:0,facingX:1,moving:false,lastMoveAt:now};
  room.monsters.set(id,monster);state.ids.add(id);state.nextPulseAt??=now+rule.pulseMs;
  state.readyAt=now+rule.cooldownMs;boss.mp-=rule.mana;return monster;
}
export function tickTruthCreatorSentries(room,boss,now){
  const state=boss.truthCreatorSentries,hits=[];if(!state)return hits;
  if(boss.hp<=0||state.mapId!==boss.mapId){clearTruthCreatorSentries(room,boss);return hits;}
  if(now<(state.nextPulseAt??Infinity))return hits;
  state.nextPulseAt=now+TRUTH_CREATOR_SENTRIES.pulseMs;
  let count=0;
  for(const id of state.ids){const orb=room.monsters.get(id);if(orb?.hp>0&&orb.mapId===boss.mapId)count++;else{state.ids.delete(id);room.monsters.delete(id);}}
  if(!count){state.nextPulseAt=null;return hits;}
  for(const player of room.players.values())if(eligible(boss,player)){
    // One map-wide pulse per player, regardless of how many long-lived sentries have accumulated.
    const hit=damagePlayer(player,count,now,{room,skipDefense:true});
    hits.push({monsterId:boss.id,mapId:boss.mapId,x:player.x,y:player.y,targetId:player.id,skillKind:'truth-creator-sentries',durationMs:450,noEffect:true,...hit});
  }
  return hits;
}
