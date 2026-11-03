import {attackPowerOf} from '../shared/combat.js';
import {DARK_STAR_SKILLS} from '../shared/dark-star-skills.js';
import {ensureVitals} from './vitals.js';
import {monstersOf,damageMonster} from './monsters.js';
import {launchProjectiles} from './projectiles.js';

export const SIGIL_SHOT_INTERVAL_MS=10_000;
const MAX_RANGE=DARK_STAR_SKILLS.basic.speed*DARK_STAR_SKILLS.basic.durationMs/1000;

// An actual passive hit provokes that monster, including a normal teacher.
// Ghost teachers remain excluded by the common retaliation/target rules.
export function resolveSigilHit(room,player,selected,power,now){
  return {targets:selected.filter(target=>target.kind==='monster')
    .map(target=>damageMonster(room,target.entity,player,power,now,{retaliateTeacher:true})).filter(Boolean),playerTargets:[]};
}

// 장착자에게 살아 있는 몬스터가 보일 때만 발사하며, 목표가 없으면 준비 상태를 보존합니다.
export function advanceSigilProjectiles(room,now){
  const launched=[];
  for(const player of room.players.values()){
    if(!player.equipmentSlots?.includes('primordial-star-sigil')||!player.connected||player.away||
      player.avatar?.blackStar||!(ensureVitals(player)?.hp>0))continue;
    player.sigilNextShotAt??=now+SIGIL_SHOT_INTERVAL_MS;
    if(now<player.sigilNextShotAt)continue;
    const targets=[...monstersOf(room,now).values()].filter(monster=>monster.hp>0&&monster.typeId!=='dark-star-card'&&
      monster.mapId===player.mapId&&Math.hypot(monster.x-player.x,monster.y-player.y)<=MAX_RANGE+monster.radius);
    if(!targets.length)continue;
    targets.sort((a,b)=>Math.hypot(a.x-player.x,a.y-player.y)-Math.hypot(b.x-player.x,b.y-player.y));
    const target=targets[0],distance=Math.hypot(target.x-player.x,target.y-player.y),
      dx=distance?(target.x-player.x)/distance:player.facing?.x||1,
      dy=distance?(target.y-player.y)/distance:player.facing?.y||0;
    launched.push(...launchProjectiles(room,player,{
      kind:'sigil-black-star',basic:true,piercing:false,x:player.x,y:player.y,dx,dy,
      range:MAX_RANGE,durationMs:DARK_STAR_SKILLS.basic.durationMs,width:DARK_STAR_SKILLS.basic.radius,
      size:DARK_STAR_SKILLS.basic.radius*2,originOffset:0,
      power:attackPowerOf(player.avatar.level,player.avatar.constellationId,player)*5
    },now));
    player.sigilNextShotAt=now+SIGIL_SHOT_INTERVAL_MS;
  }
  return launched;
}
