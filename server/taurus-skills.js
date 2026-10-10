import {avatarSizeOf} from '../shared/avatar-size.js';
import {attackPowerOf,attackGeometryOf} from '../shared/combat.js';
import {taurusSkillOf} from '../shared/taurus-skills.js';
import {launchProjectiles} from './projectiles.js';
import {monstersOf,damageMonster} from './monsters.js';
import {ensureVitals,playerVitals} from './vitals.js';
import {isFree} from './world.js';
import {ensure} from './rooms.js';
import {RULES} from '../shared/config.js';

export const taurusCooldowns=p=>({0:p.taurusCooldownUntil||0});
export const taurusContactRadius=dash=>dash.size*({2:.62,3:.72,4:.84}[dash.stage]||.62);
export function castTaurus(room,player,now,{basic=false}={}){
  ensure(player?.avatar?.constellationId==='taurus'&&player.avatar.level>=2,'LV2 황소자리부터 사용할 수 있어요.');
  ensure(player.connected&&!player.away&&!player.avatar.blackStar&&ensureVitals(player).hp>0,'지금은 스킬을 사용할 수 없어요.');
  const size=avatarSizeOf(player),power=attackPowerOf(player.avatar.level,'taurus',player);
  const facing=player.facing||{x:0,y:1},length=Math.hypot(facing.x,facing.y)||1,dx=facing.x/length,dy=facing.y/length;
  if(basic){
    const base={x:player.x,y:player.y,dx,dy,size,range:size*4,width:size*.13,power,basic:true,
      kind:'taurus-attack',vfxId:'attack',originOffset:attackGeometryOf(player).originOffset,durationMs:650};
    const projectiles=launchProjectiles(room,player,base,now);
    return {ready:true,targets:[],playerTargets:[],vitals:playerVitals(player),hit:{...base,playerId:player.id,mapId:player.mapId,projectiles}};
  }
  const spec=taurusSkillOf(player),vitals=ensureVitals(player);
  ensure(!player.taurusDash||player.taurusDash.endsAt<=now,'황소 돌진 중이에요.');
  ensure(now>=(player.taurusCooldownUntil||0),'황소 돌진을 다시 쓰려면 조금 기다려주세요.');
  ensure(vitals.mp>=spec.mana,'마나가 부족해요.');
  vitals.mp-=spec.mana;player.taurusCooldownUntil=now+spec.cooldownMs;
  player.taurusDash={mapId:player.mapId,at:now,endsAt:now+spec.durationMs,dx,dy,distance:size*spec.rangeWidths,
    lastAt:now,lastInputAt:0,controlled:false,inputX:dx,inputY:dy,progress:0,
    stage:spec.stage,size,power:Math.round(power*spec.multiplier),seen:new Set()};
  player.taurusImmuneUntil=player.taurusDash.endsAt+spec.immuneAfterMs;
  player.input={x:0,y:0,at:0};
  return {ready:true,vitals:playerVitals(player),cooldowns:taurusCooldowns(player),serverNow:now};
}
export function taurusDashViews(room,mapId,now){
  return [...room.players.values()].filter(p=>p.mapId===mapId&&p.taurusDash?.mapId===mapId&&p.taurusDash.endsAt>now)
    .map(p=>({playerId:p.id,mapId,dx:p.taurusDash.dx,dy:p.taurusDash.dy,stage:p.taurusDash.stage,
      size:p.taurusDash.size,elapsedMs:now-p.taurusDash.at,durationMs:p.taurusDash.endsAt-p.taurusDash.at}));
}
export function advanceTaurusDashes(room,now){
  const hits=[];
  for(const player of room.players.values()){
    const dash=player.taurusDash;if(!dash)continue;
    if(dash.mapId!==player.mapId){player.taurusDash=null;player.taurusImmuneUntil=0;continue;}
    if(!player.connected||player.away||player.avatar.constellationId!=='taurus'||ensureVitals(player).hp<=0){player.taurusDash=null;continue;}
    const until=Math.min(now,dash.endsAt),dt=Math.max(0,until-dash.lastAt);dash.lastAt=until;
    if(player.input?.at>dash.at&&player.input.at>dash.lastInputAt){
      dash.lastInputAt=player.input.at;dash.controlled=true;
      dash.inputX=player.input.x;dash.inputY=player.input.y;
    }
    const fresh=!dash.controlled||now-dash.lastInputAt<=RULES.inputExpiryMs;
    const length=fresh?Math.hypot(dash.inputX,dash.inputY):0;
    const dx=length?dash.inputX/length:0,dy=length?dash.inputY/length:0;
    if(length){dash.dx=dx;dash.dy=dy;}
    const hitNearby=()=>{
      for(const monster of monstersOf(room,now).values()){
        if(monster.hp<=0||monster.mapId!==player.mapId||dash.seen.has(monster.id))continue;
        if(Math.hypot(monster.x-player.x,monster.y-player.y)>monster.radius+taurusContactRadius(dash))continue;
        dash.seen.add(monster.id);
        const hit=damageMonster(room,monster,player,dash.power,now);
        if(hit){if(monster.hp>0)monster.stunUntil=Math.max(monster.stunUntil||0,now+1000);
          hits.push({mapId:player.mapId,...hit});}
      }
    };
    hitNearby();
    let remaining=Math.min(Math.max(0,dash.distance-dash.progress),dash.distance*dt/(dash.endsAt-dash.at));
    // 조작 방향으로 작은 구간씩 이동해 회전한 경로에서도 벽과 몬스터를 건너뛰지 않습니다.
    while(length&&remaining>0.001){
      const step=Math.min(remaining,Math.max(8,dash.size*.18));
      const x=player.x+dx*step,y=player.y+dy*step;
      if(!isFree(room,x,y,player.id,player.mapId,false,player))break;
      player.x=x;player.y=y;dash.progress+=step;remaining-=step;
      player.facing={x:dx,y:dy};if(Math.abs(dx)>1e-6)player.facingX=dx<0?-1:1;
      hitNearby();
    }
    if(dash.endsAt<=now)player.taurusDash=null;
  }
  return hits;
}
