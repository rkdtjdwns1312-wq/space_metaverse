import {clearTruthCreatorGalaxy,truthCreatorGalaxyViews} from './truth-creator-galaxy.js';
import {clearTruthCreatorBlue,truthCreatorBlueViews} from './truth-creator-blue.js';
import {clearTruthCreatorSentries} from './truth-creator-sentries.js';
import {clearTruthCreatorChasers,truthCreatorChaserViews} from './truth-creator-chasers.js';
import {RULES} from '../shared/config.js';
import {monsterType} from '../shared/monsters.js';
import {ensureVitals,damagePlayer} from './vitals.js';
import {reflectLibraDamage} from './area-combat.js';

export const TRUTH_CREATOR_ATTACK=Object.freeze({aimMs:3000,speed:420,radius:22,flightMs:5000,trailMs:10000,trailWidth:28,contactMs:1000});
const valid=(boss,p)=>p?.connected&&!p.away&&!p.avatar?.blackStar&&p.mapId===boss.mapId&&ensureVitals(p)?.hp>0&&
  !(p.role==='teacher'&&(p.avatar?.teacherPreview||!boss.teacherRetaliation?.has(p.id)));
const stateOf=boss=>boss.truthCreatorAttack??={mapId:boss.mapId,sequence:0,aim:null,shots:[],trails:[],contacts:new Map()};
export function clearTruthCreatorAttack(boss,room){boss.truthCreatorAttack=null;clearTruthCreatorGalaxy(boss);clearTruthCreatorBlue(boss);clearTruthCreatorChasers(boss);clearTruthCreatorSentries(room,boss);}
const visual=(boss,kind,x,y)=>({monsterId:boss.id,mapId:boss.mapId,x,y,dx:0,dy:0,reach:0,skillKind:`truth-creator-${kind}`,durationMs:450,noEffect:true});
function hitPlayer(room,boss,player,now,kind){
  const hit=damagePlayer(player,monsterType(boss.typeId).power,now,{room});
  if(hit?.reflectedDamage)reflectLibraDamage(room,player,{sourceMonsterId:boss.id},hit.reflectedDamage,now);
  return {...visual(boss,kind,player.x,player.y),targetId:player.id,...hit};
}
export function aimTruthCreator(room,boss,target,now){
  if(boss.typeId!=='truth-creator'||boss.hp<=0)return [];
  const state=stateOf(boss),rule=TRUTH_CREATOR_ATTACK;
  if(!target||!valid(boss,target)||(boss.sleepUntil||0)>now||(boss.stunUntil||0)>now){state.aim=null;return [];}
  const distance=Math.hypot(target.x-boss.x,target.y-boss.y),dx=distance?(target.x-boss.x)/distance:1,dy=distance?(target.y-boss.y)/distance:0;
  if(state.aim?.targetId!==target.id)state.aim=null;
  state.aim??={targetId:target.id,endsAt:now+rule.aimMs};
  if(now<state.aim.endsAt)return [];
  const shot={id:`${boss.id}-orb-${++state.sequence}`,x:boss.x,y:boss.y,dx,dy,radius:rule.radius,startsAt:now,endsAt:now+rule.flightMs,lastAt:now};
  state.shots.push(shot);
  state.trails.push({id:shot.id,x:shot.x,y:shot.y,dx,dy,startsAt:now,distance:0,flightEndsAt:shot.endsAt});
  state.aim={targetId:target.id,endsAt:now+rule.aimMs};
  return [{...visual(boss,'basic',boss.x,boss.y),dx,dy,attackOnly:true}];
}
function segmentDistance(x,y,x1,y1,x2,y2){
  const dx=x2-x1,dy=y2-y1,length=dx*dx+dy*dy,t=length?Math.max(0,Math.min(1,((x-x1)*dx+(y-y1)*dy)/length)):0;
  return Math.hypot(x-x1-t*dx,y-y1-t*dy);
}
// One analytic line per shot: each point disappears exactly ten seconds after the orb passed it.
function trailView(trail,now){
  const rule=TRUTH_CREATOR_ATTACK,tail=Math.max(0,(now-trail.startsAt-rule.trailMs)/1000*rule.speed);
  if(tail>=trail.distance)return null;
  return {id:trail.id,x1:trail.x+trail.dx*tail,y1:trail.y+trail.dy*tail,x2:trail.x+trail.dx*trail.distance,y2:trail.y+trail.dy*trail.distance,
    width:rule.trailWidth,startsAt:trail.startsAt,endsAt:trail.flightEndsAt+rule.trailMs};
}
// Swept circle entry avoids tunnelling and stops at the nearest player rather than overshooting.
function collisionDistance(shot,player,travel){
  const dx=player.x-shot.x,dy=player.y-shot.y,radius=shot.radius+RULES.radius;
  const along=dx*shot.dx+dy*shot.dy,acrossSquared=dx*dx+dy*dy-along*along;
  if(acrossSquared>radius*radius)return null;
  const half=Math.sqrt(Math.max(0,radius*radius-acrossSquared)),entry=Math.max(0,along-half);
  return along+half>=0&&entry<=travel?entry:null;
}
export function tickTruthCreatorAttack(room,boss,now){
  const state=boss.truthCreatorAttack,hits=[],rule=TRUTH_CREATOR_ATTACK;
  if(!state)return hits;
  if(boss.hp<=0||state.mapId!==boss.mapId||![...room.players.values()].some(p=>valid(boss,p))){clearTruthCreatorAttack(boss,room);return hits;}
  const blue=boss.truthCreatorBlue,basicProtected=blue?.mapId===boss.mapId&&blue.orbs.some(orb=>now>=orb.startsAt&&now<orb.endsAt);
  state.shots=state.shots.filter(shot=>{
    if(boss.hp<=0)return false;
    const until=Math.min(now,shot.endsAt),travel=Math.max(0,until-shot.lastAt)/1000*rule.speed;
    let target=null,distance=travel;
    for(const p of room.players.values())if(valid(boss,p)){
      const contact=collisionDistance(shot,p,travel);
      if(contact!==null&&(!target||contact<distance)){target=p;distance=contact;}
    }
    shot.x+=shot.dx*distance;shot.y+=shot.dy*distance;shot.lastAt=until;
    const trail=state.trails.find(trail=>trail.id===shot.id);
    if(trail){trail.distance+=distance;if(target)trail.flightEndsAt=trail.startsAt+trail.distance/rule.speed*1000;}
    if(target){if(!basicProtected){state.contacts.set(target.id,now+rule.contactMs);hits.push(hitPlayer(room,boss,target,now,'orb'));}return false;}
    return now<shot.endsAt;
  });
  state.trails=state.trails.filter(trail=>now<trail.flightEndsAt+rule.trailMs);
  const paths=state.trails.map(trail=>trailView(trail,now)).filter(Boolean);
  for(const p of room.players.values()){
    if(boss.hp<=0)break;
    if(!valid(boss,p)){state.contacts.delete(p.id);continue;}
    if(basicProtected||now<(state.contacts.get(p.id)||0)||!paths.some(path=>segmentDistance(p.x,p.y,path.x1,path.y1,path.x2,path.y2)<=path.width/2+RULES.radius))continue;
    // All overlapping paths share one cooldown, kept even if the player briefly steps off the light.
    state.contacts.set(p.id,now+rule.contactMs);hits.push(hitPlayer(room,boss,p,now,'trail'));
  }
  if(boss.hp<=0)clearTruthCreatorAttack(boss,room);
  return hits;
}
export function truthCreatorAttackView(boss,now){
  const state=boss.truthCreatorAttack;if(!state||boss.hp<=0||state.mapId!==boss.mapId)return null;
  // Aiming stays strictly server-side. No target coordinates or warning line are sent.
  return {serverNow:now,galaxies:truthCreatorGalaxyViews(boss,now),blueOrbs:truthCreatorBlueViews(boss,now),chasers:truthCreatorChaserViews(boss,now),projectiles:state.shots.filter(shot=>now<shot.endsAt).map(({id,x,y,dx,dy,radius,startsAt,endsAt})=>({id,x,y,dx,dy,radius,startsAt,endsAt})),
    paths:state.trails.map(trail=>trailView(trail,now)).filter(Boolean)};
}
