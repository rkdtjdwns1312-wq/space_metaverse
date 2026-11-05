import test from 'node:test';
import assert from 'node:assert/strict';
import {mapOf} from '../shared/config.js';
import {FORGOTTEN_CONSTELLATION as spec} from '../shared/forgotten-constellation.js';
import {onOriginFloor} from '../shared/origin-floor.js';
import {avatarPositionIsClear} from '../shared/avatar-boundary.js';
import {monstersOf,moveMonsters,damageMonster,monsterViews} from '../server/monsters.js';
import {tryConstellationLinks,tickConstellationLinks,linkConstellationStar} from '../server/forgotten-constellation-links.js';
import {ensureVitals} from '../server/vitals.js';
import {chargeHuntingStation} from '../server/hunting-time.js';
import {readingFixture,call,ok} from './helpers/reading-fixture.js';

const map=mapOf(spec.mapId),start=Date.parse('2026-11-05T10:00:00+09:00'),center={x:map.width/2,y:map.height/2};
const actor=(id,role='student')=>({id,role,connected:true,mapId:map.id,avatar:{level:3},...center});
function create(){
 const p=actor('p'),q=actor('q'),room={players:new Map([[p.id,p],[q.id,q]]),planets:new Map(),forgottenConstellation:{state:'active',monsterId:spec.monsterId,respawnAt:null}};
 const boss=monstersOf(room,start).get(spec.monsterId);room.monsters=new Map([[boss.id,boss]]);
 return {p,q,room,boss};
}

test('AI starts five reachable stars, uses 10 MP once per 40s, and continues while stunned',()=>{
 const {p,room,boss}=create();damageMonster(room,boss,p,1,start);moveMonsters(room,start+160,()=>0);
 const cast=boss.links;assert(cast);assert.equal(cast.endsAt,start+160+20000);assert.equal(boss.mp,90);assert.equal(cast.stars.length,5);
 assert.deepEqual(cast.stars.map(s=>s.number),[1,2,3,4,5]);const activeMap={...map,objects:map.objects.filter(o=>o.id!==spec.statueId)};
 for(const s of cast.stars){
  assert(onOriginFloor(map,s.x,s.y,80));assert(avatarPositionIsClear(activeMap,s.x,s.y,p,[boss]));assert(!cast.stars.some(o=>s!==o&&Math.hypot(o.x-s.x,o.y-s.y)<110));
 }
 assert.equal(monsterViews(room,start+160).find(m=>m.id===boss.id).constellationLinks.id,cast.id);
 boss.stunUntil=start+30000;assert.deepEqual(moveMonsters(room,cast.endsAt-1),[]);assert(boss.links);
 const hits=moveMonsters(room,cast.endsAt);assert.equal(hits.length,2);assert.equal(boss.links,null);
 ensureVitals(p).hp=100;assert(!tryConstellationLinks(room,boss,start+40159,()=>0));assert(tryConstellationLinks(room,boss,start+40160,()=>0));assert.notEqual(cast.id,boss.links.id);
 damageMonster(room,boss,p,50000,start+40500);assert.equal(boss.links,null);
});

test('timeout defeats protected students too, excluding ghosts, other maps and noncombat teachers',()=>{
 const {room,boss,p,q}=create(),teacher=actor('teacher','teacher'),combatTeacher=actor('combat','teacher'),ghost=actor('ghost'),preview=actor('preview','teacher'),away=actor('away'),dead=actor('dead');
 for(const a of [teacher,combatTeacher,ghost,preview,away,dead])room.players.set(a.id,a);
 q.mapId='space-plaza';ghost.avatar.blackStar=true;preview.avatar.teacherPreview=true;away.connected=false;ensureVitals(dead).hp=0;
 p.avatar.constellationId='libra';p.libraAura={mapId:p.mapId,endsAt:start+60000,size:40,radius:200};p.taurusImmuneUntil=start+60000;
 boss.teacherRetaliation=new Set([combatTeacher.id]);assert(tryConstellationLinks(room,boss,start,()=>0));const until=boss.links.endsAt;
 const late=actor('late');room.players.set(late.id,late);
 assert.deepEqual(new Set(tickConstellationLinks(room,boss,until).map(h=>h.targetId)),new Set([p.id,combatTeacher.id,late.id]));assert.equal(ensureVitals(p).hp,0);assert.equal(ensureVitals(p).defeatedAt,until);assert(ensureVitals(q).hp>0);assert.deepEqual(tickConstellationLinks(room,boss,until+1),[]);
});
test('empty map cancels the run and stale ids cannot affect a later cast',()=>{
 const {room,boss,p,q}=create();assert(tryConstellationLinks(room,boss,start,()=>0));const old=boss.links.id;
 p.mapId=q.mapId='space-plaza';assert.deepEqual(tickConstellationLinks(room,boss,start+1),[]);assert.equal(boss.links,null);
 p.mapId=q.mapId=map.id;assert(tryConstellationLinks(room,boss,start+40000,()=>0));
 assert.throws(()=>linkConstellationStar(room,p,{castId:old,number:1},start+40010));assert.equal(boss.links.linked,0);
 boss.mapId='space-plaza';tickConstellationLinks(room,boss,start+40010);assert.equal(boss.links,null);
});
test('two sockets share ordered progress, reject forged/stale/far checks, survive reconnect and finish only once',async t=>{
 const f=await readingFixture(t),guest=await f.connect();
 for(const p of [f.p,f.q]){chargeHuntingStation(p,'math',f.now);Object.assign(p,{mapId:spec.mapId,...center});}
 f.room.forgottenConstellation={state:'active',monsterId:spec.monsterId,respawnAt:null};
 const boss=monstersOf(f.room,f.now).get(spec.monsterId);assert(tryConstellationLinks(f.room,boss,f.now,()=>0));
 const cast=boss.links,{stars}=cast,send=(s,n,id=cast.id)=>call(s,'forgotten-constellation:link',{number:n,castId:id});
 assert.equal((await send(guest,1)).ok,false);assert.equal((await send(f.student,1)).ok,false);
 Object.assign(f.p,{x:stars[1].x,y:stars[1].y});assert.equal(ok(await send(f.student,2)).linked,0);assert.match(ok(await send(f.student,2)).message,/1개/);
 Object.assign(f.p,{x:stars[0].x,y:stars[0].y});Object.assign(f.q,{x:stars[0].x,y:stars[0].y});const first=await Promise.all([send(f.student,1),send(f.other,1)]);first.forEach(result=>assert.equal(ok(result).linked,1));assert.equal(cast.linked,1);
 await f.reconnect();assert.equal(boss.links.id,cast.id);assert.equal(cast.linked,1);
 Object.assign(f.p,{mapId:spec.mapId,x:stars[1].x,y:stars[1].y});assert.equal((await send(f.student,2,'stale')).ok,false);ok(await send(f.student,2));
 for(const n of [3,4,5]){Object.assign(f.q,{x:stars[n-1].x,y:stars[n-1].y});assert.equal(ok(await send(f.other,n)).linked,n);}
 assert.equal(boss.links,null);assert.equal((await send(f.other,5)).ok,false);assert(ensureVitals(f.p).hp>0);
});
