import test from 'node:test';
import assert from 'node:assert/strict';
import {monstersOf,damageMonster} from '../server/monsters.js';
import {ensureDailyMissions,settleDailyHunt,validateDailyMissions} from '../server/daily-missions.js';
import {missionViews,claimMission} from '../server/missions.js';
import {castOphiuchus,advanceOphiuchusVenoms} from '../server/ophiuchus-skills.js';
import {readingFixture,call,ok} from './helpers/reading-fixture.js';
const day=Date.parse('2026-11-10T12:00:00+09:00');
const actor=(id,level=2)=>({id,role:'student',connected:true,mapId:'star-origin-1',x:500,y:500,avatar:{level,constellationId:'ophiuchus'},inventory:[],equipmentSlots:[]});
function setup(){const p=actor('p'),q=actor('q'),room={players:new Map([[p.id,p],[q.id,q]]),planets:new Map(),missions:[]};monstersOf(room,day);room.monsters.clear();ensureDailyMissions(room,day);return {room,p,q};}
const hunt=room=>room.dailyMissions.instances.find(m=>m.templateId==='builtin-hunt');
let sequence=0;
function target(room,typeId='star-crab',hp=10){const monster={id:'hunt-'+(++sequence),typeId,mapId:'star-origin-1',level:1,x:570,y:500,hp,maxHp:hp,radius:24,contributors:new Map(),attackers:new Map(),attackOrder:0,nextAttackAt:0,summonerId:'test',stunUntil:day+1e12,lastMoveAt:day};room.monsters.set(monster.id,monster);return monster;}
function kill(room,p,now=day,typeId='star-crab'){const m=target(room,typeId);damageMonster(room,m,p,10000,now);return m;}
const waitFor=async check=>{for(let i=0;i<100&&!check();i++)await new Promise(r=>setTimeout(r,20));assert(check(),'server tick did not settle');};

test('two built-in dailies enroll without old kill credit and ten qualifying deaths complete once',()=>{
 const {room,p,q}=setup();p.serenaProgress={highestLevel:5,bossKills:['leoon']};
 assert.equal(room.dailyMissions.instances.length,2);assert.equal(hunt(room).progress[p.id]||0,0);
 assert.equal(missionViews(room,p,day).find(m=>m.templateId==='builtin-hunt').repeatStopped,false);
 kill(room,p,day,'warm-star');settleDailyHunt(room,day);assert.equal(hunt(room).progress[p.id]||0,0,'Lv3 excluded for Lv2');
 for(let i=0;i<9;i++){const m=kill(room,p);assert.equal(damageMonster(room,m,p,10000,day),null);}
 settleDailyHunt(room,day);assert.equal(hunt(room).progress[p.id],9);assert.throws(()=>claimMission(room,p,hunt(room).id,day));
 kill(room,p,day,'baby-energy-star');settleDailyHunt(room,day);assert.equal(hunt(room).progress[p.id],10);assert(hunt(room).completedIds.includes(p.id));
 kill(room,p);settleDailyHunt(room,day);assert.equal(hunt(room).progress[p.id],10);assert.equal(hunt(room).progress[q.id]||0,0);validateDailyMissions(room.dailyMissions);
});

test('actual damage contributors share credit, teachers and underlevel peers do not, level is captured at death',()=>{
 const {room,p,q}=setup(),teacher={...actor('teacher',5),role:'teacher'};room.players.set(teacher.id,teacher);q.avatar.level=1;
 const m=target(room,'baby-energy-star',100);damageMonster(room,m,p,10,day);damageMonster(room,m,q,10,day);damageMonster(room,m,teacher,1000,day);
 p.avatar.level=1;p.connected=false;settleDailyHunt(room,day);
 assert.equal(hunt(room).progress[p.id],1);assert.equal(hunt(room).progress[q.id]||0,0);assert(!hunt(room).acceptedIds.includes(teacher.id));
 p.connected=true;p.avatar.level=q.avatar.level=2;const second=target(room,'star-crab',100);damageMonster(room,second,p,10,day);damageMonster(room,second,q,1000,day);settleDailyHunt(room,day);
 assert.equal(hunt(room).progress[p.id],2);assert.equal(hunt(room).progress[q.id],1);
});

