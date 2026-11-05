import test from 'node:test';
import assert from 'node:assert/strict';
import {FORGOTTEN_CONSTELLATION as spec,forgottenConstellationMap} from '../shared/forgotten-constellation.js';
import {mapOf} from '../shared/config.js';
import {onOriginFloor} from '../shared/origin-floor.js';
import {avatarFootprint,avatarPositionIsClear} from '../shared/avatar-boundary.js';
import {monstersOf,moveMonsters,monsterViews,damageMonster} from '../server/monsters.js';
import {ensureVitals} from '../server/vitals.js';
import {tryConstellationGather,tickConstellationGather,collectConstellationGather,constellationGatherView,visibleGatherMonsters,CONSTELLATION_GATHER as rule} from '../server/forgotten-constellation-gather.js';
import {tryConstellationLinks} from '../server/forgotten-constellation-links.js';
import {tryConstellationNames} from '../server/forgotten-constellation-names.js';
import {chargeHuntingStation} from '../server/hunting-time.js';
import {readingFixture,ok,call} from './helpers/reading-fixture.js';

const start=100000,active={state:'active',monsterId:spec.monsterId,respawnAt:null};
const actor=(id,role='student')=>({id,role,connected:true,mapId:spec.mapId,avatar:{level:5},x:800,y:500});
function fixture(){
  const p=actor('p'),q=actor('q'),room={players:new Map([[p.id,p],[q.id,q]]),planets:new Map(),forgottenConstellation:{...active}};
  const boss=monstersOf(room,start).get(spec.monsterId);room.monsters=new Map([[boss.id,boss]]);
  return {p,q,room,boss};
}

test('15 distinct reachable sites include the first at t0 and every star gets 4s before the 20s deadline',()=>{
  for(const [roll,extras] of [[0,0],[.5,1],[.99,2]]){
    const {room,boss}=fixture(),map=forgottenConstellationMap(mapOf(spec.mapId),active);
    let decision=true;const random=()=>{if(decision){decision=false;return 0;}return roll;};
    assert(tryConstellationGather(room,boss,start,random));
    const cast=boss.gather;
    assert.equal(boss.mp,80);assert.equal(boss.gatherReadyAt,start+60000);assert.equal(cast.endsAt,start+20000);
    assert.equal(cast.stars.length,15);assert.equal(new Set(cast.stars.map(s=>s.x+','+s.y)).size,15);
    assert.equal(cast.stars[0].appearsAt,start);
    let long=0;
    for(const [i,s] of cast.stars.entries()){
      assert(onOriginFloor(map,s.x,s.y,80));assert(avatarPositionIsClear(map,s.x,s.y,{avatar:{level:5},transformation:{active:true}},[boss]));
      assert.equal(s.expiresAt-s.appearsAt,4000);assert(s.expiresAt<=cast.endsAt);
      if(i){const gap=s.appearsAt-cast.stars[i-1].appearsAt;assert([1000,2000].includes(gap));if(gap===2000)long++;}
    }
    assert.equal(long,extras);assert.equal(constellationGatherView(boss,start).stars.length,1);
    assert(!tryConstellationLinks(room,boss,start,()=>0));assert(!tryConstellationNames(room,boss,start,()=>0));
    boss.gather=null;assert(!tryConstellationGather(room,boss,start+59999,()=>0));
    boss.mp=19;assert(!tryConstellationGather(room,boss,start+60000,()=>0));
    boss.mp=20;assert(tryConstellationGather(room,boss,start+60000,()=>0));assert.equal(boss.mp,0);
  }
});

