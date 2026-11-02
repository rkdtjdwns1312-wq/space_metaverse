import {RULES,mapOf} from '../shared/config.js';
import {ensureVitals} from './vitals.js';
import {defeatRecordPlayer} from './star-record-challenge.js';
import {randomUUID} from 'node:crypto';

export const TRUTH_CREATOR_GALAXY=Object.freeze({mana:30,cooldownMs:60000,count:8,minIntervalMs:1000,maxIntervalMs:3000,radius:96,speed:210});
const eligible=(boss,p)=>p?.connected&&!p.away&&!p.avatar?.blackStar&&p.mapId===boss.mapId&&ensureVitals(p)?.hp>0&&
  !(p.role==='teacher'&&(p.avatar?.teacherPreview||!boss.teacherRetaliation?.has(p.id)));
const roll=random=>Math.max(0,Math.min(.999999999,Number(random())||0));
const stateOf=boss=>boss.truthCreatorGalaxy??={mapId:boss.mapId,readyAt:0,nextSpawnAt:null,queue:[],orbs:[]};
export function clearTruthCreatorGalaxy(boss){boss.truthCreatorGalaxy=null;}
export function truthCreatorGalaxyRoute(map,angle){
  if(!map||!Number.isFinite(map.width)||!Number.isFinite(map.height)||map.width<=0||map.height<=0||!Number.isFinite(angle))return null;
  const dx=Math.cos(angle),dy=Math.sin(angle),cx=map.width/2,cy=map.height/2;
  const extent=Math.min(Math.abs(dx)>1e-12?cx/Math.abs(dx):Infinity,Math.abs(dy)>1e-12?cy/Math.abs(dy):Infinity);
  return {x:cx-dx*extent,y:cy-dy*extent,toX:cx+dx*extent,toY:cy+dy*extent,dx,dy,distance:extent*2};
}
function launch(state,route,now){
  state.orbs.push({id:`truth-creator-galaxy-${randomUUID()}`,x:route.x,y:route.y,dx:route.dx,dy:route.dy,radius:TRUTH_CREATOR_GALAXY.radius,
    startsAt:now,endsAt:now+route.distance/TRUTH_CREATOR_GALAXY.speed*1000,lastAt:now});
}
export function tryTruthCreatorGalaxy(room,boss,target,now=Date.now(),random=Math.random){
  const rule=TRUTH_CREATOR_GALAXY;
  if(boss.typeId!=='truth-creator'||boss.hp<=0||!eligible(boss,target)||(boss.sleepUntil||0)>now||(boss.stunUntil||0)>now)return false;
  if(boss.truthCreatorBlue?.orbs?.length)return false;
  const state=stateOf(boss);if(now<state.readyAt||state.queue.length||boss.mp<rule.mana)return false;
  const map=mapOf(boss.mapId),planned=Array.from({length:rule.count},()=>({route:truthCreatorGalaxyRoute(map,roll(random)*Math.PI*2),
    delayMs:rule.minIntervalMs+Math.floor(roll(random)*(rule.maxIntervalMs-rule.minIntervalMs+1))}));
  if(planned.some(entry=>!entry.route))return false;
  launch(state,planned[0].route,now);state.queue=planned.slice(1);state.nextSpawnAt=now+state.queue[0].delayMs;
  state.readyAt=now+rule.cooldownMs;boss.mp-=rule.mana;return true;
}
function segmentDistance(x,y,x1,y1,x2,y2){
  const dx=x2-x1,dy=y2-y1,length=dx*dx+dy*dy,t=length?Math.max(0,Math.min(1,((x-x1)*dx+(y-y1)*dy)/length)):0;
  return Math.hypot(x-x1-t*dx,y-y1-t*dy);
}
export function tickTruthCreatorGalaxy(room,boss,now){
  const state=boss.truthCreatorGalaxy,hits=[];if(!state)return hits;
  if(boss.hp<=0||state.mapId!==boss.mapId||![...room.players.values()].some(player=>eligible(boss,player))){clearTruthCreatorGalaxy(boss);return hits;}
  if(state.queue.length&&now>=state.nextSpawnAt){
    const entry=state.queue.shift();launch(state,entry.route,now);
    // Even after a delayed server tick, preserve spacing instead of releasing eight instant kills together.
    state.nextSpawnAt=state.queue.length?now+state.queue[0].delayMs:null;
  }
  state.orbs=state.orbs.filter(orb=>{
    const oldX=orb.x,oldY=orb.y,until=Math.min(now,orb.endsAt),travel=Math.max(0,until-orb.lastAt)/1000*TRUTH_CREATOR_GALAXY.speed;
    orb.x+=orb.dx*travel;orb.y+=orb.dy*travel;orb.lastAt=until;
    for(const player of room.players.values())if(eligible(boss,player)&&segmentDistance(player.x,player.y,oldX,oldY,orb.x,orb.y)<=orb.radius+RULES.radius)
      hits.push({monsterId:boss.id,mapId:boss.mapId,x:player.x,y:player.y,targetId:player.id,skillKind:'truth-creator-galaxy',durationMs:450,noEffect:true,...defeatRecordPlayer(room,player,now)});
    return now<orb.endsAt;
  });
  return hits;
}
export function truthCreatorGalaxyViews(boss,now){
  const state=boss.truthCreatorGalaxy;if(!state||boss.hp<=0||state.mapId!==boss.mapId)return [];
  return state.orbs.filter(orb=>now<orb.endsAt).map(({id,x,y,dx,dy,radius,startsAt,endsAt})=>({id,x,y,dx,dy,radius,startsAt,endsAt}));
}