test('delayed poison skill deaths use the common hunt hook and a boss death also counts',()=>{
 const {room,p}=setup();const m=target(room,'star-crab',1);castOphiuchus(room,p,day);advanceOphiuchusVenoms(room,day+2000);assert.equal(m.hp,0);settleDailyHunt(room,day+2000);assert.equal(hunt(room).progress[p.id],1);
 const boss=target(room,'noksera',1);room.persistBossDefeats=true;damageMonster(room,boss,p,1000,day+3000);assert(room.pendingBossDeaths.has(boss.id));settleDailyHunt(room,day+3000);assert.equal(hunt(room).progress[p.id],2);
});

test('Korean midnight resets progress and stale pending deaths cannot count in the new day',()=>{
 const {room,p}=setup();kill(room,p);settleDailyHunt(room,day);const old=hunt(room).id;kill(room,p);
 ensureDailyMissions(room,day+86400000);settleDailyHunt(room,day+86400000);assert.notEqual(hunt(room).id,old);assert.equal(hunt(room).progress[p.id]||0,0);
 kill(room,p,day+86400000);settleDailyHunt(room,day+86400000);assert.equal(hunt(room).progress[p.id],1);
});

test('actual tick persists nine kills across reconnect/restart, then grants exactly one crumb for the tenth',async t=>{
 const f=await readingFixture(t);f.advance(-3600000);f.mutate(p=>{p.avatar.level=2;});
 for(let i=0;i<9;i++)kill(f.room,f.p,f.now);await waitFor(()=>hunt(f.room).progress[f.p.id]===9);
 await f.reconnect();assert.equal(hunt(f.room).progress[f.p.id],9);await f.restart();assert.equal(hunt(f.room).progress[f.p.id],9);
 kill(f.room,f.p,f.now);await waitFor(()=>hunt(f.room).completedIds.includes(f.p.id));const id=hunt(f.room).id;
 const claims=await Promise.all([call(f.student,'mission:claim',{missionId:id}),call(f.student,'mission:claim',{missionId:id})]);assert.equal(claims.filter(r=>r.ok).length,1);assert.equal(f.p.inventory.find(i=>i.id==='star-crumb').quantity,1);
 assert.equal((await call(f.teacher,'mission:repeat:stop',{templateId:'builtin-hunt'})).ok,false);
 await f.restart();assert.equal(hunt(f.room).progress[f.p.id],10);assert(hunt(f.room).claimedIds.includes(f.p.id));assert.equal((await call(f.student,'mission:claim',{missionId:id})).ok,false);
 f.advance(86400000);ok(await call(f.teacher,'mission:board:read'));assert.equal(hunt(f.room).progress[f.p.id]||0,0);assert(f.p.dailyMissionHistory.some(m=>m.templateId==='builtin-hunt'));
});

test('failed hunt progress save retains its pending queue for retry; failed claim restores the reward',async t=>{
 const f=await readingFixture(t);f.advance(-3600000);f.mutate(p=>{p.avatar.level=2;});
 await f.fail(async()=>{kill(f.room,f.p,f.now);await waitFor(()=>f.room.bossSaveRetryAt>f.now);});
 assert.equal(hunt(f.room).progress[f.p.id]||0,0);assert.equal(f.room.pendingHuntProgress.size,1);
 f.advance(1000);await waitFor(()=>hunt(f.room).progress[f.p.id]===1);assert.equal(f.room.pendingHuntProgress.size,0);
 for(let i=0;i<9;i++)kill(f.room,f.p,f.now);await waitFor(()=>hunt(f.room).completedIds.includes(f.p.id));const id=hunt(f.room).id;
 await f.fail(async()=>assert.equal((await call(f.student,'mission:claim',{missionId:id})).ok,false));assert(!hunt(f.room).claimedIds.includes(f.p.id));assert(!f.p.inventory.some(i=>i.id==='star-crumb'));
 ok(await call(f.student,'mission:claim',{missionId:id}));assert.equal(f.p.inventory.find(i=>i.id==='star-crumb').quantity,1);
});
