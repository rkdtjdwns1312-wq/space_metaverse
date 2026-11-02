import test from 'node:test';
import assert from 'node:assert/strict';
import {readingFixture,call,ok} from './helpers/reading-fixture.js';
import {castTeacherSkill,castTeacherAttack} from '../server/teacher-skill.js';
import {ensureVitals} from '../server/vitals.js';
import {monstersOf,moveMonsters,selectMonsterTarget,damageMonster} from '../server/monsters.js';
import {combatEnemies,damageTargets} from '../server/sagittarius-skills.js';
import {advanceProjectiles} from '../server/projectiles.js';
import {monsterType,MONSTER_LEVEL_STATS} from '../shared/monsters.js';
const NOW=1000000;
const loss=m=>100-(monsterType(m.typeId)?.defense??MONSTER_LEVEL_STATS[monsterType(m.typeId)?.level]?.defense??0);
function fixture(typeId='star-scorpion'){
 const p={id:'teacher',role:'teacher',connected:true,avatar:{level:6},x:700,y:600,facing:{x:1,y:0}},room={players:new Map([[p.id,p]])};
 const m=[...monstersOf(room,NOW).values()].find(m=>m.typeId===typeId);
 p.mapId=m.mapId;Object.assign(m,{x:850,y:600,hp:500,maxHp:500});room.monsters=new Map([[m.id,m]]);
 return {p,room,m};
}
function peer(room,p,id,extra={}){const q={id,role:'student',connected:true,avatar:{level:4,constellationId:'hercules'},mapId:p.mapId,x:9999,y:9999,...extra};room.players.set(id,q);ensureVitals(q).hp=1;return q;}

test('teacher E heals the entire same map including self, caps HP, costs 10 MP, and damages only same-map monsters',()=>{
 const {room,p,m}=fixture(),far={...m,id:'far',x:9999,y:9999,attackers:new Map(),contributors:new Map()},other={...m,id:'other-map',mapId:'space-plaza',attackers:new Map(),contributors:new Map()};room.monsters.set(far.id,far);room.monsters.set(other.id,other);
 const q=peer(room,p,'near'),farPlayer=peer(room,p,'far',{x:-9999,y:-9999}),otherPlayer=peer(room,p,'other',{mapId:'space-plaza'}),away=peer(room,p,'away',{away:true}),offline=peer(room,p,'offline',{connected:false}),black=peer(room,p,'black',{avatar:{level:4,constellationId:'hercules',blackStar:true}}),dead=peer(room,p,'dead');ensureVitals(dead).hp=0;
 ensureVitals(p).hp=700;const result=castTeacherSkill(room,p,NOW);
 assert.equal(ensureVitals(p).hp,800);assert.equal(ensureVitals(p).mp,990);assert.equal(result.cooldownMs,1000);assert.equal(result.cooldowns[0],NOW+1000);
 assert.equal(ensureVitals(q).hp,90);assert.equal(ensureVitals(farPlayer).hp,90);assert.equal(ensureVitals(black).hp,90);for(const x of [otherPlayer,away,offline])assert.equal(ensureVitals(x).hp,1);assert.equal(ensureVitals(dead).hp,0);
 assert.equal(m.hp,500-loss(m));assert.equal(far.hp,500-loss(far));assert.equal(other.hp,500);assert(result.playerTargets.every(t=>!('damage'in t)));assert.equal(result.targets.length,2);
 assert.equal(m.teacherRetaliation.has(p.id),true);assert.equal(far.teacherRetaliation.has(p.id),true);
});

