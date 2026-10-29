import {avatarSizeOf} from './avatar-size.js';
import {onParadiseFloor} from './paradise-floor.js';
import {onPlazaFloor} from './plaza-layout.js';
import {onValleyFloor} from './valley-layout.js';
import {monsterFootprint} from './monster-geometry.js';

// 이동은 허리(y)~발(y+size/2)의 하반신 원. 그림·전투·깊이 정렬은 그대로입니다.
export function avatarCollisionShape(player){
  const size=!player?32:player.role!=='teacher'&&player.avatar?.blackStar?52:avatarSizeOf(player);
  return {halfWidth:size/4,offsetY:size/4,radius:size/4};
}
export function avatarFloorRadius(player){
  return avatarCollisionShape(player).radius;
}
export function avatarFootprint(player,x=player?.x,y=player?.y){
  const shape=avatarCollisionShape(player);return {x,y:y+shape.offsetY,...shape};
}
export function avatarFitsFloor(map,x,y,player){
  const foot=avatarFootprint(player,x,y),r=foot.radius;y=foot.y;
  return Number.isFinite(x)&&Number.isFinite(y)&&x>=r&&y>=r&&x<=map.width-r&&y<=map.height-r&&
    onParadiseFloor(map,x,y,r)&&onPlazaFloor(map,x,y,r)&&onValleyFloor(map,x,y,r);
}
export function avatarTouchesObject(player,x,y,object){
  const foot=avatarFootprint(player,x,y);
  if(Number.isFinite(object.collisionRx)&&Number.isFinite(object.collisionRy))
    return ((foot.x-object.x)/(object.collisionRx+foot.radius))**2+((foot.y-object.y)/(object.collisionRy+foot.radius))**2<1;
  return Math.hypot(foot.x-object.x,foot.y-object.y)<foot.radius+object.radius;
}
export function avatarMonsterDistance(player,x,y,monster){
  const foot=avatarFootprint(player,x,y),wall=monsterFootprint(monster);
  return ((foot.x-wall.x)/(wall.rx+foot.radius))**2+((foot.y-wall.y)/(wall.ry+foot.radius))**2;
}
// 서버 이동과 클라이언트 보간이 같은 하반신·물체·몬스터 경계를 사용합니다.
export function avatarPositionIsClear(map,x,y,player,monsters=[],from=null,ignoreMonsters=false){
  if(!avatarFitsFloor(map,x,y,player))return false;
  for(const object of map.objects){
    if(object.passable||!avatarTouchesObject(player,x,y,object))continue;
    // 크기/판정 변경으로 물체에 걸친 경우에도 더 깊이 들어가지 않고 빠져나옵니다.
    if(from?.mapId===map.id&&avatarTouchesObject(player,from.x,from.y,object)){
      const next=avatarFootprint(player,x,y),previous=avatarFootprint(player,from.x,from.y);
      if(Math.hypot(next.x-object.x,next.y-object.y)>Math.hypot(previous.x-object.x,previous.y-object.y))continue;
    }
    return false;
  }
  if(ignoreMonsters)return true;
  for(const monster of monsters){
    if(monster.hp<=0||monster.alive===false||monster.mapId!==map.id)continue;
    const next=avatarMonsterDistance(player,x,y,monster);
    if(next>=1)continue;
    if(from&&from.mapId===map.id){
      const previous=avatarMonsterDistance(player,from.x,from.y,monster);
      if(previous<1&&next>previous)continue;
    }
    return false;
  }
  return true;
}
export function avatarRenderPoint(map,point,fallback,player,monsters=[],previous=null,maxDistance=Infinity,ignoreMonsters=false){
  if(!previous||Math.hypot(point.x-previous.x,point.y-previous.y)>240){
    return avatarPositionIsClear(map,point.x,point.y,player,monsters,{...fallback,mapId:map.id},ignoreMonsters)?point:fallback;
  }
  // 보간점이 모서리를 자르면 최신 서버 좌표로 뛰지 않고 직전 화면 위치에서
  // 서버와 같은 작은 축별 이동으로 경계까지 따라갑니다. 다음 프레임에 과거
  // 보간점으로 되돌아가는 현상과 얇은 물체를 가로지르는 현상을 함께 막습니다.
  const result={x:previous.x,y:previous.y,mapId:map.id};
  const distance=Math.hypot(point.x-result.x,point.y-result.y);
  if(!distance)return {x:result.x,y:result.y};
  const ratio=Math.min(1,Math.max(0,maxDistance)/distance);
  const dx=(point.x-result.x)*ratio,dy=(point.y-result.y)*ratio,steps=Math.max(1,Math.ceil(Math.hypot(dx,dy)/8));
  for(let i=0;i<steps;i++){
    // 평소에는 한 번만 검사하고, 막힌 경우에만 축별 미끄러짐을 검사합니다.
    if(avatarPositionIsClear(map,result.x+dx/steps,result.y+dy/steps,player,monsters,result,ignoreMonsters)){
      result.x+=dx/steps;result.y+=dy/steps;continue;
    }
    // 진화/서버 재배치로 이전 그림의 하반신이 바닥 밖이 된 경우만 재설정합니다.
    if(!avatarFitsFloor(map,result.x,result.y,player))return fallback;
    if(avatarPositionIsClear(map,result.x+dx/steps,result.y,player,monsters,result,ignoreMonsters))result.x+=dx/steps;
    if(avatarPositionIsClear(map,result.x,result.y+dy/steps,player,monsters,result,ignoreMonsters))result.y+=dy/steps;
  }
  return {x:result.x,y:result.y};
}
