import test from 'node:test';
import assert from 'node:assert/strict';
import {damagePlayer,ensureVitals} from '../server/vitals.js';
import {playerEffectsView} from '../server/rooms.js';
import {activeStatuses} from '../shared/statuses.js';

const makePlayer=()=>({id:'guardian',role:'student',avatar:{level:3,constellationId:'aquarius'},
  equipmentSlots:['dream-guardian-cloak',null,null],effects:[]});

test('수호는 장착 즉시 첫 타격을 막고 30초 뒤 다시 준비된다',()=>{
  const p=makePlayer(),now=100000;
  const hp=ensureVitals(p).hp;
  const ready=playerEffectsView(p,false,now);
  assert.equal(activeStatuses({...p,effects:ready},now).find(s=>s.id==='dream-guardian')?.name,'수호');
  assert.equal(damagePlayer(p,10,now,{fixedDamage:10}).guardian,true);
  assert.equal(ensureVitals(p).hp,hp);
  assert.equal(playerEffectsView(p,false,now+1).some(s=>s.statusId==='dream-guardian'),false);
  assert.equal(damagePlayer(p,10,now+1,{fixedDamage:10}).damage,10);
  assert.equal(ensureVitals(p).hp,hp-10);
  assert.equal(damagePlayer(p,5,now+29999,{fixedDamage:5}).damage,5);
  assert.equal(damagePlayer(p,5,now+30000,{fixedDamage:5}).guardian,true);
  assert.equal(playerEffectsView(p,false,now+30000).some(s=>s.statusId==='dream-guardian'),false);
});

test('장비를 잠시 벗었다 다시 입어도 수호 재사용 시간이 초기화되지 않는다',()=>{
  const p=makePlayer(),now=100000;
  assert.equal(damagePlayer(p,4,now).guardian,true);
  p.equipmentSlots=[null,null,null];
  assert.equal(playerEffectsView(p,false,now+1).some(s=>s.statusId==='dream-guardian'),false);
  p.equipmentSlots=['dream-guardian-cloak',null,null];
  assert.equal(damagePlayer(p,4,now+1,{fixedDamage:4}).damage,4);
  assert.equal(damagePlayer(p,4,now+30000,{fixedDamage:4}).guardian,true);
});
