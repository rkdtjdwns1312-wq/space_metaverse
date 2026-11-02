import {RULES,mapOf} from '../shared/config.js';
import {onOriginFloor} from '../shared/origin-floor.js';
import {ensureVitals} from './vitals.js';
import {defeatRecordPlayer} from './star-record-challenge.js';

export const TRUTH_CREATOR_CHASERS=Object.freeze({mana:10,cooldownMs:30000,durationMs:20000,speed:RULES.speed*.6,radius:30,spawnDistance:300});
const eligible=(boss,p)=>p?.connected&&!p.away&&!p.avatar?.blackStar&&p.mapId===boss.mapId&&ensureVitals(p)?.hp>0&&
  !(p.role==='teacher'&&(p.avatar?.teacherPreview||!boss.teacherRetaliation?.has(p.id)));
const stateOf=boss=>boss.truthCreatorChasers??={mapId:boss.mapId,sequence:0,readyAt:0,orbs:[]};
export function clearTruthCreatorChasers(boss){boss.truthCreatorChasers=null;}
export function tryTruthCreatorChasers(room,boss,target,now){
  const rule=TRUTH_CREATOR_CHASERS;
  if(boss.typeId!=='truth-creator'||boss.hp<=0||!eligible(boss,target)||(boss.sleepUntil||0)>now||(boss.stunUntil||0)>now)return false;
  const state=stateOf(boss);
  if(now<state.readyAt||state.orbs.length||boss.mp<rule.mana)return false;
  const players=[...room.players.values()].filter(p=>eligible(boss,p)),map=mapOf(boss.mapId),points=[];
  for(const player of players){
    let point=null;
    for(const distance of [rule.spawnDistance,420,540,660]){
      for(let step=0;step<16;step++){
        const angle=step*Math.PI/8,x=player.x+Math.cos(angle)*distance,y=player.y+Math.sin(angle)*distance;
        if(onOriginFloor(map,x,y,rule.radius)&&players.every(p=>Math.hypot(p.x-x,p.y-y)>rule.radius+RULES.radius+80)&&points.every(p=>Math.hypot(p.x-x,p.y-y)>rule.radius*2+12)){
          point={x,y};break;
        }
      }
      if(point)break;
    }
    // Charge only a complete cast; an overcrowded edge can retry after the next decision interval.
    if(!point){state.readyAt=now+1000;return false;}
    points.push({...point,targetId:player.id});
  }
  state.orbs=points.map(point=>({id:`${boss.id}-chaser-${++state.sequence}`,...point,radius:rule.radius,startsAt:now,endsAt:now+rule.durationMs,lastAt:now}));
  state.readyAt=now+rule.cooldownMs;boss.mp-=rule.mana;return true;
}
function segmentDistance(x,y,x1,y1,x2,y2){
  const dx=x2-x1,dy=y2-y1,length=dx*dx+dy*dy,t=length?Math.max(0,Math.min(1,((x-x1)*dx+(y-y1)*dy)/length)):0;
  return Math.hypot(x-x1-t*dx,y-y1-t*dy);
}
export function tickTruthCreatorChasers(room,boss,now){
  const state=boss.truthCreatorChasers,hits=[];if(!state)return hits;
  if(boss.hp<=0||state.mapId!==boss.mapId){clearTruthCreatorChasers(boss);return hits;}
  state.orbs=state.orbs.filter(orb=>{
    const target=room.players.get(orb.targetId);if(now>=orb.endsAt||!eligible(boss,target))return false;
    const dx=target.x-orb.x,dy=target.y-orb.y,length=Math.hypot(dx,dy),travel=Math.min(length,Math.max(0,now-orb.lastAt)/1000*TRUTH_CREATOR_CHASERS.speed),oldX=orb.x,oldY=orb.y;
    if(length){orb.x+=dx/length*travel;orb.y+=dy/length*travel;}orb.lastAt=now;
    for(const player of room.players.values())if(eligible(boss,player)&&segmentDistance(player.x,player.y,oldX,oldY,orb.x,orb.y)<=orb.radius+RULES.radius){
      hits.push({monsterId:boss.id,mapId:boss.mapId,x:player.x,y:player.y,targetId:player.id,skillKind:'truth-creator-chaser',durationMs:450,noEffect:true,...defeatRecordPlayer(room,player,now)});
    }
    return eligible(boss,target);
  });
  return hits;
}
export function truthCreatorChaserViews(boss,now){
  const state=boss.truthCreatorChasers;
  if(!state||boss.hp<=0||state.mapId!==boss.mapId)return [];
  return state.orbs.filter(orb=>now<orb.endsAt).map(({id,x,y,radius,startsAt,endsAt})=>({id,x,y,radius,startsAt,endsAt}));
}
