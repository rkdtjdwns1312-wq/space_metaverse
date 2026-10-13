import test from 'node:test';
import assert from 'node:assert/strict';
import {readingFixture,call,ok} from './helpers/reading-fixture.js';
import {castTeacherSkill} from '../server/teacher-skill.js';
import {ensureVitals} from '../server/vitals.js';
import {monstersOf,moveMonsters,selectMonsterTarget,damageMonster} from '../server/monsters.js';
import {attackGeometryOf} from '../shared/combat.js';

test('teacher E deals one actual HP without attack events, mana cost or stat modifiers; preview and Q retain skills',async t=>{
 const f=await readingFixture(t),p=f.teacherPlayer,q=f.p;
 Object.assign(p,{x:700,y:600,facing:{x:1,y:0}});
 const geometry=attackGeometryOf(p);
 Object.assign(q,{mapId:p.mapId,x:p.x+geometry.reach,y:p.y});q.avatar.level=4;q.avatar.constellationId='hercules';
 ensureVitals(q);ensureVitals(p).mp=0;
 // Socket actions use the fixture clock; background effect cleanup uses wall time.
 const effectEndsAt=Math.max(Date.now(),f.now)+10000;
 Object.assign(q,{taurusImmuneUntil:effectEndsAt,libraAura:{endsAt:effectEndsAt,mapId:p.mapId},herculesShield:{endsAt:effectEndsAt,hp:100,absorbed:0}});
 const before=ensureVitals(q).hp,events=[];
 for(const event of ['combat:hit','combat:player-hit','combat:damage-numbers'])f.student.on(event,()=>events.push(event));
 const r=ok(await call(f.teacher,'combat:skill',{slot:0,power:99999,damage:100}));
 assert.equal(r.cooldownMs,450);assert.equal(ensureVitals(q).hp,before-1);assert.equal(ensureVitals(p).mp,0);
 assert.equal(q.herculesShield.hp,100);assert.equal(q.damageNumbers?.length||0,0);
 assert.equal((await call(f.teacher,'combat:skill')).ok,false);f.advance(449);assert.equal((await call(f.teacher,'combat:skill')).ok,false);
 f.advance(1);ok(await call(f.teacher,'combat:skill'));assert.equal(ensureVitals(q).hp,before-2);
 await new Promise(r=>setTimeout(r,70));assert.deepEqual(events,[]);
 delete q.taurusImmuneUntil;delete q.libraAura;delete q.herculesShield;
 f.advance(450);ok(await call(f.teacher,'combat:attack'));assert.equal(ensureVitals(q).hp,0,'Q retains its existing teacher power');
 Object.assign(p.avatar,{teacherPreview:true,level:4,constellationId:'aquarius'});ensureVitals(p).mp=999;
 f.advance(1000);const preview=ok(await call(f.teacher,'combat:skill'));assert(preview.vitals);assert(ensureVitals(p).mp<999,'preview uses constellation mana');
});

test('teacher fixed silent damage retains monster aggro, contribution, death drops and player defeat lifecycle',()=>{
 const now=1000000,p={id:'teacher',role:'teacher',connected:true,avatar:{level:6},x:500,y:500,facing:{x:1,y:0}},room={players:new Map([[p.id,p]])};
 const m=[...monstersOf(room,now).values()].find(m=>m.typeId==='star-scorpion');
 p.mapId=m.mapId;const geometry=attackGeometryOf(p);
 Object.assign(m,{x:p.x+geometry.reach,y:p.y,hp:2,sleepUntil:now+10000});room.monsters=new Map([[m.id,m]]);
 let r=castTeacherSkill(room,p,now);assert.equal(r.targets[0].damage,1);assert.equal(m.hp,1);assert.equal(m.contributors.get(p.id),1);assert.equal(m.attackers.has(p.id),true);assert.equal(m.targetId,p.id);
 assert.equal(room.damageNumbers?.length||0,0);
 r=castTeacherSkill(room,p,now+450);assert.equal(m.hp,0);assert.equal(r.targets[0].defeated,true);assert(m.respawnAt>now);assert.equal(m.attackers.size,0);assert.equal(m.teacherRetaliation.size,0);
 assert(room.energyDrops.size>0);assert([...room.energyDrops.values()].some(d=>d.shares.has(p.id)));
 const q={id:'student',role:'student',connected:true,avatar:{level:2,constellationId:'hercules'},mapId:p.mapId,x:m.x,y:m.y};room.players.set(q.id,q);
 ensureVitals(q).hp=1;castTeacherSkill(room,p,now+900);assert.equal(ensureVitals(q).hp,0);assert.equal(ensureVitals(q).defeatedAt,now+900);
 p.avatar.teacherPreview=true;assert.throws(()=>castTeacherSkill(room,p,now+1350));
});

