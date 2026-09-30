import {corvusSkillOf} from '../shared/character-skills.js';
import {avatarSizeOf} from '../shared/avatar-size.js';
import {attackPowerOf,attackGeometryOf} from '../shared/combat.js';
import {combatEnemies,damageTargets} from './sagittarius-skills.js';
import {ensureVitals,playerVitals} from './vitals.js';
import {ensure} from './rooms.js';

export const corvusCooldowns=player=>({0:player.corvusCooldownUntil||0});
function lineTargets(room,player,cast){
  return combatEnemies(room,player).filter(t=>{
    const vx=t.entity.x-cast.x,vy=t.entity.y-cast.y,along=vx*cast.dx+vy*cast.dy;
    if(along<0)return false;
    const projection=Math.max(0,Math.min(cast.range,along));
    return Math.hypot(vx-cast.dx*projection,vy-cast.dy*projection)<=t.radius+cast.width;
  });
}
export function castCorvus(room,player,now,{basic=false}={}){
  ensure(player.avatar.constellationId==='corvus'&&player.avatar.level>=2,'LV2 까마귀자리부터 사용할 수 있어요.');
  ensure(player.connected&&!player.away&&!player.avatar.blackStar&&ensureVitals(player).hp>0,'지금은 공격할 수 없어요.');
  const spec=corvusSkillOf(player),vitals=ensureVitals(player);
  if(!basic){
    ensure(now>=(player.corvusCooldownUntil||0),'스킬은 10초마다 사용할 수 있어요.');
    ensure(vitals.mp>=spec.mana,'마나가 부족해요.');
  }
  const size=avatarSizeOf(player),direction=player.facing||{x:0,y:1},length=Math.hypot(direction.x,direction.y)||1;
  const cast={playerId:player.id,mapId:player.mapId,constellationId:'corvus',level:player.avatar.level,x:player.x,y:player.y,
    dx:direction.x/length,dy:direction.y/length,range:size*5,width:size*.13,
    power:Math.round(attackPowerOf(player.avatar.level,'corvus',player)*(basic?1:spec.multiplier)),
    remaining:spec.hits,nextAt:now+350,intervalMs:120};
  let damage={targets:[],playerTargets:[]};
  if(basic)damage=damageTargets(room,player,lineTargets(room,player,cast),cast.power,now);
  else{
    vitals.mp-=spec.mana;player.corvusCooldownUntil=now+spec.cooldownMs;
    room.corvusCasts??=[];room.corvusCasts.push(cast);
  }
  return {ready:true,...damage,target:damage.targets[0]||null,vitals:playerVitals(player),cooldowns:corvusCooldowns(player),serverNow:now,
    hit:{kind:basic?'corvus-attack':'skill',vfxId:basic?'attack':`skill-lv${spec.stage}`,playerId:player.id,mapId:player.mapId,
      x:player.x,y:player.y,dx:cast.dx,dy:cast.dy,durationMs:1000,range:cast.range,power:cast.power,...attackGeometryOf(player)}};
}
export function advanceCorvus(room,now){
  const hits=[],keep=[];
  for(const cast of room.corvusCasts||[]){
    const player=room.players.get(cast.playerId);
    if(!player?.connected||player.away||player.avatar.blackStar||player.mapId!==cast.mapId||
      player.avatar.constellationId!=='corvus'||player.avatar.level!==cast.level||ensureVitals(player).hp<=0)continue;
    while(cast.remaining>0&&now>=cast.nextAt){
      hits.push({mapId:cast.mapId,...damageTargets(room,player,lineTargets(room,player,cast),cast.power,cast.nextAt)});
      cast.remaining--;cast.nextAt+=cast.intervalMs;
    }
    if(cast.remaining>0)keep.push(cast);
  }
  room.corvusCasts=keep;return hits;
}
