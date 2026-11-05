import {FORGOTTEN_CONSTELLATION as spec} from '../shared/forgotten-constellation.js';
import {monsterType} from '../shared/monsters.js';
import {damagePlayer,ensureVitals} from './vitals.js';
import {reflectLibraDamage} from './area-combat.js';
import {collisionDistance} from './projectile-collision.js';

export const HOMING_STAR=Object.freeze({fireMs:3000,legMs:750,turns:3,speed:360,radius:18});
const valid=(p,boss)=>p?.connected&&!p.away&&p.mapId===boss.mapId&&!p.avatar?.blackStar&&
 ['student','teacher'].includes(p.role)&&!(p.role==='teacher'&&(p.avatar?.teacherPreview||!boss.teacherRetaliation?.has(p.id)))&&ensureVitals(p)?.hp>0;
function aim(shot,target){
 const dx=target.x-shot.x,dy=target.y-shot.y,length=Math.hypot(dx,dy);
 if(length){shot.dx=dx/length;shot.dy=dy/length;}
}
function advance(room,boss,state,now){
 const shot=state.shot;if(!shot)return [];
 const target=room.players.get(shot.targetId);
 if(!valid(target,boss)){state.shot=null;return [];}
 const rule=HOMING_STAR;
 // Split delayed ticks at each turn. A straight shortcut across a bend would miss or invent hits.
 while(shot.lastAt<now){
  const boundary=shot.startsAt+(shot.turns+1)*rule.legMs,until=Math.min(now,boundary);
  const travel=(until-shot.lastAt)*rule.speed/1000;
  let first=null,nearest=travel;
  for(const p of room.players.values()){
   if(!valid(p,boss))continue;
   const contact=collisionDistance(shot,p,travel);
   if(contact!==null&&(!first||contact<nearest)){first=p;nearest=contact;}
  }
  shot.x+=shot.dx*nearest;shot.y+=shot.dy*nearest;shot.lastAt=until;
  if(first){
   state.shot=null;const hit=damagePlayer(first,monsterType(spec.typeId).power,now,{room});
   if(hit?.reflectedDamage)reflectLibraDamage(room,first,{sourceMonsterId:boss.id},hit.reflectedDamage,now);
   return [{monsterId:boss.id,mapId:boss.mapId,x:shot.x,y:shot.y,targetId:first.id,skillKind:'forgotten-homing-star',durationMs:320,noEffect:true,...hit}];
  }
  if(until<boundary)break;
  if(shot.turns===rule.turns){state.shot=null;break;}
  shot.turns++;aim(shot,target);
 }
 return [];
}
export function tickHomingStar(room,boss,target,now){
 if(boss.hp<=0||boss.mapId!==spec.mapId){boss.homing=null;return [];}
 if(!boss.homing&&!valid(target,boss))return [];
 const state=boss.homing??={shot:null,fireAt:null};
 const hits=advance(room,boss,state,now);
 if(boss.hp<=0||!valid(target,boss)){state.fireAt=null;return hits;}
 if((boss.sleepUntil||0)>now||(boss.stunUntil||0)>now){state.fireAt=null;return hits;}
 state.fireAt??=now+HOMING_STAR.fireMs;
 if(now<state.fireAt)return hits;
 state.fireAt=now+HOMING_STAR.fireMs;
 const shot={x:boss.x,y:boss.y,dx:boss.facingX||1,dy:0,radius:HOMING_STAR.radius,targetId:target.id,turns:0,startsAt:now,lastAt:now};
 aim(shot,target);state.shot=shot;
 return hits;
}
export function homingStarView(boss){
 const shot=boss.homing?.shot;
 if(!shot||boss.hp<=0||boss.mapId!==spec.mapId)return null;
 const {x,y,dx,dy,radius,turns,lastAt,startsAt}=shot;
 return {x,y,dx,dy,radius,turns,lastAt,startsAt,speed:HOMING_STAR.speed,nextTurnAt:startsAt+(turns+1)*HOMING_STAR.legMs,endsAt:startsAt+(HOMING_STAR.turns+1)*HOMING_STAR.legMs};
}
