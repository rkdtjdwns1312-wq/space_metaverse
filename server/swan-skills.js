import {avatarSizeOf} from '../shared/avatar-size.js';
import {attackPowerOf,attackGeometryOf} from '../shared/combat.js';
import {swanSkillOf} from '../shared/swan-skills.js';
import {launchProjectiles} from './projectiles.js';
import {ensureVitals,playerVitals} from './vitals.js';
import {ensure} from './rooms.js';

const eligible=player=>player?.connected&&!player.away&&!player.avatar?.blackStar&&ensureVitals(player).hp>0;
const active=(player,now)=>player?.swanAura&&player.swanAura.endsAt>now&&player.swanAura.remainingAttacks>0;
export const swanCooldowns=(player,now=Date.now())=>({0:active(player,now)?player.swanAura.endsAt:player.swanCooldownUntil||0});

// A buff can finish either on the tenth Q or on its 20-second limit. Its ten-second
// cooldown always begins at that actual finish time, never at E activation.
export function finishSwan(player,now){
  const aura=player.swanAura;if(!aura)return false;
  player.swanAura=null;
  player.swanCooldownUntil=Math.max(player.swanCooldownUntil||0,now+10000);
  return true;
}

export function castSwan(room,player,now,{basic=false}={}){
  ensure(player?.avatar?.constellationId==='cygnus'&&player.avatar.level>=2,'LV2 백조자리부터 사용할 수 있어요.');
  ensure(eligible(player),'지금은 스킬을 사용할 수 없어요.');
  if(player.swanAura&&now>=player.swanAura.endsAt)finishSwan(player,player.swanAura.endsAt);
  const spec=swanSkillOf(player),vitals=ensureVitals(player);
  if(!basic){
    ensure(!active(player,now),'날개가 유지되는 동안에는 다시 사용할 수 없어요.');
    ensure(now>=(player.swanCooldownUntil||0),'날개 스킬을 다시 쓰려면 조금 기다려주세요.');
    ensure(vitals.mp>=spec.mana,'마나가 부족해요.');
    vitals.mp-=spec.mana;
    player.swanAura={stage:spec.stage,at:now,endsAt:now+spec.durationMs,remainingAttacks:spec.maxAttacks};
    return {ready:true,vitals:playerVitals(player),cooldowns:swanCooldowns(player,now),serverNow:now};
  }
  const boosted=active(player,now),size=avatarSizeOf(player),facing=player.facing||{x:0,y:1};
  const length=Math.hypot(facing.x,facing.y)||1,dx=facing.x/length,dy=facing.y/length;
  const count=boosted?player.swanAura.stage:1;
  const power=Math.round(attackPowerOf(player.avatar.level,'cygnus',player)*(boosted?spec.effectAmount:1));
  const base={x:player.x,y:player.y,size,range:size*spec.rangeWidths,width:size*.13,
    power,basic:true,kind:'cygnus-attack',vfxId:'attack',originOffset:attackGeometryOf(player).originOffset,durationMs:650,
    visualScale:boosted?1.2:1};
  // Spread the feathers slightly, so 2/3/4 shots are visible and each has its
  // own server-authoritative flight path and first-monster collision.
  const projectiles=[];
  for(let i=0;i<count;i++){
    const lane=i-(count-1)/2,angle=lane*.11,cos=Math.cos(angle),sin=Math.sin(angle);
    const sideways=lane*size*.34;
    projectiles.push(...launchProjectiles(room,player,{...base,x:base.x-dy*sideways,y:base.y+dx*sideways,
      dx:dx*cos-dy*sin,dy:dx*sin+dy*cos},now,1));
  }
  if(boosted){
    player.swanAura.remainingAttacks--;
    if(player.swanAura.remainingAttacks===0){finishSwan(player,now);room.swanAuraChanged=true;}
  }
  return {ready:true,target:null,targets:[],playerTargets:[],vitals:playerVitals(player),
    cooldowns:swanCooldowns(player,now),serverNow:now,
    hit:{...base,dx,dy,playerId:player.id,mapId:player.mapId,projectiles}};
}

export function swanAuraViews(room,mapId,now){
  return [...room.players.values()].filter(player=>player.mapId===mapId&&eligible(player)&&
    player.avatar.constellationId==='cygnus'&&active(player,now)).map(player=>({
      playerId:player.id,mapId,stage:player.swanAura.stage,remainingAttacks:player.swanAura.remainingAttacks,
      elapsedMs:now-player.swanAura.at,durationMs:player.swanAura.endsAt-player.swanAura.at
    }));
}

export function advanceSwanAuras(room,now){
  let changed=false;
  for(const player of room.players.values()){
    if(!player.swanAura)continue;
    if(!eligible(player)||player.avatar.constellationId!=='cygnus'||now>=player.swanAura.endsAt){
      const end=Math.min(now,player.swanAura.endsAt);
      changed=finishSwan(player,end)||changed;
    }
  }
  return changed;
}
