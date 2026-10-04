import {avatarSizeOf} from '../shared/avatar-size.js';
import {attackPowerOf,attackGeometryOf} from '../shared/combat.js';
import {libraSkillOf} from '../shared/libra-skills.js';
import {launchProjectiles} from './projectiles.js';
import {ensureVitals,playerVitals} from './vitals.js';
import {ensure} from './rooms.js';

export const libraCooldowns=p=>({0:p.libraCooldownUntil||0});
export function castLibra(room,player,now,{basic=false}={}){
  ensure(player?.avatar?.constellationId==='libra'&&player.avatar.level>=2,'LV2 천칭자리부터 사용할 수 있어요.');
  ensure(player.connected&&!player.away&&!player.avatar.blackStar&&ensureVitals(player).hp>0,'지금은 스킬을 사용할 수 없어요.');
  const size=avatarSizeOf(player);
  if(basic){
    const facing=player.facing||{x:0,y:1},length=Math.hypot(facing.x,facing.y)||1;
    const base={x:player.x,y:player.y,dx:facing.x/length,dy:facing.y/length,size,range:size*4,
      width:size*.13,power:attackPowerOf(player.avatar.level,'libra',player),basic:true,kind:'libra-attack',vfxId:'attack',
      originOffset:attackGeometryOf(player).originOffset,durationMs:650};
    const projectiles=launchProjectiles(room,player,base,now);
    return {ready:true,targets:[],playerTargets:[],vitals:playerVitals(player),hit:{...base,playerId:player.id,mapId:player.mapId,projectiles}};
  }
  const spec=libraSkillOf(player),vitals=ensureVitals(player);
  ensure(now>=(player.libraCooldownUntil||0),'천칭 스킬을 다시 쓰려면 조금 기다려주세요.');
  ensure(vitals.mp>=spec.mana,'마나가 부족해요.');
  vitals.mp-=spec.mana;player.libraCooldownUntil=now+spec.cooldownMs;
  player.libraAura={at:now,endsAt:now+spec.durationMs,stage:spec.stage,size,radius:size*spec.radiusWidths,attackBonus:spec.attackBonus,mapId:player.mapId};
  advanceLibraAuras(room,now);
  return {ready:true,vitals:playerVitals(player),cooldowns:libraCooldowns(player),serverNow:now};
}
export function libraAuraViews(room,mapId,now){
  return [...room.players.values()].filter(p=>p.mapId===mapId&&p.libraAura?.endsAt>now&&p.libraAura.mapId===mapId)
    .map(p=>({playerId:p.id,mapId,stage:p.libraAura.stage,size:p.libraAura.size,radius:p.libraAura.radius,
      elapsedMs:now-p.libraAura.at,durationMs:p.libraAura.endsAt-p.libraAura.at}));
}
export function advanceLibraAuras(room,now){
  const casters=[...room.players.values()].filter(p=>p.connected&&!p.away&&p.libraAura?.endsAt>now&&p.mapId===p.libraAura.mapId&&ensureVitals(p).hp>0);
  let changed=false;
  for(const p of room.players.values()){
    const bonus=Math.max(0,...casters.filter(c=>c.mapId===p.mapId&&Math.hypot(c.x-p.x,c.y+c.libraAura.size*.22-p.y)<=c.libraAura.radius)
      .map(c=>c.libraAura.attackBonus));
    if((p.libraBuff?.bonus||0)!==bonus){p.libraBuff=bonus?{bonus}:null;changed=true;}
    if(p.libraAura&&p.libraAura.endsAt<=now){p.libraAura=null;changed=true;}
  }
  return changed;
}
