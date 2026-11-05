import {randomUUID} from 'node:crypto';
import {FORGOTTEN_CONSTELLATION as spec} from '../shared/forgotten-constellation.js';
import {mapOf,interactionDistance,interactionReach} from '../shared/config.js';
import {onOriginFloor} from '../shared/origin-floor.js';
import {monsterFootprint} from '../shared/monster-geometry.js';
import {defeatRecordPlayer} from './star-record-challenge.js';
import {ensureVitals} from './vitals.js';
import {GameError} from './pin-auth.js';

export const CONSTELLATION_LINKS=Object.freeze({mana:10,cooldownMs:40000,durationMs:15000,decisionMs:3000,chance:.45});
const roll=random=>Math.max(0,Math.min(.999999,Number(random())||0));
export const present=(p,boss)=>p?.connected&&!p.away&&p.mapId===boss.mapId&&!p.avatar?.blackStar&&!p.avatar?.teacherPreview&&
 ['student','teacher'].includes(p.role)&&ensureVitals(p)?.hp>0;
export const vulnerable=(p,boss)=>present(p,boss)&&(p.role==='student'||boss.teacherRetaliation?.has(p.id));

function positions(boss,random){
 const map=mapOf(spec.mapId),wall=monsterFootprint(boss),points=[],rotation=roll(random)*2*Math.PI,reverse=roll(random)<.5?-1:1;
 // The arena centre is a connected walkable floor. The ring bounds the walking distance within 20 s.
 for(let i=0;i<5;i++){
  const start=rotation+reverse*i*Math.PI*2/5+(roll(random)-.5)*.3,radius=290+roll(random)*35;
  let point;
  for(let step=0;step<25&&!point;step++){
   const offset=(step%2?1:-1)*Math.ceil(step/2)*Math.PI/24;
   const x=map.width/2+Math.cos(start+offset)*radius,y=map.height/2+Math.sin(start+offset)*radius;
   if(onOriginFloor(map,x,y,80)&&Math.hypot((x-wall.x)/(wall.rx+65),(y-wall.y)/(wall.ry+65))>1&&
      points.every(s=>Math.hypot(x-s.x,y-s.y)>110))point={x,y,radius:30};
  }
  if(!point)return null;
  points.push(point);
 }
 for(let i=points.length-1;i>0;i--){
  const j=Math.floor(roll(random)*(i+1));[points[i],points[j]]=[points[j],points[i]];
 }
 return points.map((point,index)=>({...point,number:index+1}));
}
export function tryConstellationLinks(room,boss,now,random=Math.random){
 const rule=CONSTELLATION_LINKS;
 if(boss.typeId!==spec.typeId||boss.hp<=0||boss.mapId!==spec.mapId||boss.links||boss.names||boss.gather||boss.pendingAttack||boss.mp<rule.mana||
    now<(boss.linksReadyAt||0)||now<(boss.linksDecisionAt||0))return false;
 boss.linksDecisionAt=now+rule.decisionMs;
 if(![...room.players.values()].some(p=>vulnerable(p,boss))||roll(random)>=rule.chance)return false;
 const stars=positions(boss,random);if(!stars)return false;
 boss.links={id:randomUUID(),stars,linked:0,endsAt:now+rule.durationMs};
 boss.mp-=rule.mana;boss.linksReadyAt=now+rule.cooldownMs;boss.moving=false;
 return true;
}
export function tickConstellationLinks(room,boss,now){
 if(!boss.links)return [];
 if(boss.hp<=0||boss.mapId!==spec.mapId||![...room.players.values()].some(p=>present(p,boss))){boss.links=null;return [];}
 boss.moving=false;
 if(now<boss.links.endsAt)return [];
 boss.links=null;
 return [...room.players.values()].filter(p=>vulnerable(p,boss)).map(p=>({
  monsterId:boss.id,mapId:boss.mapId,targetId:p.id,x:p.x,y:p.y,skillKind:'forgotten-links-timeout',durationMs:450,noEffect:true,
  ...defeatRecordPlayer(room,p,now,{bypassProtection:true})
 }));
}
export function linkConstellationStar(room,player,data,now){
 const boss=room.monsters?.get(spec.monsterId),links=boss?.links;
 if(!links||boss.hp<=0||boss.mapId!==spec.mapId||now>=links.endsAt||links.id!==data.castId||!present(player,boss))throw new GameError('지금은 이 별을 연결할 수 없어요.');
 const star=links.stars.find(s=>s.number===data.number);
 if(!star||interactionDistance(player,star)>interactionReach(star))throw new GameError('별 가까이에서 조사해주세요.');
 if(star.number!==links.linked+1)return {linked:links.linked,message:'다음은 점 '+(links.linked+1)+'개인 별이에요.'};
 links.linked++;
 if(links.linked===links.stars.length){boss.links=null;return {linked:5,message:'다섯 별을 연결했어요!'};}
 return {linked:links.linked,message:'다음은 점 '+(links.linked+1)+'개인 별이에요.'};
}
