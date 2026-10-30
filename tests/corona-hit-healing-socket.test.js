import test from 'node:test';
import assert from 'node:assert/strict';
import {readingFixture,call,ok} from './helpers/reading-fixture.js';
import {monstersOf} from '../server/monsters.js';
import {ensureVitals} from '../server/vitals.js';
import {chargeHuntingStation} from '../server/hunting-time.js';
test('왕관 Q 회복과 지연 낙검 회복이 실제 접속의 HP 알림으로 전달된다',async t=>{
 const f=await readingFixture(t);f.advance(Date.now()-f.now);Object.assign(f.p.avatar,{level:4,constellationId:'corona-borealis'});chargeHuntingStation(f.p,'math',f.now);
 const monster=monstersOf(f.room,f.now).get('star-crab');f.room.monsters=new Map([[monster.id,monster]]);
 Object.assign(monster,{x:750,y:500,hp:1000,maxHp:1000,nextAttackAt:Infinity,nextDirectionAt:Infinity,dx:0,dy:0,lastMoveAt:f.now});
 Object.assign(f.p,{mapId:monster.mapId,x:650,y:500,facing:{x:1,y:0},input:{x:0,y:0,at:0}});ensureVitals(f.p).hp=1;
 ok(await call(f.student,'combat:skill'));const q=ok(await call(f.student,'combat:attack'));assert.equal(q.vitals.hp.current,5);
 const updated=new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(new Error('낙검 회복 HP 알림 없음 '+JSON.stringify({hp:f.p.battleVitals,map:f.p.mapId,aura:f.p.coronaAura,falls:[...f.room.coronaFalls.values()]}))),2500);const listener=data=>{if(data.playerId===f.p.id&&data.vitals.hp.current===9){clearTimeout(timer);f.student.off('combat:vitals',listener);resolve(data);}};f.student.on('combat:vitals',listener);});
 const message=await updated;assert.equal(message.vitals.hp.current,9);assert.equal(ensureVitals(f.p).hp,9);
});
