import test from 'node:test';
import assert from 'node:assert/strict';
import {readingFixture,call,ok} from './helpers/reading-fixture.js';
import {monstersOf} from '../server/monsters.js';
import {ensureVitals} from '../server/vitals.js';
import {attackPowerOf} from '../shared/combat.js';
import {chargeHuntingStation} from '../server/hunting-time.js';

test('왕관 E 뒤 소켓 Q는 300% 강화되고 5회 중 1회를 소모한다',async t=>{
  const f=await readingFixture(t);f.advance(Date.now()-f.now);
  Object.assign(f.p.avatar,{level:4,constellationId:'corona-borealis'});chargeHuntingStation(f.p,'math',f.now);
  const monster=monstersOf(f.room,f.now).get('star-crab');f.room.monsters=new Map([[monster.id,monster]]);
  Object.assign(monster,{x:750,y:500,hp:10000,maxHp:10000,nextAttackAt:Infinity,nextDirectionAt:Infinity,dx:0,dy:0,lastMoveAt:f.now});
  Object.assign(f.p,{mapId:monster.mapId,x:650,y:500,facing:{x:1,y:0},input:{x:0,y:0,at:0}});
  const mp=ensureVitals(f.p).mp;
  ok(await call(f.student,'combat:skill'));
  assert.equal(ensureVitals(f.p).mp,mp-5);
  const q=ok(await call(f.student,'combat:attack'));
  assert.equal(q.targets.length,1);
  assert.equal(10000-monster.hp,attackPowerOf(4,'corona-borealis',f.p)*3);
  assert.equal(f.p.coronaAura.remaining,4);
});