function retaliationFixture(typeId='star-scorpion'){
 const now=1000000,p={id:'teacher',role:'teacher',connected:true,avatar:{level:6},x:700,y:600,facing:{x:1,y:0}},room={players:new Map([[p.id,p]])};
 const m=[...monstersOf(room,now).values()].find(m=>m.typeId===typeId);
 p.mapId=m.mapId;Object.assign(m,{x:p.x+attackGeometryOf(p).reach,y:p.y});room.monsters=new Map([[m.id,m]]);
 return {now,p,room,m};
}

test('actual teacher E socket registers retaliation; AI pursues, attacks immune teacher on cooldown and later damages HP999',async t=>{
 const f=await readingFixture(t),p=f.teacherPlayer;
 const m=[...monstersOf(f.room,f.now).values()].find(m=>m.typeId==='star-scorpion');
 Object.assign(p,{mapId:m.mapId,x:700,y:600,facing:{x:1,y:0}});
 Object.assign(m,{x:p.x+attackGeometryOf(p).reach,y:p.y});f.room.monsters=new Map([[m.id,m]]);
 assert.equal(ensureVitals(p).hp,999);
 const before=m.hp,result=ok(await call(f.teacher,'combat:skill'));
 assert.equal(result.targets[0].damage,1);assert.equal(m.hp,before-1);assert.equal(m.targetId,p.id);
 p.x-=220;const start=m.x;moveMonsters(f.room,f.now+100,()=>0);
 assert(m.moving);assert(m.x<start,'monster follows the teacher outside attack range');assert.equal(m.hp,before-1,'aggro selection does not heal the E hit');
 p.x=m.x-75;p.taurusImmuneUntil=f.now+2000;
 const immune=moveMonsters(f.room,f.now+200,()=>0);
 assert.equal(immune.length,1);assert.equal(immune[0].targetId,p.id);assert.equal(immune[0].immune,true);assert.equal(ensureVitals(p).hp,999);
 assert(m.nextAttackAt>f.now+200);assert.deepEqual(moveMonsters(f.room,f.now+201,()=>0),[],'immune hit must still consume the attack interval');
 delete p.taurusImmuneUntil;
 const hit=moveMonsters(f.room,m.nextAttackAt,()=>0);
 assert.equal(hit.length,1);assert.equal(hit[0].targetId,p.id);assert.equal(hit[0].damage,3);assert.equal(ensureVitals(p).hp,996);
});

test('teacher E retaliation covers warned boss hits without hitting uninvolved teachers',()=>{
 const {now,p,room,m}=retaliationFixture('spirit-king');
 const other={...p,id:'observer',avatar:{level:6}};room.players.set(other.id,other);
 castTeacherSkill(room,p,now);assert.equal(m.hp,m.maxHp-1);
 moveMonsters(room,now+200,()=>0);assert(m.pendingAttack);assert.equal(m.targetId,p.id);
 const hits=moveMonsters(room,m.pendingAttack.endsAt,()=>0);
 assert.deepEqual(hits.map(h=>h.targetId),[p.id]);assert.equal(hits[0].damage,27);
 assert.equal(ensureVitals(p).hp,972);assert.equal(ensureVitals(other).hp,999);
});

test('teacher retaliation ends on disconnect, away, map exit, defeat or preview; Q alone does not opt in',()=>{
 for(const leave of [p=>p.connected=false,p=>p.away=true,p=>p.mapId='space-plaza',p=>ensureVitals(p).hp=0,p=>p.avatar.teacherPreview=true]){
  const {now,p,room,m}=retaliationFixture();castTeacherSkill(room,p,now);leave(p);
  assert.equal(selectMonsterTarget(room,m),null);assert.equal(m.attackers.size,0);assert.equal(m.teacherRetaliation.size,0);assert.equal(m.hp,m.maxHp);
  Object.assign(p,{connected:true,away:false,mapId:m.mapId});p.avatar.teacherPreview=false;ensureVitals(p).hp=999;
  assert.equal(selectMonsterTarget(room,m),null,'returning must not restore old aggression');
 }
 const {now,p,room,m}=retaliationFixture();
 damageMonster(room,m,p,1,now);assert.equal(m.targetId,null);assert.equal(m.hp,m.maxHp-1,'non-E teacher damage remains applied');
 p.avatar.teacherPreview=true;damageMonster(room,m,p,1,now+100,{retaliateTeacher:true});assert.equal(m.targetId,null);
});
