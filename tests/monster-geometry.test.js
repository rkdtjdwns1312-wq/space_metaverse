import test from 'node:test';
import assert from 'node:assert/strict';
import {MONSTER_TYPES,monsterVisualScale} from '../shared/monsters.js';
import {monsterFootprint,MONSTER_BODY_GEOMETRY} from '../shared/monster-geometry.js';
import {avatarFootprint,avatarFitsFloor,avatarTouchesObject,avatarPositionIsClear,avatarRenderPoint} from '../shared/avatar-boundary.js';
import {advance,isFree,arrivePosition} from '../server/world.js';
import {STATIC_MAPS} from '../shared/config.js';
import {LV2_MONSTER_ART} from '../client/lv2-monster-art.js';
import {SUN_MONSTER_ART} from '../client/sun-monster-art.js';
import {CELESTIAL_MONSTER_ART} from '../client/celestial-monster-art.js';

const player=()=>({id:'p',connected:true,role:'student',mapId:'star-origin-1',x:600,y:450,avatar:{level:2},input:{x:0,y:0,at:0}});
const fixture=()=>{
  const p=player(),m={id:'m',typeId:'star-crab',mapId:p.mapId,x:600,y:450,radius:24,hp:50,facingX:1};
  return {p,m,room:{players:new Map([[p.id,p]]),planets:new Map(),monsters:new Map([[m.id,m]]),unattended:true}};
};
test('14종 몸체 가로폭은 투명 셀보다 좁고 기존 발벽보다 넓으며 세로 40% 확장',()=>{
  for(const type of MONSTER_TYPES){
    const m={...type,typeId:type.id,x:500,y:500,radius:100,facingX:1},art=MONSTER_BODY_GEOMETRY[type.id];
    assert.ok(art,type.id);const wall=monsterFootprint(m);
    assert.ok(wall.rx>55,type.id);assert.ok(wall.rx*2<art.width*100*monsterVisualScale(m.mapId,type.id),type.id);
    assert.equal(wall.y,580);assert.ok(Math.abs(wall.ry-20*1.4)<1e-9);
    const flipped=monsterFootprint({...m,facingX:-1});assert.ok(Math.abs(flipped.left-(1000-wall.right))<1e-9);
  }
});
test('공유 몸체 메타데이터가 실제 렌더러의 crop anchor와 배율을 따른다',()=>{
  for(const [id,art] of Object.entries({...LV2_MONSTER_ART,...SUN_MONSTER_ART,...CELESTIAL_MONSTER_ART})){
    const body=MONSTER_BODY_GEOMETRY[id];
    assert.equal(body.anchorX,art.frames[0][4]*body.sourceWidth/640,id);
    assert.equal(body.width,LV2_MONSTER_ART[id]?3.6:3*(art.visualScale??art.scale??1),id);
  }
});
test('머리 겹침은 허용하지만 허리부터 발끝의 벽·원형 물체 접촉은 막는다',()=>{
  const p=player(),map={id:'test-room',width:1000,height:1000,objects:[]};
  assert.equal(avatarFitsFloor(map,500,0,p),true,'머리는 바깥이어도 허리가 경계에 접함');
  assert.equal(avatarFitsFloor(map,500,-.01,p),false,'허리가 경계를 넘어감');
  assert.equal(avatarFitsFloor(map,500,960,p),true,'발끝이 하단 경계에 접함');
  assert.equal(avatarFitsFloor(map,500,960.01,p),false);
  const object={x:500,y:500,radius:20};
  assert.equal(avatarTouchesObject(p,500,525,object),false,'머리만 물체에 겹침');
  assert.equal(avatarTouchesObject(p,500,515,object),true,'허리가 물체에 겹침');
  assert.equal(avatarTouchesObject(p,500,450,object),true,'발끝이 물체에 겹침');
  assert.equal(avatarTouchesObject(p,500,440,object),false,'발끝이 테두리에 접함');
});
test('양쪽 그림 끝과 확장된 발벽은 차단하고 테두리 밖·뒤쪽·사망·다른 맵은 통과',()=>{
  const {p,m,room}=fixture(),wall=monsterFootprint(m),foot=avatarFootprint(p);
  const y=wall.y-foot.offsetY;
  for(const side of [-1,1]){
    const edge=side<0?wall.left:wall.right;
    assert.equal(isFree(room,edge+side*(foot.radius-.01),y,p.id,p.mapId,true,p),false);
    assert.equal(isFree(room,edge+side*(foot.radius+.01),y,p.id,p.mapId,true,p),true);
  }
  assert.equal(isFree(room,wall.x,wall.y-wall.ry-foot.radius+.01-foot.offsetY,p.id,p.mapId,true,p),false);
  assert.equal(isFree(room,wall.x,wall.y-wall.ry-foot.radius-.01-foot.offsetY,p.id,p.mapId,true,p),true);
  assert.equal(isFree(room,m.x,m.y-60,p.id,p.mapId,true,p),true,'뒤쪽 가림 공간 유지');
  m.hp=0;assert.equal(isFree(room,wall.x,y,p.id,p.mapId,true,p),true);
  m.hp=50;m.mapId='other';assert.equal(isFree(room,wall.x,y,p.id,p.mapId,true,p),true);
});
test('서버 연속 이동은 넓어진 그림 끝에서 멈추고 겹친 플레이어는 탈출한다',()=>{
  const {p,m,room}=fixture(),wall=monsterFootprint(m),foot=avatarFootprint(p);
  p.x=wall.left-foot.radius-60;p.y=wall.y-foot.offsetY;
  for(let i=0;i<50;i++){p.input={x:1,y:0,at:i*50};advance(room,i*50);}
  assert.ok(p.x<=wall.left-foot.radius+1e-9);assert.ok(p.x>wall.left-foot.radius-12);
  p.x=wall.x;
  assert.equal(isFree(room,p.x+5,p.y,p.id,p.mapId,false,p),true);
  assert.equal(isFree(room,p.x,p.y,p.id,p.mapId,false,p),false);
  const arrival=arrivePosition(room,p.mapId,{x:wall.x,y:p.y},p);
  assert.ok(isFree(room,arrival.x,arrival.y,p.id,p.mapId,true,p));
});
test('클라이언트 보간과 서버 판정은 같은 하반신/물체/몬스터 경계를 사용한다',()=>{
  const {p,m,room}=fixture(),map=STATIC_MAPS[p.mapId],safe={x:600,y:350};Object.assign(p,safe);
  for(let x=500;x<=700;x+=10)for(let y=380;y<=540;y+=10){
    const point={x,y},allowed=isFree(room,x,y,p.id,p.mapId,false,p);
    assert.equal(avatarPositionIsClear(map,x,y,p,[m],p),allowed);
    assert.equal(avatarRenderPoint(map,point,safe,p,[m]),allowed?point:safe);
  }
  const objectMap={id:'test-room',width:1000,height:1000,objects:[{x:500,y:500,radius:20}]};
  assert.equal(avatarRenderPoint(objectMap,{x:500,y:515},safe,p),safe);
  const overHead={x:500,y:525};assert.equal(avatarRenderPoint(objectMap,overHead,safe,p),overHead);
});
test('하반신 크기 변경으로 오브젝트 안에 걸려도 바깥으로 탈출 가능하고 진입은 금지',()=>{
  const p=player(),map={id:'test-room',width:1000,height:1000,objects:[{x:500,y:500,radius:30}]};
  Object.assign(p,{mapId:map.id,x:500,y:450});
  assert.equal(avatarPositionIsClear(map,500,445,p,[],p),true);
  assert.equal(avatarPositionIsClear(map,500,455,p,[],p),false);
  assert.equal(avatarPositionIsClear(map,500,450,p),false,'입장 배치에서는 겹침 허용 안함');
  const point={x:500,y:445};assert.equal(avatarRenderPoint(map,point,p,p),point);
});
test('작은 LV1 하반신도 31px 이동 틱으로 얇은 몬스터 발벽을 관통하지 않는다',()=>{
  const {p,m,room}=fixture();p.avatar.level=1;
  const wall=monsterFootprint(m),foot=avatarFootprint(p);
  p.x=wall.x;p.y=wall.y-wall.ry-foot.radius-foot.offsetY-1;
  const before=p.y;p.input={x:0,y:1,at:1000};advance(room,1000);
  assert.equal(p.y,before);
});