test('expired stars disappear without damage, including delayed ticks and pickups, while final failure remains lethal',()=>{
  const {room,boss,p,q}=fixture(),teacher=actor('teacher','teacher'),other=actor('other'),dead=actor('dead'),ghost=actor('ghost'),away=actor('away'),preview=actor('preview','teacher');
  other.mapId='space-plaza';ensureVitals(dead).hp=0;ghost.avatar.blackStar=true;away.away=true;preview.avatar.teacherPreview=true;
  for(const a of [teacher,other,dead,ghost,away,preview])room.players.set(a.id,a);
  assert(tryConstellationGather(room,boss,start,()=>0));
  const initialHp=new Map([...room.players.values()].map(a=>[a.id,ensureVitals(a).hp]));
  const cast=boss.gather,star=cast.stars[5];Object.assign(q,{x:star.x,y:star.y});
  const hits=[];const result=collectConstellationGather(room,q,{castId:cast.id,starId:star.id},start+5100,h=>hits.push(h));
  assert.equal(result.count,1);assert.deepEqual(hits,[]);
  assert(cast.stars[0].resolved);assert(cast.stars[1].resolved);
  assert(!constellationGatherView(boss,start+5100).stars.some(s=>s.id===1||s.id===2));
  for(const a of room.players.values())assert.equal(ensureVitals(a).hp,initialHp.get(a.id));
  assert.deepEqual(tickConstellationGather(room,boss,start+5100),[]);
  assert.throws(()=>collectConstellationGather(room,q,{castId:cast.id,starId:1},start+5100));
  assert.throws(()=>collectConstellationGather(room,q,{castId:cast.id,starId:15},start+5100));
  assert.deepEqual(tickConstellationGather(room,boss,cast.endsAt-1),[]);
  for(const a of room.players.values())assert.equal(ensureVitals(a).hp,initialHp.get(a.id));
  const end=tickConstellationGather(room,boss,cast.endsAt);
  assert(end.every(h=>h.skillKind==='forgotten-gather-finish'));
  assert(end.some(h=>h.targetId==='q'&&h.skillKind==='forgotten-gather-finish'&&h.defeated));
  assert.deepEqual(tickConstellationGather(room,boss,cast.endsAt+1),[]);
});

test('final matching evaluates all live footprints together for a class of 35, including zero, solos, mismatches and exact boundary',()=>{
  const {room,boss,p,q}=fixture();for(let i=0;i<33;i++){const a=actor('student-'+i);room.players.set(a.id,a);}
  assert(tryConstellationGather(room,boss,start,()=>0));const cast=boss.gather;
  for(const s of cast.stars)s.resolved=true;
  // A positive pair at the exact touch threshold survives, but a classmate just outside cannot join them.
  const range=avatarFootprint(p).radius+avatarFootprint(q).radius+rule.contactGap;
  q.x=p.x+range;cast.counts.set(p.id,1);cast.counts.set(q.id,1);
  const solo=room.players.get('student-0');solo.x=q.x+range+.01;cast.counts.set(solo.id,1);
  const different=room.players.get('student-1');cast.counts.set(different.id,2);
  const disconnected=room.players.get('student-2');disconnected.connected=false;cast.counts.set(disconnected.id,2);
  const alreadyDead=room.players.get('student-3');ensureVitals(alreadyDead).hp=0;cast.counts.set(alreadyDead.id,2);
  const hits=tickConstellationGather(room,boss,cast.endsAt);
  assert.equal(hits.length,31);assert.equal(new Set(hits.map(h=>h.targetId)).size,31);
  assert(ensureVitals(p).hp>0);assert(ensureVitals(q).hp>0);
  assert.equal(ensureVitals(solo).hp,0);assert.equal(ensureVitals(different).hp,0);
});

test('boss keeps firing through the cast; defeat clears the puzzle, and teacher ghost collection is hidden from students',()=>{
  const {room,boss,p,q}=fixture();Object.assign(p,{x:boss.x+480,y:boss.y});
  damageMonster(room,boss,p,1,start);boss.linksReadyAt=boss.namesReadyAt=start+60000;
  moveMonsters(room,start+100,()=>0);assert(boss.gather);
  const teacher=actor('teacher','teacher');teacher.teacherGhost=true;room.players.set(teacher.id,teacher);
  boss.teacherRetaliation=new Set([teacher.id]);
  const star=boss.gather.stars[0];Object.assign(teacher,{x:star.x,y:star.y});
  collectConstellationGather(room,teacher,{castId:boss.gather.id,starId:star.id},start+100);
  const monsters=monsterViews(room,start+100);
  assert.equal(visibleGatherMonsters(room,monsters,p)[0].constellationGather.counts.teacher,undefined);
  assert.equal(visibleGatherMonsters(room,monsters,teacher)[0].constellationGather.counts.teacher,1);
  q.mapId='space-plaza';assert.equal(visibleGatherMonsters(room,monsters,q)[0].constellationGather,undefined);
  moveMonsters(room,start+5100,()=>0);
  assert(monsterViews(room,start+5100)[0].homingStar);
  damageMonster(room,boss,p,50000,start+5101);assert.equal(boss.gather,null);
});

