import test from 'node:test';
import assert from 'node:assert/strict';
import {STREET} from '../shared/config.js';
import {STREET_PARK} from '../shared/street-layout.js';
import {avatarPositionIsClear} from '../shared/avatar-boundary.js';
import {blessAtShelterFountain,STAR_GUARDIAN_MS} from '../server/shelter-fountain.js';
import {playerVitals} from '../server/vitals.js';
import {playerEffectsView} from '../server/rooms.js';

const student=()=>({role:'student',avatar:{level:2,constellationId:'aries'},connected:true,away:false,mapId:STREET.id,
  x:STREET_PARK.fountain.x,y:STREET_PARK.fountain.y+110,effects:[],inventory:[],equipmentSlots:[null,null,null]});

test('화단과 분수의 바닥 판정은 그림의 좌표에 맞고 주변 통로는 열린다',()=>{
  const p=student(),f=STREET_PARK.fountain;
  assert.equal(avatarPositionIsClear(STREET,f.x,f.y,p),false);
  assert.equal(avatarPositionIsClear(STREET,f.x,f.y+110,p),true);
  assert.equal(STREET_PARK.beds.length,4);
  assert(STREET_PARK.beds.every(b=>b.x<=f.x));
  for(const [x,y] of [[1115,1535],[1110,1920]])assert.equal(avatarPositionIsClear(STREET,x,y,p),true,'삭제된 오른쪽 화단 통과');
  for(const bed of STREET_PARK.beds){
    assert.equal(avatarPositionIsClear(STREET,bed.x,bed.y,p),false);
    assert.equal(avatarPositionIsClear(STREET,bed.x+(bed.x>850?-1:1)*(bed.rx+80),bed.y,p),true);
  }
});

test('분수대 상호작용은 5분간 최대 체력·마나 +1, 반복 시 시간만 갱신한다',()=>{
  const p=student(),now=Date.now();
  assert.equal(playerVitals(p).hp.max,20);
  const first=blessAtShelterFountain(p,now);
  assert.equal(first.until,now+STAR_GUARDIAN_MS);
  assert.equal(first.vitals.hp.max,21);assert.equal(first.vitals.mp.max,21);
  assert.equal(playerEffectsView(p,false,now).find(e=>e.statusId==='star-guardian')?.until,first.until);
  const second=blessAtShelterFountain(p,now+1000);
  assert.equal(second.vitals.hp.max,21);
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
