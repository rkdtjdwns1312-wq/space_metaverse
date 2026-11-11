import {avatarMonsterDistance,avatarPositionIsClear} from '../shared/avatar-boundary.js';
import {monsterType} from '../shared/monsters.js';
import {monsterMovementTerrainBlocked} from '../shared/monster-movement-boundary.js';
import {nearbyMonsterBodies,bodyBlocksStep} from './monster-navigation.js';
import {RULES} from '../shared/config.js';
import {LEOON_CHARGE} from '../shared/boss-skills.js';
import {starRecordNumberBodies} from './star-record-math.js';

export const BOSS_WALL_ESCAPE=Object.freeze({step:2,maxPush:48,probe:8,holdMs:200,releaseDistance:96,releaseMs:1000});
const directions=Array.from({length:16},(_,i)=>({x:Math.cos(i*Math.PI/8),y:Math.sin(i*Math.PI/8)}));
const live=(monster,mapId)=>monster.hp>0&&monster.alive!==false&&monster.mapId===mapId;
const solid=object=>object.kind==='gate'||!object.passable;
function objectDistance(monster,x,y,object){
  const rx=(object.collisionRx??object.radius??0)+monster.radius,ry=(object.collisionRy??object.radius??0)+monster.radius;
  return ((x-object.x)/rx)**2+((y-object.y)/ry)**2;
}
export function bossEscapeDestinationClear(room,map,boss,x,y,escapingPlayer=null){
  if(monsterMovementTerrainBlocked(map,boss,x,y))return false;
  for(const object of map.objects){
    if(!solid(object))continue;
    const next=objectDistance(boss,x,y,object),previous=objectDistance(boss,boss.x,boss.y,object);
    // 기존 물체 중첩은 멀어질 수만 있으며 문에는 새로 들어가지 않습니다.
    if(next<1&&!(previous<1&&next>previous+1e-6&&object.kind!=='gate'))return false;
  }
  const bodies=nearbyMonsterBodies(room.monsters,boss,Math.hypot(x-boss.x,y-boss.y));
  if(boss.recordMath)bodies.push(...starRecordNumberBodies(boss));
  if(bodyBlocksStep(bodies,x,y))return false;
  for(const player of room.players.values()){
    if(player===escapingPlayer||!player.connected||player.away||player.mapId!==boss.mapId)continue;
    const previous=avatarMonsterDistance(player,player.x,player.y,boss),next=avatarMonsterDistance(player,player.x,player.y,{...boss,x,y});
    if(next<1&&(previous>=1||next<previous-1e-6))return false;
  }
  return true;
}
// 상한은 보스 하나가 공유합니다. 입력/학생 교체나 시간 경과만으로 충전하지 않습니다.
// 보스가 스스로96px 이상 떠나고 아무 캐릭터와도 겹치지 않은 채1초 지난 경우만 새 상황입니다.
export function releaseBossWallEscapeBudget(room,boss,now){
  const state=boss.wallEscape;if(!state)return;
  const separated=Math.hypot(boss.x-state.anchorX,boss.y-state.anchorY)>=BOSS_WALL_ESCAPE.releaseDistance&&
    ![...room.players.values()].some(p=>p.connected&&!p.away&&p.mapId===boss.mapId&&avatarMonsterDistance(p,p.x,p.y,boss)<1);
  if(!separated){state.safeSince=null;return;}
  state.safeSince??=now;
  if(now-state.safeSince>=BOSS_WALL_ESCAPE.releaseMs)delete boss.wallEscape;
}
export function endBossWallEscapeInput(room,player){
  const state=room.monsters?.get(player.wallEscapeBossId)?.wallEscape;
  if(state?.playerId===player.id)state.playerId=null;
  delete player.wallEscapeBossId;
}
// 정상 이동에는 호출하지 않습니다. 기존 중첩/벽에 모든 탈출 방향이 막힌 상황만 보스를 조금 옮깁니다.
// 캐릭터 좌표에는 특례를 주지 않아 클라이언트 보간도 기존 충돌 판정을 그대로 사용합니다.
export function tryBossWallEscape(room,map,player,dx,dy,now){
  if(!Number.isFinite(now)||!Number.isFinite(dx)||!Number.isFinite(dy)||Math.hypot(dx,dy)<.99||player.away||player.avatar?.blackStar)return false;
  const monsters=[...room.monsters.values()].filter(m=>live(m,player.mapId));
  const continues=state=>state&&state.playerId===player.id&&now-state.lastAt<=RULES.tickMs*2&&
    Math.hypot(player.x-state.playerX,player.y-state.playerY)<1e-6&&dx*state.dx+dy*state.dy>.999;
  const probe=BOSS_WALL_ESCAPE.probe;
  // 첫 밀기는 접촉/중첩에서만 시작합니다. 이어지는 밀기는 기존8px 걸음이 들어갈 틈까지만 확보합니다.
  const overlaps=monsters.filter(m=>avatarMonsterDistance(player,player.x,player.y,m)<=1+1e-6||
    continues(m.wallEscape)&&avatarMonsterDistance(player,player.x+dx*probe,player.y+dy*probe,m)<1);
  if(overlaps.length!==1)return false;
  const boss=overlaps[0];if(!monsterType(boss.typeId)?.boss||boss.leoonSkill?.kind===LEOON_CHARGE.kind)return false;
  const others=monsters.filter(m=>m!==boss);
  if(!avatarPositionIsClear(map,player.x+dx*probe,player.y+dy*probe,player,others,player))return false;
  // 이미 해당 입력의 길이 열렸으면 밀지 않고 다음 정상 이동에 맡깁니다.
  if(avatarPositionIsClear(map,player.x+dx*probe,player.y+dy*probe,player,monsters,player))return false;
  const state=boss.wallEscape;
  const continuing=continues(state);
  if(!continuing&&[2,probe].some(distance=>directions.some(d=>avatarPositionIsClear(map,player.x+d.x*distance,player.y+d.y*distance,player,[boss],player))))return false;
  if(state&&(state.used>=BOSS_WALL_ESCAPE.maxPush||now-state.lastAt<RULES.tickMs))return false;
  const amount=Math.min(BOSS_WALL_ESCAPE.step,BOSS_WALL_ESCAPE.maxPush-(state?.used||0));
  const x=boss.x+dx*amount,y=boss.y+dy*amount;
  if(!bossEscapeDestinationClear(room,map,boss,x,y,player))return false;
  // 밀기 방향이 현재 중첩을 줄이는 경우만 허용합니다.
  if(avatarMonsterDistance(player,player.x,player.y,{...boss,x,y})<=avatarMonsterDistance(player,player.x,player.y,boss))return false;
  boss.wallEscape={...(state||{anchorX:boss.x,anchorY:boss.y,used:0}),used:(state?.used||0)+amount,
    lastAt:now,holdUntil:now+BOSS_WALL_ESCAPE.holdMs,playerId:player.id,playerX:player.x,playerY:player.y,dx,dy,safeSince:null};
  boss.x=x;boss.y=y;
  player.wallEscapeBossId=boss.id;
  return true;
}
