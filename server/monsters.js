import {MONSTER_TYPES,MONSTER_HP} from '../shared/monsters.js';
import {ATTACK_VISUAL} from '../shared/combat.js';


export const MONSTER_RULES=Object.freeze({directionMs:1000,speed:36,radius:24,respawnMs:10000,hitRadius:18});
const spawns=[[260,280],[600,260],[920,300],[360,590],[830,590]];
const largeSpawns=[[205,235],[600,235],[995,235],[400,660],[800,660]];
// 산책·체력은 교실별 실행 상태입니다. 처치 10초 뒤 같은 자리에서 다시 나타납니다.
export function monstersOf(room,now=Date.now()){
  if(!room.monsters)room.monsters=new Map(MONSTER_TYPES.map((type,i)=>{
    const [x,y]=(type.level===3?largeSpawns:spawns)[i%5];
    // 단계가 오를수록 별자리 몬스터가 눈에 띄게 커집니다: 1단계×1, 2단계×2, 3단계×8.
    const multiplier={1:1,2:2,3:8}[type.level]||1;
    const radius=MONSTER_RULES.radius*multiplier;
    return [type.id,{id:type.id,typeId:type.id,mapId:type.mapId,x,y,radius,
      hp:MONSTER_HP[type.mapId],maxHp:MONSTER_HP[type.mapId],respawnAt:null,spawnX:x,spawnY:y,
      dx:0,dy:0,nextDirectionAt:now,lastMoveAt:now}];
  }));
  return room.monsters;
}
export function monsterViews(room){
  return [...monstersOf(room).values()].map(m=>({id:m.id,typeId:m.typeId,mapId:m.mapId,x:m.x,y:m.y,radius:m.radius,
    hp:m.hp,maxHp:m.maxHp,alive:m.hp>0,busy:false}));
}
// 한 공격은 가장 가까운 한 몬스터만 맞힙니다. 클라이언트는 대상/피해량을 지정하지 않습니다.
export function strikeMonster(room,player,power,now=Date.now()){
  const facing=player.facing||{x:0,y:1};
  const hx=player.x+facing.x*ATTACK_VISUAL.reach,hy=player.y+facing.y*ATTACK_VISUAL.reach;
  const candidates=[...monstersOf(room,now).values()].filter(m=>{
    const dx=m.x-player.x,dy=m.y-player.y;
    return m.hp>0&&m.mapId===player.mapId&&dx*facing.x+dy*facing.y>0&&
      Math.hypot(m.x-hx,m.y-hy)<=m.radius+MONSTER_RULES.hitRadius;
  }).sort((a,b)=>Math.hypot(a.x-player.x,a.y-player.y)-Math.hypot(b.x-player.x,b.y-player.y));
  const target=candidates[0];if(!target)return null;
  target.hp=Math.max(0,target.hp-power);
  if(target.hp===0)target.respawnAt=now+MONSTER_RULES.respawnMs;
  return {monsterId:target.id,damage:power,hp:target.hp,maxHp:target.maxHp,defeated:target.hp===0};
}
export function moveMonsters(room,now=Date.now(),random=Math.random){
  const monsters=monstersOf(room,now);
  for(const m of monsters.values()){
    if(m.hp<=0){
      if(now<m.respawnAt)continue;
      if([...monsters.values()].some(o=>o!==m&&o.hp>0&&o.mapId===m.mapId&&Math.hypot(m.spawnX-o.x,m.spawnY-o.y)<m.radius+o.radius+10))continue;
      Object.assign(m,{hp:m.maxHp,respawnAt:null,x:m.spawnX,y:m.spawnY,lastMoveAt:now,nextDirectionAt:now});
    }
    const dt=Math.max(0,Math.min(100,now-m.lastMoveAt))/1000;m.lastMoveAt=now;
    if(now>=m.nextDirectionAt){const angle=random()*Math.PI*2;m.dx=Math.cos(angle);m.dy=Math.sin(angle);m.nextDirectionAt=now+MONSTER_RULES.directionMs;}
    const x=m.x+m.dx*MONSTER_RULES.speed*dt,y=m.y+m.dy*MONSTER_RULES.speed*dt;
    // 문 주변은 비워 두고, 몬스터끼리 같은 자리에 뭉치지 않게 합니다.
    const blocked=x<Math.max(120,m.radius)||x>1200-Math.max(120,m.radius)||y<Math.max(190,m.radius)||y>900-Math.max(190,m.radius)||[...monsters.values()].some(o=>o!==m&&o.hp>0&&o.mapId===m.mapId&&Math.hypot(x-o.x,y-o.y)<m.radius+o.radius+10);
    if(blocked){m.dx=-m.dx;m.dy=-m.dy;}else{m.x=x;m.y=y;}
  }
}