test('AI applies the enhanced basic shot concurrently with each of the three exclusive puzzles',()=>{
  for(const [pattern,cost] of [['links',10],['names',10],['gather',20]]){
    const {room,boss,p,q}=fixture();
    q.mapId='space-plaza';Object.assign(p,{x:boss.x+800,y:boss.y,taurusImmuneUntil:start+60000});
    for(const other of ['links','names','gather'])if(other!==pattern)boss[other+'ReadyAt']=start+60000;
    damageMonster(room,boss,p,1,start);
    moveMonsters(room,start+100,()=>0);
    assert(boss[pattern]);assert(boss.homingVolley);assert.equal(boss.mp,100-10-cost);
    moveMonsters(room,start+2600,()=>0);moveMonsters(room,start+5100,()=>0);
    const view=monsterViews(room,start+5100)[0];
    assert.equal(view.homingVolley.endsAt,start+30100);assert.equal(view.homingStars.length,2);
    assert.equal(view.homingStar.id,view.homingStars[0].id);assert(boss[pattern]);
    damageMonster(room,boss,p,50000,start+5101);assert.equal(boss.homingVolley,null);assert.equal(boss[pattern],null);
  }
});

test('two real sockets race for a star, reconnect with counts, and survive with matching stars at the deadline',async t=>{
  const f=await readingFixture(t);
  for(const p of [f.p,f.q]){
    chargeHuntingStation(p,'math',f.now);p.mapId=spec.mapId;p.avatar.level=5;
    // Boss deadlines use the fixture clock; the existing Taurus cleanup uses wall time.
    p.taurusImmuneUntil=Math.max(Date.now(),f.now)+60000;
  }
  f.room.forgottenConstellation={...active};
  const boss=monstersOf(f.room,f.now).get(spec.monsterId);
  assert(tryConstellationGather(f.room,boss,f.now,()=>0));
  const cast=boss.gather,[first,second]=cast.stars;
  const send=(socket,id,castId=cast.id)=>call(socket,'forgotten-constellation:gather',{castId,starId:id});
  const position=(p,s)=>Object.assign(p,{x:s.x,y:s.y,mapId:spec.mapId});
  position(f.p,{x:0,y:0});assert.equal((await send(f.student,first.id)).ok,false);
  position(f.p,first);position(f.q,first);
  assert.equal((await send(f.student,first.id,'old-cast')).ok,false);
  const race=await Promise.all([send(f.student,first.id),send(f.other,first.id)]);
  assert.equal(race.filter(r=>r.ok).length,1);
  const winner=race[0].ok?f.p:f.q,loser=race[0].ok?f.q:f.p,loserSocket=race[0].ok?f.other:f.student;
  assert.equal(cast.counts.get(winner.id),1);
  f.advance(1000);position(loser,second);assert.equal(ok(await send(loserSocket,second.id)).count,1);
  await f.reconnect();
  const view=f.game.store.snapshot(f.room,f.p,f.now).monsters.find(m=>m.id===boss.id);
  assert.equal(view.constellationGather.counts[f.p.id],1);assert.equal(view.constellationGather.counts[f.q.id],1);
  position(f.p,second);position(f.q,{x:second.x+67,y:second.y});
  const observed=new Promise((resolve,reject)=>{
    const timeout=setTimeout(()=>{f.student.off('world:positions',listen);reject(Error('no post-cast frame, player map='+f.p.mapId+' / active='+!!boss.gather));},3000);
    function listen(data){const m=data.monsters?.find(m=>m.id===boss.id);if(m&&!m.constellationGather){clearTimeout(timeout);f.student.off('world:positions',listen);resolve();}}
    f.student.on('world:positions',listen);
  });
  f.advance(19000);await observed;
  assert.equal(boss.gather,null);assert(ensureVitals(f.p).hp>0);assert(ensureVitals(f.q).hp>0);
  assert.equal((await send(f.student,first.id)).ok,false);
});