test('teacher E rejects insufficient mana and early requests before any changes, exact 1000ms boundary, normal restrictions remain',()=>{
 const {room,p,m}=fixture();ensureVitals(p).mp=9;assert.throws(()=>castTeacherSkill(room,p,NOW),/마나/);assert.equal(p.teacherCooldownUntil,undefined);assert.equal(m.hp,500);assert.equal(ensureVitals(p).mp,9);
 ensureVitals(p).mp=20;castTeacherSkill(room,p,NOW);const hp=m.hp;assert.throws(()=>castTeacherSkill(room,p,NOW+999));assert.equal(m.hp,hp);assert.equal(ensureVitals(p).mp,10);castTeacherSkill(room,p,NOW+1000);assert.equal(ensureVitals(p).mp,0);
 for(const mutate of [x=>x.away=true,x=>x.connected=false,x=>x.avatar.blackStar=true,x=>ensureVitals(x).hp=0,x=>x.avatar.teacherPreview=true,x=>x.role='student']){const f=fixture();mutate(f.p);assert.throws(()=>castTeacherSkill(f.room,f.p,NOW));assert.equal(f.m.hp,500);}
});

test('teacher Q launches exactly one small star, harms no players, and hits the first monster only on arrival',()=>{
 const {room,p,m}=fixture(),q=peer(room,p,'friend',{x:760,y:600}),far={...m,id:'far',x:1050,attackers:new Map(),contributors:new Map()};room.monsters.set(far.id,far);
 const result=castTeacherAttack(room,p,NOW);assert.equal(result.hit.projectiles.length,1);assert.equal(result.hit.projectiles[0].kind,'teacher-star');assert.equal(room.projectiles[0].power,100);assert.equal(m.hp,500);assert.equal(ensureVitals(q).hp,1);
 advanceProjectiles(room,NOW+100,combatEnemies,damageTargets);assert.equal(ensureVitals(q).hp,1);const hits=advanceProjectiles(room,NOW+650,combatEnemies,damageTargets);assert.equal(hits[0].targets.length,1);assert.equal(hits[0].targets[0].monsterId,m.id);assert.equal(m.hp,500-loss(m));assert.equal(far.hp,500);assert.equal(room.projectiles.length,0);assert.equal(m.teacherRetaliation?.has(p.id)||false,false);
 for(const mutate of [x=>x.mapId='elsewhere',x=>x.avatar.teacherPreview=true,x=>x.connected=false]){const f=fixture();castTeacherAttack(f.room,f.p,NOW);mutate(f.p);advanceProjectiles(f.room,NOW+650,combatEnemies,damageTargets);assert.equal(f.m.hp,500);assert.equal(f.room.projectiles.length,0);}
});

test('teacher real socket enforces cooldowns and mana, ignores forged damage/targets, publishes healing, preserves ghost and preview skills',async t=>{
 const f=await readingFixture(t),p=f.teacherPlayer,q=f.p;Object.assign(p,{x:700,y:600,facing:{x:1,y:0}});Object.assign(q,{mapId:p.mapId,x:1700,y:1400});Object.assign(q.avatar,{level:4,constellationId:'hercules'});ensureVitals(q).hp=1;ensureVitals(p).hp=700;
 const updates=[];f.teacher.on('combat:vitals',v=>updates.push(v));ok(await call(f.teacher,'teacher:ghost',{enabled:true}));
 const r=ok(await call(f.teacher,'combat:skill',{slot:0,power:99999,mana:0,cooldownMs:0,targetIds:[]}));assert.equal(r.cooldownMs,1000);assert.equal(ensureVitals(p).mp,990);assert.equal(ensureVitals(p).hp,800);assert.equal(ensureVitals(q).hp,90);assert.equal(p.teacherGhost,true);assert(!f.game.store.snapshot(f.room,q,f.now).players.some(x=>x.id===p.id));
 assert.equal((await call(f.teacher,'combat:skill')).ok,false);f.advance(999);assert.equal((await call(f.teacher,'combat:skill')).ok,false);f.advance(1);ok(await call(f.teacher,'combat:skill'));assert.equal(ensureVitals(p).mp,980);assert.equal(ensureVitals(q).hp,90);
 await new Promise(resolve=>setTimeout(resolve,70));assert(updates.some(v=>v.playerId===p.id&&v.vitals.mp.current===990));assert(updates.some(v=>v.playerId===q.id&&v.vitals.hp.current===90));
 const attack=ok(await call(f.teacher,'combat:attack',{power:99999}));assert.equal(attack.hit.projectiles.length,1);assert.equal(attack.hit.kind,'teacher-star');assert.equal((await call(f.teacher,'combat:attack')).ok,false);f.advance(1000);ok(await call(f.teacher,'combat:attack'));
 Object.assign(p.avatar,{teacherPreview:true,level:4,constellationId:'aquarius'});ensureVitals(p).mp=1000;f.advance(1000);const preview=ok(await call(f.teacher,'combat:skill'));assert(preview.vitals);assert(p.aquariusCooldownUntil>f.now);assert.equal(preview.cooldownMs,undefined);
});

