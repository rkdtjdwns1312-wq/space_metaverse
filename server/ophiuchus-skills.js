import {avatarSizeOf} from '../shared/avatar-size.js';
import {attackPowerOf,attackGeometryOf} from '../shared/combat.js';
import {ophiuchusSkillOf} from '../shared/ophiuchus-skills.js';
import {combatEnemies,damageTargets} from './sagittarius-skills.js';
import {launchProjectiles} from './projectiles.js';
import {ensureVitals,playerVitals} from './vitals.js';
import {ensure} from './rooms.js';

const eligible=p=>p?.connected&&!p.away&&!p.avatar?.blackStar&&ensureVitals(p).hp>0;
export const ophiuchusCooldowns=p=>({0:p.ophiuchusCooldownUntil||0});
const poisonOf=target=>target?.combatPoison;

function venomTargets(room,player,dx,dy,size,spec){
  const start=size*.6,reach=size*spec.rangeWidths,halfWidth=size*spec.halfWidthWidths;
  return combatEnemies(room,player).filter(target=>{
    const x=target.entity.x-player.x,y=target.entity.y-player.y;
    const forward=x*dx+y*dy,side=Math.abs(x*(-dy)+y*dx);
    return forward+target.radius>=start&&forward-target.radius<=start+reach&&side<=halfWidth+target.radius;
  });
}

export function castOphiuchus(room,player,now,{basic=false}={}){
  ensure(player?.avatar?.constellationId==='ophiuchus'&&player.avatar.level>=2,'LV2 뱀주인자리부터 사용할 수 있어요.');
  ensure(eligible(player),'지금은 스킬을 사용할 수 없어요.');
  const size=avatarSizeOf(player),facing=player.facing||{x:0,y:1};
  const length=Math.hypot(facing.x,facing.y)||1,dx=facing.x/length,dy=facing.y/length;
  const spec=ophiuchusSkillOf(player),vitals=ensureVitals(player);
  const power=attackPowerOf(player.avatar.level,'ophiuchus',player);
  if(basic){
    const base={x:player.x,y:player.y,dx,dy,size,range:size*4,width:size*.13,power,
      basic:true,kind:'ophiuchus-attack',vfxId:'attack',originOffset:attackGeometryOf(player).originOffset,durationMs:650};
    const projectiles=launchProjectiles(room,player,base,now);
    return {ready:true,target:null,targets:[],playerTargets:[],vitals:playerVitals(player),
      hit:{...base,playerId:player.id,mapId:player.mapId,projectiles}};
  }
  ensure(now>=(player.ophiuchusCooldownUntil||0),'뱀 스킬을 다시 쓰려면 조금 기다려주세요.');
  ensure(vitals.mp>=spec.mana,'마나가 부족해요.');
  vitals.mp-=spec.mana;player.ophiuchusCooldownUntil=now+spec.cooldownMs;
  room.ophiuchusVenoms??=[];
  room.ophiuchusVenoms.push({playerId:player.id,mapId:player.mapId,x:player.x,y:player.y,dx,dy,size,spec,power,hitAt:now+1000});
  return {ready:true,targets:[],playerTargets:[],vitals:playerVitals(player),cooldowns:ophiuchusCooldowns(player),serverNow:now,
    hit:{playerId:player.id,mapId:player.mapId,x:player.x,y:player.y,dx,dy,size,
      kind:'ophiuchus-skill',vfxId:`skill-lv${spec.stage}`,durationMs:4000,
      snakeScale:spec.snakeScale,range:size*spec.rangeWidths,halfWidth:size*spec.halfWidthWidths,
      originOffset:size*.6}};
}
export function advanceOphiuchusVenoms(room,now){
  const events=[],keep=[];
  for(const venom of room.ophiuchusVenoms||[]){
    if(now<venom.hitAt){keep.push(venom);continue;}
    const player=room.players.get(venom.playerId);
    if(!player||!eligible(player)||player.mapId!==venom.mapId)continue;
    const selected=venomTargets(room,{...player,x:venom.x,y:venom.y},venom.dx,venom.dy,venom.size,venom.spec);
    const hit=damageTargets(room,player,selected,Math.round(venom.power*venom.spec.directMultiplier*venom.spec.effectAmount),now);
    for(const target of selected){
      if(target.entity.hp===0||target.kind==='player'&&ensureVitals(target.entity).hp===0)continue;
      const old=poisonOf(target.entity),active=old?.expiresAt>now&&old?.mapId===venom.mapId;
      const layers=active?[...old.layers]:[];
      layers.push({sourceId:player.id,power:Math.round(venom.power*venom.spec.effectAmount)});
      target.entity.combatPoison={mapId:venom.mapId,layers,stacks:layers.length,
        expiresAt:active?old.expiresAt+3000:now+venom.spec.poisonMs,
        nextTickAt:active?old.nextTickAt:now+1000};
    }
    events.push({mapId:venom.mapId,...hit});
  }
  room.ophiuchusVenoms=keep;return events;
}

export function advanceOphiuchusPoison(room,now){
  const events=[];let changed=false;
  const targets=[...room.players.values()].map(entity=>({entity,kind:'player'}));
  for(const monster of room.monsters?.values()||[])targets.push({entity:monster,kind:'monster'});
  for(const target of targets){
    const p=target.entity,poison=p.combatPoison;if(!poison)continue;
    if(p.mapId!==poison.mapId||(target.kind==='monster'?p.hp<=0:!eligible(p))){p.combatPoison=null;changed=true;continue;}
    const layers=poison.layers.filter(layer=>{
      const source=room.players.get(layer.sourceId);
      return source&&eligible(source)&&source.mapId===poison.mapId;
    });
    if(layers.length!==poison.layers.length){poison.layers=layers;poison.stacks=layers.length;changed=true;}
    if(!layers.length){p.combatPoison=null;continue;}
    while(poison.nextTickAt<=now&&poison.nextTickAt<=poison.expiresAt){
      for(const layer of layers){
        const source=room.players.get(layer.sourceId);
        const result=damageTargets(room,source,[{entity:p,kind:target.kind}],layer.power,poison.nextTickAt);
        events.push({mapId:poison.mapId,...result});
        if(target.kind==='monster'?p.hp<=0:ensureVitals(p).hp<=0)break;
      }
      poison.nextTickAt+=1000;
      if(target.kind==='monster'?p.hp<=0:ensureVitals(p).hp<=0)break;
    }
    if(now>=poison.expiresAt||(target.kind==='monster'?p.hp<=0:ensureVitals(p).hp<=0)){
      p.combatPoison=null;changed=true;
    }
  }
  return {events,changed};
}
