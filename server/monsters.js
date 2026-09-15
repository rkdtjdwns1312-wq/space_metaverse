import {MONSTER_TYPES} from '../shared/monsters.js';
import {ensure} from './rooms.js';
import {isNear} from './world.js';


export const MONSTER_RULES=Object.freeze({directionMs:1000,speed:36,radius:24});
const spawns=[[260,280],[600,260],[920,300],[360,590],[830,590]];
// 산책 상태는 실행 중인 교실별로 유지합니다. 사냥·보상은 아직 구현하지 않습니다.
export function monstersOf(room,now=Date.now()){
  if(!room.monsters)room.monsters=new Map(MONSTER_TYPES.map((type,i)=>{
    const [x,y]=spawns[i%5];return [type.id,{id:type.id,typeId:type.id,mapId:type.mapId,x,y,radius:MONSTER_RULES.radius,
      dx:0,dy:0,nextDirectionAt:now,lastMoveAt:now}];
  }));
  return room.monsters;
}
export function monsterViews(room){
  return [...monstersOf(room).values()].map(m=>({id:m.id,typeId:m.typeId,mapId:m.mapId,x:m.x,y:m.y,radius:m.radius,
    alive:true,busy:false}));
}
export function nearbyMonster(room,player,id){
  ensure(player?.connected&&!player.away,'먼저 교실에 입장해주세요.');
  const m=monstersOf(room).get(id);
  ensure(m,'별자리 몬스터를 찾지 못했어요.');
  ensure(m.mapId===player.mapId&&isNear(player,m),'별자리 몬스터 가까이로 다가가세요.');
  return m;
}
export function moveMonsters(room,now=Date.now(),random=Math.random){
  const monsters=monstersOf(room,now);
  for(const m of monsters.values()){
    const dt=Math.max(0,Math.min(100,now-m.lastMoveAt))/1000;m.lastMoveAt=now;
    if(now>=m.nextDirectionAt){const angle=random()*Math.PI*2;m.dx=Math.cos(angle);m.dy=Math.sin(angle);m.nextDirectionAt=now+MONSTER_RULES.directionMs;}
    const x=m.x+m.dx*MONSTER_RULES.speed*dt,y=m.y+m.dy*MONSTER_RULES.speed*dt;
    // 문 주변은 비워 두고, 몬스터끼리 같은 자리에 뭉치지 않게 합니다.
    const blocked=x<120||x>1080||y<190||y>710||[...monsters.values()].some(o=>o!==m&&o.mapId===m.mapId&&Math.hypot(x-o.x,y-o.y)<MONSTER_RULES.radius*2+10);
    if(blocked){m.dx=-m.dx;m.dy=-m.dy;}else{m.x=x;m.y=y;}
  }
}
