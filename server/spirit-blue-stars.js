import {interactionDistance,interactionReach} from '../shared/config.js';
import {SPIRIT_BLUE_STAR} from '../shared/boss-skills.js';
import {constellationOf} from '../shared/constellations.js';
import {onParadiseFloor} from '../shared/paradise-floor.js';
import {ensureVitals,damagePlayer} from './vitals.js';
import {reflectLibraDamage} from './area-combat.js';

const MIN_SPAWN_GAP=190;
const objectGap=(object,radius)=>radius+(object.radius||0)+42;
function validBlueStarPoint(map,x,y,radius,placed=[]){
  if(!Number.isFinite(x)||!Number.isFinite(y)||!onParadiseFloor(map,x,y,radius))return false;
  if(map.spawn&&Math.hypot(x-map.spawn.x,y-map.spawn.y)<MIN_SPAWN_GAP+radius)return false;
  for(const object of map.objects||[]){
    if(object.kind!=='gate'&&object.passable)continue;
    if(Math.hypot(x-object.x,y-object.y)<objectGap(object,radius))return false;
  }
  return placed.every(point=>Math.hypot(x-point.x,y-point.y)>=SPIRIT_BLUE_STAR.minSeparation);
}

export function spiritBlueStarPositions(map,random=Math.random){
  const chosen=[],margin=SPIRIT_BLUE_STAR.radius+24;
  const candidate=()=>({x:margin+random()*(map.width-margin*2),y:margin+random()*(map.height-margin*2)});
  for(let tries=0;tries<SPIRIT_BLUE_STAR.placementAttempts&&chosen.length<SPIRIT_BLUE_STAR.count;tries++){
    const point=candidate();if(validBlueStarPoint(map,point.x,point.y,SPIRIT_BLUE_STAR.radius,chosen))chosen.push(point);
  }
  if(chosen.length<SPIRIT_BLUE_STAR.count){
    const step=130;
    for(let y=margin;y<map.height-margin&&chosen.length<SPIRIT_BLUE_STAR.count;y+=step)
      for(let x=margin;x<map.width-margin&&chosen.length<SPIRIT_BLUE_STAR.count;x+=step)
        if(validBlueStarPoint(map,x,y,SPIRIT_BLUE_STAR.radius,chosen))chosen.push({x,y});
  }
  return chosen.length===SPIRIT_BLUE_STAR.count?chosen:null;
}

export function summonSpiritBlueStars(room,boss,now,map,random=Math.random){
  const positions=spiritBlueStarPositions(map,random);
  if(!positions)return false;
  room.spiritBlueStarSequence=(room.spiritBlueStarSequence||0)+1;
  room.spiritBlueStars??=[];
  for(const [index,point] of positions.entries())room.spiritBlueStars.push({
    id:`${boss.id}-blue-star-${room.spiritBlueStarSequence}-${index+1}`,bossId:boss.id,mapId:boss.mapId,
    x:point.x,y:point.y,radius:SPIRIT_BLUE_STAR.radius,startsAt:now,endsAt:now+SPIRIT_BLUE_STAR.durationMs,
    power:(boss.power||30)*SPIRIT_BLUE_STAR.damageMultiplier
  });
  return true;
}

export function clearSpiritBlueStars(room,bossId){
  room.spiritBlueStars=(room.spiritBlueStars||[]).filter(star=>star.bossId!==bossId);
}

export function tickSpiritBlueStars(room,now,mapFor){
  const hits=[],remaining=[];
  for(const star of room.spiritBlueStars||[]){
    const boss=room.monsters?.get(star.bossId);
    if(!boss||boss.hp<=0||boss.mapId!==star.mapId||now>=star.endsAt)continue;
    remaining.push(star);
  }
  // Resolve detonations in cast order. A reflected hit that kills the boss ends the sequence.
  for(const star of room.spiritBlueStars||[]){
    const boss=room.monsters?.get(star.bossId);
    if(!boss||boss.hp<=0||boss.mapId!==star.mapId||now<star.endsAt)continue;
    const targets=[...(room.players?.values()||[])].filter(player=>player.connected&&!player.away&&!player.avatar?.blackStar&&
      player.role==='student'&&player.mapId===star.mapId&&player.avatar?.level>=2&&
      constellationOf(player.avatar.constellationId,player.avatar.level)&&ensureVitals(player)?.hp>0);
    for(const player of targets){
      if(boss.hp<=0)break;
      const result=damagePlayer(player,star.power,now,{room});
      if(!result)continue;
      hits.push({monsterId:boss.id,mapId:star.mapId,x:star.x,y:star.y,reach:star.radius,
        skillKind:SPIRIT_BLUE_STAR.kind,durationMs:550,targetId:player.id,...result});
      if(result.reflectedDamage&&boss.hp>0)reflectLibraDamage(room,player,{sourceMonsterId:boss.id},result.reflectedDamage,now);
    }
  }
  room.spiritBlueStars=remaining.filter(star=>{
    const boss=room.monsters?.get(star.bossId);
    return boss?.hp>0&&boss.mapId===star.mapId&&now<star.endsAt;
  });
  return hits;
}

export function spiritBlueStarViews(room,mapId,now){
  return (room.spiritBlueStars||[]).filter(star=>star.mapId===mapId&&now<star.endsAt&&
    room.monsters?.get(star.bossId)?.hp>0&&room.monsters.get(star.bossId)?.mapId===star.mapId)
    .map(({id,bossId,mapId,x,y,radius,startsAt,endsAt})=>({id,bossId,mapId,x,y,radius,startsAt,endsAt}));
}

export function disarmSpiritBlueStar(room,player,starId,now=Date.now()){
  const stars=room.spiritBlueStars||[],index=stars.findIndex(star=>star.id===starId);
  if(index<0)throw new Error('해체할 별이 이미 사라졌어요.');
  const star=stars[index],boss=room.monsters?.get(star.bossId);
  if(!player?.connected||player.away||player.avatar?.blackStar||ensureVitals(player)?.hp<=0||player.mapId!==star.mapId||
    !boss||boss.hp<=0||boss.mapId!==star.mapId||now>=star.endsAt||
    interactionDistance(player,star)>interactionReach(star))throw new Error('푸른 별 가까이에서 해체해 주세요.');
  stars.splice(index,1);
  return {message:'푸른 별을 해체했어요.'};
}