test('teacher E retains monster pursuit and attacks after immunity; defense zero is applied',()=>{
 const {p,room,m}=fixture();castTeacherSkill(room,p,NOW);const hp=m.hp;p.x-=220;const x=m.x;moveMonsters(room,NOW+100,()=>0);assert(m.moving);assert(m.x<x);assert.equal(m.hp,hp);
 p.x=m.x-75;p.taurusImmuneUntil=NOW+2000;const immune=moveMonsters(room,NOW+200,()=>0);assert.equal(immune.length,1);assert.equal(immune[0].immune,true);assert.equal(ensureVitals(p).hp,1000);assert.deepEqual(moveMonsters(room,NOW+201,()=>0),[]);
 delete p.taurusImmuneUntil;const hit=moveMonsters(room,m.nextAttackAt,()=>0);assert.equal(hit.length,1);assert.equal(hit[0].damage,6);assert.equal(ensureVitals(p).hp,994);
});

test('teacher E uses normal boss pending-death persistence, while ordinary deaths keep drops and contribution',()=>{
 const f=fixture();f.m.hp=1;const hit=castTeacherSkill(f.room,f.p,NOW);assert(hit.targets[0].defeated);assert(f.room.energyDrops.size>0);assert([...f.room.energyDrops.values()].some(d=>d.shares.has(f.p.id)));assert.equal(f.m.teacherRetaliation?.size||0,0);
 const b=fixture('spirit-king');b.room.persistBossDefeats=true;b.m.hp=1;castTeacherSkill(b.room,b.p,NOW);assert.equal(b.m.hp,0);assert(b.room.pendingBossDeaths.has(b.m.id));assert.equal(b.room.pendingBossDeaths.get(b.m.id).contributors[0][0],b.p.id);
});

test('teacher E retaliation covers boss hits and ends on disconnect, away, map exit, defeat or preview; Q does not opt in',()=>{
 const f=fixture('spirit-king'),other={...f.p,id:'observer',avatar:{level:6}};f.room.players.set(other.id,other);castTeacherSkill(f.room,f.p,NOW);moveMonsters(f.room,NOW+200,()=>0);assert(f.m.pendingAttack);const hits=moveMonsters(f.room,f.m.pendingAttack.endsAt,()=>0);assert.deepEqual(hits.map(h=>h.targetId),[f.p.id]);assert.equal(hits[0].damage,30);assert.equal(ensureVitals(other).hp,1000);
 for(const leave of [p=>p.connected=false,p=>p.away=true,p=>p.mapId='space-plaza',p=>ensureVitals(p).hp=0,p=>p.avatar.teacherPreview=true]){const {p,room,m}=fixture();castTeacherSkill(room,p,NOW);leave(p);assert.equal(selectMonsterTarget(room,m),null);assert.equal(m.attackers.size,0);assert.equal(m.teacherRetaliation.size,0);assert.equal(m.hp,m.maxHp);}
 const {p,room,m}=fixture();damageMonster(room,m,p,100,NOW);assert.equal(m.targetId,null);p.avatar.teacherPreview=true;damageMonster(room,m,p,100,NOW+100,{retaliateTeacher:true});assert.equal(m.targetId,null);
});
