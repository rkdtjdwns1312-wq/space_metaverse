import {randomUUID} from 'node:crypto';
import {CONSTELLATIONS} from '../shared/constellations.js';
import {FORGOTTEN_CONSTELLATION as spec} from '../shared/forgotten-constellation.js';
import {monsterType} from '../shared/monsters.js';
import {present,vulnerable} from './forgotten-constellation-links.js';
import {defeatRecordPlayer} from './star-record-challenge.js';
import {damagePlayer} from './vitals.js';

export const CONSTELLATION_NAMES=Object.freeze({mana:10,durationMs:10000,cooldownMs:30000,decisionMs:3000,chance:.45});
const names=new Map(CONSTELLATIONS.map(c=>[c.name,c.id]));
names.set('뱀자리','ophiuchus');
const pick=(pool,random)=>pool.splice(Math.max(0,Math.min(pool.length-1,Math.floor(random()*pool.length))),1)[0];

export function tryConstellationNames(room,boss,now,random=Math.random){
  const rule=CONSTELLATION_NAMES;
  if(boss.typeId!==spec.typeId||boss.mapId!==spec.mapId||boss.hp<=0||boss.links||boss.names||boss.gather||boss.pendingAttack||
     boss.mp<rule.mana||now<(boss.namesReadyAt||0)||now<(boss.namesDecisionAt||0))return false;
  boss.namesDecisionAt=now+rule.decisionMs;
  if(![...room.players.values()].some(p=>vulnerable(p,boss))||random()>=rule.chance)return false;
  const pool=[...CONSTELLATIONS];
  const symbols=[0,1].map(slot=>({slot,constellationId:pick(pool,random).id,solved:false}));
  boss.names={id:randomUUID(),startsAt:now,endsAt:now+rule.durationMs,symbols};
  boss.mp-=rule.mana;boss.namesReadyAt=now+rule.cooldownMs;boss.moving=false;
  return true;
}

export function constellationNamesView(boss,now){
  const cast=boss.names;
  if(!cast||boss.hp<=0||boss.mapId!==spec.mapId||now>=cast.endsAt)return null;
  return {id:cast.id,startsAt:cast.startsAt,endsAt:cast.endsAt,serverNow:now,
    remaining:cast.symbols.filter(s=>!s.solved).map(({slot,constellationId})=>({slot,constellationId}))};
}

function hitInfo(boss,player,kind,result){
  return {monsterId:boss.id,mapId:boss.mapId,targetId:player.id,x:player.x,y:player.y,
    skillKind:kind,durationMs:450,noEffect:true,...result};
}

export function answerConstellationName(room,player,text,now,castId){
  const boss=room.monsters?.get(spec.monsterId),cast=boss?.names;
  if(!cast||(castId!==undefined&&castId!==cast.id)||boss.hp<=0||boss.mapId!==spec.mapId||now>=cast.endsAt||!vulnerable(player,boss))return null;
  const answer=names.get(text.normalize('NFKC').replace(/\s+/gu,''));
  const symbol=cast.symbols.find(s=>s.constellationId===answer);
  if(!symbol){
    const damage=damagePlayer(player,monsterType(spec.typeId).power,now,{room});
    return {status:'wrong',hit:hitInfo(boss,player,'forgotten-names-wrong',damage)};
  }
  if(symbol.solved)return {status:'already'};
  symbol.solved=true;
  if(cast.symbols.some(s=>!s.solved))return {status:'correct'};
  boss.names=null;
  return {status:'complete'};
}

export function tickConstellationNames(room,boss,now){
  if(!boss.names)return [];
  const players=[...room.players.values()];
  if(boss.hp<=0||boss.mapId!==spec.mapId||!players.some(p=>present(p,boss))){boss.names=null;return [];}
  boss.moving=false;
  if(now<boss.names.endsAt)return [];
  boss.names=null;
  return players.filter(p=>vulnerable(p,boss)).map(p=>hitInfo(boss,p,'forgotten-names-timeout',
    defeatRecordPlayer(room,p,now,{bypassProtection:true})));
}
