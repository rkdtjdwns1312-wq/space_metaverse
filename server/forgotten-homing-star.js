import {FORGOTTEN_CONSTELLATION as spec} from '../shared/forgotten-constellation.js';
import {monsterType} from '../shared/monsters.js';
import {damagePlayer} from './vitals.js';
import {reflectLibraDamage} from './area-combat.js';
import {collisionDistance} from './projectile-collision.js';
import {vulnerable} from './forgotten-constellation-links.js';

export const HOMING_STAR=Object.freeze({fireMs:5000,legMs:750,turns:3,speed:216,radius:18});
export const HOMING_VOLLEY=Object.freeze({mana:10,cooldownMs:60000,durationMs:30000,fireMs:2500,decisionMs:3000,chance:.45});
function homingState(boss){return boss.homing??={shots:[],fireAt:null,lastFiredAt:null};}
export function tryHomingVolley(room,boss,now,random=Math.random){
  const rule=HOMING_VOLLEY;
  if(boss.typeId!==spec.typeId||boss.hp<=0||boss.mapId!==spec.mapId||boss.homingVolley||boss.mp<rule.mana||
    (boss.sleepUntil||0)>now||(boss.stunUntil||0)>now||now<(boss.volleyReadyAt||0)||now<(boss.volleyDecisionAt||0))return false;
  boss.volleyDecisionAt=now+rule.decisionMs;
  if(![...room.players.values()].some(p=>vulnerable(p,boss))||random()>=rule.chance)return false;
  boss.homingVolley={startsAt:now,endsAt:now+rule.durationMs};
  boss.mp-=rule.mana;boss.volleyReadyAt=now+rule.cooldownMs;
  const state=homingState(boss);
  state.fireAt=Math.max(now,(state.lastFiredAt??now)+rule.fireMs);
  return true;
}
export function homingVolleyView(boss,now){
  const volley=boss.homingVolley;
  return volley&&boss.hp>0&&now<volley.endsAt?{...volley,serverNow:now}:null;
}
function aim(shot,target){
  const x=target.x-shot.x,y=target.y-shot.y,length=Math.hypot(x,y);
  if(length){shot.dx=x/length;shot.dy=y/length;}
}
function hitPlayer(room,boss,shot,player,multiplier,now){
  const result=damagePlayer(player,monsterType(spec.typeId).power*multiplier,now,{room});
  if(result?.reflectedDamage)reflectLibraDamage(room,player,{sourceMonsterId:boss.id},result.reflectedDamage,now);
  return {monsterId:boss.id,mapId:boss.mapId,x:shot.x,y:shot.y,targetId:player.id,
    skillKind:multiplier===2?'forgotten-blue-star-miss':'forgotten-homing-star',durationMs:320,noEffect:true,...result};
}
function advance(room,boss,shot,now,hits){
  const target=room.players.get(shot.targetId),aimable=vulnerable(target,boss);
  if(!aimable&&!shot.volley)return false;
  // Sweep each straight segment separately so a late tick cannot skip a hit at a turn.
  while(shot.lastAt<now){
    const boundary=shot.startsAt+(shot.turns+1)*HOMING_STAR.legMs,until=Math.min(now,boundary);
    const travel=(until-shot.lastAt)*HOMING_STAR.speed/1000;
    let first=null,nearest=travel;
    for(const player of room.players.values()){
      if(!vulnerable(player,boss))continue;
      const contact=collisionDistance(shot,player,travel);
      if(contact!==null&&(!first||contact<nearest)){first=player;nearest=contact;}
    }
    shot.x+=shot.dx*nearest;shot.y+=shot.dy*nearest;shot.lastAt=until;
    if(first){
      if(shot.color!=='blue')hits.push(hitPlayer(room,boss,shot,first,1,now));
      return false;
    }
    if(until<boundary)break;
    if(shot.turns===HOMING_STAR.turns){
      if(shot.color==='blue'){
        for(const player of room.players.values())if(vulnerable(player,boss))hits.push(hitPlayer(room,boss,shot,player,2,now));
      }
      return false;
    }
    shot.turns++;
    if(aimable)aim(shot,target);
  }
  return true;
}
export function tickHomingStar(room,boss,target,now,random=Math.random){
  if(boss.hp<=0||boss.mapId!==spec.mapId){boss.homing=null;boss.homingVolley=null;return [];}
  if(!boss.homing&&!vulnerable(target,boss))return [];
  const state=homingState(boss),hits=[];
  state.shots=state.shots.filter(shot=>boss.hp>0&&advance(room,boss,shot,now,hits));
  if(boss.homingVolley&&now>=boss.homingVolley.endsAt){
    boss.homingVolley=null;
    state.fireAt=(state.lastFiredAt??now)+HOMING_STAR.fireMs;
  }
  if(boss.hp<=0||!vulnerable(target,boss)||(boss.sleepUntil||0)>now||(boss.stunUntil||0)>now){state.fireAt=null;return hits;}
  const volley=!!boss.homingVolley,interval=volley?HOMING_VOLLEY.fireMs:HOMING_STAR.fireMs;
  state.fireAt??=now+interval;
  if(now<state.fireAt)return hits;
  state.fireAt=now+interval;state.lastFiredAt=now;
  let color='yellow';
  if(volley){
    const targets=[...room.players.values()].filter(player=>vulnerable(player,boss));
    target=targets[Math.min(targets.length-1,Math.floor(random()*targets.length))];
    color=random()<.5?'yellow':'blue';
  }
  const shot={id:boss.id+'-'+now,color,volley,x:boss.x,y:boss.y,dx:boss.facingX||1,dy:0,
    radius:HOMING_STAR.radius,targetId:target.id,turns:0,startsAt:now,lastAt:now};
  aim(shot,target);state.shots.push(shot);
  return hits;
}
function shotView(shot){
  const {id,color,x,y,dx,dy,radius,turns,lastAt,startsAt}=shot;
  return {id,color,x,y,dx,dy,radius,turns,lastAt,startsAt,speed:HOMING_STAR.speed,
    nextTurnAt:startsAt+(turns+1)*HOMING_STAR.legMs,endsAt:startsAt+(HOMING_STAR.turns+1)*HOMING_STAR.legMs};
}
export function homingStarsView(boss,now){
  if(boss.hp<=0||boss.mapId!==spec.mapId)return [];
  return (boss.homing?.shots||[]).map(shot=>({...shotView(shot),serverNow:now}));
}
export function homingStarView(boss){
  const shot=boss.homing?.shots[0];
  return shot&&boss.hp>0&&boss.mapId===spec.mapId?shotView(shot):null;
}
