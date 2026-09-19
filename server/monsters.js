import {MONSTER_TYPES,MONSTER_HP,MONSTER_COMBAT} from '../shared/monsters.js';
import {ATTACK_VISUAL} from '../shared/combat.js';
import {RULES,mapOf} from '../shared/config.js';
import {ensureVitals} from './vitals.js';
import {constellationOf} from '../shared/constellations.js';
import {damagePlayersInArea} from './area-combat.js';


export const MONSTER_RULES=Object.freeze({directionMs:1000,speed:36,radius:24,respawnMs:10000,hitRadius:18,attackMs:1000,mapExitHealCount:3});
const spawns=[[260,280],[600,260],[920,300],[360,590],[830,590]];
const largeSpawns=[[205,235],[600,235],[995,235],[400,660],[800,660]];
export const monstersMayOverlap=mapId=>mapId==='star-origin-1'||mapId==='star-origin-2';
// 산책·체력은 교실별 실행 상태입니다. 처치 10초 뒤 같은 자리에서 다시 나타납니다.
export function monstersOf(room,now=Date.now()){
  if(!room.monsters)room.monsters=new Map(MONSTER_TYPES.map((type,i)=>{
    const map=mapOf(type.mapId,room.planets?.values?.()||[]);
    const [baseX,baseY]=(type.level===3?largeSpawns:spawns)[i%5];
    const x=baseX*map.width/1200,y=baseY*map.height/900;
    // 단계가 오를수록 별자리 몬스터가 눈에 띄게 커집니다: 1단계×1, 2단계×2, 3단계×4.
    // 별의 시작점 3 몬스터는 기존 그림과 충돌 반경을 함께 절반으로 줄입니다.
    const multiplier={1:1,2:2,3:4}[type.level]||1;
    const radius=MONSTER_RULES.radius*multiplier;
    return [type.id,{id:type.id,typeId:type.id,mapId:type.mapId,x,y,radius,
      hp:MONSTER_HP[type.mapId],maxHp:MONSTER_HP[type.mapId],respawnAt:null,spawnX:x,spawnY:y,
      targetId:null,attackers:new Map(),attackOrder:0,mapExitCount:0,nextAttackAt:0,dx:0,dy:0,nextDirectionAt:now,lastMoveAt:now}];
  }));
  return room.monsters;
}
export function monsterViews(room){
  return [...monstersOf(room).values()].map(m=>({id:m.id,typeId:m.typeId,mapId:m.mapId,x:m.x,y:m.y,radius:m.radius,
    hp:m.hp,maxHp:m.maxHp,alive:m.hp>0,busy:false,targetId:m.targetId,attackPower:MONSTER_COMBAT[m.mapId].power}));
}
// 한 번에 범위 안의 모든 몬스터를 맞힙니다. 방향·범위·피해량은 서버가 정합니다.
export function monstersInAttackArea(room,player,now=Date.now()){
  const facing=player.facing||{x:0,y:1};
  const hx=player.x+facing.x*ATTACK_VISUAL.reach,hy=player.y+facing.y*ATTACK_VISUAL.reach;
  return [...monstersOf(room,now).values()].filter(m=>{
    const dx=m.x-player.x,dy=m.y-player.y;
    return m.hp>0&&m.mapId===player.mapId&&dx*facing.x+dy*facing.y>0&&
      Math.hypot(m.x-hx,m.y-hy)<=m.radius+ATTACK_VISUAL.hitRadius;
  }).sort((a,b)=>Math.hypot(a.x-player.x,a.y-player.y)-Math.hypot(b.x-player.x,b.y-player.y));
}
export function strikeMonsters(room,player,power,now=Date.now()){
  return monstersInAttackArea(room,player,now).map(target=>{
  // 지난 공격자가 떠난 전투를 먼저 정리한 뒤 새 공격 피해를 적용합니다.
  selectMonsterTarget(room,target);
  target.hp=Math.max(0,target.hp-power);
  if(target.hp===0){target.respawnAt=now+MONSTER_RULES.respawnMs;target.targetId=null;target.attackers.clear();target.mapExitCount=0;}
  else{
    if(!target.attackers.size)target.nextAttackAt=Math.max(target.nextAttackAt,now+150);
    target.attackers.set(player.id,++target.attackOrder);selectMonsterTarget(room,target);
  }
  return {monsterId:target.id,damage:power,hp:target.hp,maxHp:target.maxHp,defeated:target.hp===0};
  });
}
// 이전 서버 테스트/연동의 단수 응답 호환. 실제 적용은 항상 모든 대상입니다.
export const strikeMonster=(...args)=>strikeMonsters(...args)[0]||null;
// 같은 순위 안에서는 마지막 공격자가 우선. 공격하지 않은 학생은 후보가 되지 않습니다.
export function selectMonsterTarget(room,monster){
  const candidates=[],hadAttackers=monster.attackers.size>0;
  for(const [id,order] of monster.attackers){
    const player=room.players?.get(id);
    // 현재 공격자 목록에서 맵을 실제로 떠난 사람만 한 번 집계합니다.
    // 목록에서 제거하므로 다음 틱에 중복 집계하거나 단순 재입장을 집계하지 않습니다.
    if(player&&player.mapId!==monster.mapId)monster.mapExitCount=(monster.mapExitCount||0)+1;
    if(!player||!player.connected||player.away||player.role==='teacher'||player.avatar?.blackStar||player.mapId!==monster.mapId||!(ensureVitals(player)?.hp>0)){
      monster.attackers.delete(id);continue;
    }
    const type=constellationOf(player.avatar.constellationId,player.avatar.level)?.type;
    candidates.push({player,order,priority:type==='수호계'?0:type==='특수계'?1:2});
  }
  candidates.sort((a,b)=>a.priority-b.priority||b.order-a.order);
  const selected=candidates[0]?.player||null;
  if(monster.hp>0&&((hadAttackers&&!selected)||monster.mapExitCount>=MONSTER_RULES.mapExitHealCount)){
    monster.hp=monster.maxHp;monster.mapExitCount=0;
    // 3회 이탈 후에도 남은 학생은 계속 추적하며 공격 간격은 유지합니다.
    if(!selected)monster.nextAttackAt=0;
  }
  monster.targetId=selected?.id||null;return selected;
}
export function moveMonsters(room,now=Date.now(),random=Math.random){
  const monsters=monstersOf(room,now);
  const hits=[];
  for(const m of monsters.values()){
    if(m.hp<=0){
      if(now<m.respawnAt)continue;
      if(!monstersMayOverlap(m.mapId)&&[...monsters.values()].some(o=>o!==m&&o.hp>0&&o.mapId===m.mapId&&Math.hypot(m.spawnX-o.x,m.spawnY-o.y)<m.radius+o.radius+10))continue;
      Object.assign(m,{hp:m.maxHp,respawnAt:null,targetId:null,attackers:new Map(),attackOrder:0,mapExitCount:0,nextAttackAt:0,x:m.spawnX,y:m.spawnY,lastMoveAt:now,nextDirectionAt:now});
    }
    const dt=Math.max(0,Math.min(100,now-m.lastMoveAt))/1000;m.lastMoveAt=now;
    const rule=MONSTER_COMBAT[m.mapId],factor=rule.speedFactor;
    const previousTarget=m.targetId,target=selectMonsterTarget(room,m);
    if(previousTarget&&!target)m.nextDirectionAt=now;
    const reach=m.radius+(ATTACK_VISUAL.reach-RULES.radius);
    let distance=Infinity;
    if(target){
      const dx=target.x-m.x,dy=target.y-m.y;distance=Math.hypot(dx,dy);
      if(distance>0){m.dx=dx/distance;m.dy=dy/distance;}
    }else if(now>=m.nextDirectionAt){const angle=random()*Math.PI*2;m.dx=Math.cos(angle);m.dy=Math.sin(angle);m.nextDirectionAt=now+MONSTER_RULES.directionMs/factor;}
    const travel=target?Math.min(MONSTER_RULES.speed*factor*dt,Math.max(0,distance-(m.radius+RULES.radius+8))):MONSTER_RULES.speed*factor*dt;
    const x=m.x+m.dx*travel,y=m.y+m.dy*travel;
    // 문 주변은 비워 둡니다. 1·2구역은 겹침 허용, 3구역만 서로 간격을 둡니다.
    const map=mapOf(m.mapId,room.planets?.values?.()||[]);
    const blocked=x<Math.max(120,m.radius)||x>map.width-Math.max(120,m.radius)||y<Math.max(190,m.radius)||y>map.height-Math.max(190,m.radius)||(!monstersMayOverlap(m.mapId)&&[...monsters.values()].some(o=>o!==m&&o.hp>0&&o.mapId===m.mapId&&Math.hypot(x-o.x,y-o.y)<m.radius+o.radius+10));
    if(blocked){if(!target){m.dx=-m.dx;m.dy=-m.dy;}}else{m.x=x;m.y=y;}
    if(target&&now>=m.nextAttackAt){
      const dx=target.x-m.x,dy=target.y-m.y,distance=Math.hypot(dx,dy);
      // 초근접에서도 몸을 뚫고 지나가거나 후방을 원격 공격하지 않도록 몸 앞 근접 거리만 판정합니다.
      if(distance<=reach+RULES.radius+MONSTER_RULES.hitRadius){
        if(distance>0){m.dx=dx/distance;m.dy=dy/distance;}
        const attackReach=Math.min(reach,distance);
        const results=damagePlayersInArea(room,{mapId:m.mapId,x:m.x+m.dx*attackReach,y:m.y+m.dy*attackReach,radius:MONSTER_RULES.hitRadius,excludeTeachers:true},rule.power,now);
        if(results.length){m.nextAttackAt=now+MONSTER_RULES.attackMs/factor;
          for(const result of results)hits.push({monsterId:m.id,mapId:m.mapId,x:m.x,y:m.y,dx:m.dx,dy:m.dy,reach:attackReach,durationMs:ATTACK_VISUAL.durationMs,...result});
          if(results.some(result=>result.defeated))selectMonsterTarget(room,m);
        }
      }
    }
  }
  return hits;
}
