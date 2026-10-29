import test from 'node:test';
import assert from 'node:assert/strict';
import {STREET,interactionDistance,interactionReach} from '../shared/config.js';
import {STREET_PARK} from '../shared/street-layout.js';
import {avatarPositionIsClear} from '../shared/avatar-boundary.js';
import {blessAtShelterFountain,STAR_GUARDIAN_MS} from '../server/shelter-fountain.js';
import {playerVitals} from '../server/vitals.js';
import {playerEffectsView} from '../server/rooms.js';

const student=()=>({role:'student',avatar:{level:2,constellationId:'aries'},connected:true,away:false,mapId:STREET.id,
  x:STREET_PARK.fountain.x,y:STREET_PARK.fountain.y+110,effects:[],inventory:[],equipmentSlots:[null,null,null]});

test('확대한 분수의 상하좌우에서 LV1~5가 충돌 밖에 서서 상호작용할 수 있다',()=>{
 const f=STREET.objects.find(o=>o.kind==='shelter-fountain');
 for(let level=1;level<=5;level++)for(const [dx,dy] of [[f.collisionRx+65,0],[-f.collisionRx-65,0],[0,f.collisionRy+75],[0,-f.collisionRy-75]]){
  const p=student();p.avatar.level=level;p.x=f.x+dx;p.y=f.y+dy;
  assert.equal(avatarPositionIsClear(STREET,p.x,p.y,p),true);
  assert.ok(interactionDistance(p,f)<=interactionReach(f));
  assert.doesNotThrow(()=>blessAtShelterFountain(p));
 }
 assert.ok(interactionDistance({x:f.x+f.collisionRx+200,y:f.y},f)>interactionReach(f));
});

test('분수는 이전 크기의 60%이며 제거한 화단 자리와 주변 통로가 열린다',()=>{
  const p=student(),f=STREET_PARK.fountain;
  assert.equal(avatarPositionIsClear(STREET,f.x,f.y,p),false);
  assert.equal(avatarPositionIsClear(STREET,f.x,f.y+200,p),true);
  assert.equal(STREET_PARK.beds.length,0);
  assert.equal(STREET.objects.some(o=>o.kind==='shelter-flowerbed'),false);
  assert.equal(f.scale,2.4);
  assert.equal(f.rx,94*2.4);assert.equal(f.ry,39*2.4);
  for(const [x,y] of [[1270,1590],[1270,1850]])assert.equal(avatarPositionIsClear(STREET,x,y,p),true,'분수 동쪽 통로');
  for(const [x,y] of [[650,1340],[300,1550],[300,1930],[650,2050]])assert.equal(avatarPositionIsClear(STREET,x,y,p),true);
});

test('분수대 상호작용은 5분간 최대 체력·마나를 10% 높이고 반복 시 중첩 없이 갱신한다',()=>{
  const p=student(),now=Date.now();
  assert.equal(playerVitals(p).hp.max,20);
  p.battleVitals.hp=10;p.battleVitals.mp=8;
  const first=blessAtShelterFountain(p,now);
  assert.equal(first.until,now+STAR_GUARDIAN_MS);
  assert.equal(first.vitals.hp.max,Math.max(21,Math.round(20*1.1)));
  assert.equal(first.vitals.mp.max,Math.max(21,Math.round(20*1.1)));
  assert.equal(first.vitals.hp.current,12);assert.equal(first.vitals.mp.current,10);
  assert.equal(playerEffectsView(p,false,now).find(e=>e.statusId==='star-guardian')?.until,first.until);
  const second=blessAtShelterFountain(p,now+1000);
  assert.equal(second.vitals.hp.max,first.vitals.hp.max);
  p.battleVitals.hp-=4;p.battleVitals.mp-=3;
  const damaged={hp:p.battleVitals.hp,mp:p.battleVitals.mp};
  const refreshed=blessAtShelterFountain(p,now+2000);
  assert.equal(p.battleVitals.hp,damaged.hp);assert.equal(p.battleVitals.mp,damaged.mp);
  assert.equal(refreshed.until,now+2000+STAR_GUARDIAN_MS);
  assert.equal(p.effects.filter(e=>e.statusId==='star-guardian').length,1);
  p.effects[0].until=Date.now()-1;
  assert.equal(playerVitals(p).hp.max,20);assert.equal(playerVitals(p).mp.max,20);
  p.mapId='space-plaza';assert.throws(()=>blessAtShelterFountain(p,Date.now()),/가까이/);
});

test('쓰러진 학생은 분수로 회복 절차를 우회할 수 없다',()=>{
  const p=student();playerVitals(p);p.battleVitals.hp=0;
  assert.throws(()=>blessAtShelterFountain(p),/쓰러진 동안/);
  assert.equal(p.battleVitals.hp,0);assert.deepEqual(p.effects,[]);
});

test('최대 체력이 작은 캐릭터도 버프를 받으면 HP·MP가 최소 1씩 늘어난다',()=>{
  const p=student();p.avatar.level=1;p.avatar.constellationId=null;
  assert.equal(playerVitals(p).hp.max,1);assert.equal(playerVitals(p).mp.max,1);
  const result=blessAtShelterFountain(p);
  assert.equal(result.vitals.hp.max,2);assert.equal(result.vitals.mp.max,2);
});
