import test from 'node:test';
import assert from 'node:assert/strict';
import {CONSTELLATIONS,constellationOf} from '../shared/constellations.js';
import {FORGOTTEN_CONSTELLATION as spec} from '../shared/forgotten-constellation.js';
import {monsterType} from '../shared/monsters.js';
import {damageAfterDefense,defensePowerOf} from '../shared/combat.js';
import {monstersOf,moveMonsters,monsterViews,damageMonster} from '../server/monsters.js';
import {tryConstellationNames,answerConstellationName,tickConstellationNames,constellationNamesView} from '../server/forgotten-constellation-names.js';
import {tryConstellationLinks} from '../server/forgotten-constellation-links.js';
import {chargeHuntingStation} from '../server/hunting-time.js';
import {ensureVitals} from '../server/vitals.js';
import {readingFixture,ok,call} from './helpers/reading-fixture.js';

const start=100000;
const actor=(id,role='student')=>({id,role,connected:true,mapId:spec.mapId,avatar:{level:5},x:100,y:100});
function fixture(){
  const p=actor('p'),q=actor('q'),room={players:new Map([[p.id,p],[q.id,q]]),planets:new Map(),
    forgottenConstellation:{state:'active',monsterId:spec.monsterId}};
  const boss=monstersOf(room,start).get(spec.monsterId);
  room.monsters=new Map([[boss.id,boss]]);
  return {room,boss,p,q};
}

test('all 16 transformation forms are selectable; casts have two distinct identities, exclusive patterns, 10 MP / 30s',()=>{
  for(const [i,c] of CONSTELLATIONS.entries()){
    const {room,boss,p}=fixture();
    const rolls=[0,(i+.5)/16,0];
    assert(tryConstellationNames(room,boss,start,()=>rolls.shift()));
    const view=constellationNamesView(boss,start);
    assert.equal(view.endsAt,start+10000);assert.equal(boss.mp,90);
    assert.equal(view.remaining.length,2);assert.equal(view.remaining[0].constellationId,c.id);
    assert.notEqual(view.remaining[1].constellationId,c.id);
    assert(!tryConstellationLinks(room,boss,start,()=>0));
    for(const s of view.remaining)answerConstellationName(room,p,constellationOf(s.constellationId).name,start+5);
    assert(!tryConstellationNames(room,boss,start+29999,()=>0));
    boss.mp=9;assert(!tryConstellationNames(room,boss,start+30000,()=>0));
    boss.mp=10;assert(tryConstellationNames(room,boss,start+30000,()=>0));assert.equal(boss.mp,0);
  }
  const {room,boss}=fixture();assert(tryConstellationLinks(room,boss,start,()=>0));assert(!tryConstellationNames(room,boss,start,()=>0));
});

test('each typo deals a normal full-strength hit only to the sender; correct aliases, repeated answers, and slot order',()=>{
  const {room,boss,p,q}=fixture(),rolls=[0,9.5/16,0];assert(tryConstellationNames(room,boss,start,()=>rolls.shift()));
  const original=ensureVitals(q).hp;
  const expected=damageAfterDefense(monsterType(spec.typeId).power,defensePowerOf(p.avatar.level,p.avatar.constellationId,p));
  for(const text of ['뱀주인자라','양자리']){
    ensureVitals(p).hp=original;
    const result=answerConstellationName(room,p,text,start+10);
    assert.equal(result.status,'wrong');assert.equal(result.hit.damage,expected);
    assert.equal(ensureVitals(p).hp,original-expected);assert.equal(ensureVitals(q).hp,original);
  }
  assert.equal(answerConstellationName(room,q,'쌍둥이 자리',start+20).status,'correct');
  assert.equal(answerConstellationName(room,p,'쌍둥이자리',start+21).status,'already');
  assert.deepEqual(constellationNamesView(boss,start+21).remaining,[{slot:0,constellationId:'ophiuchus'}]);
  assert.equal(answerConstellationName(room,p,'뱀 자리',start+30).status,'complete');
  assert.equal(boss.names,null);assert.equal(answerConstellationName(room,p,'뱀자리',start+31),null);
});

test('deadline defeats eligible map occupants once even under protection; late, absent, dead and observer replies cannot solve',()=>{
  const {room,boss,p,q}=fixture(),combat=actor('combat','teacher'),observer=actor('observer','teacher');
  boss.teacherRetaliation=new Set([combat.id]);
  for(const player of [combat,observer])room.players.set(player.id,player);
  assert(tryConstellationNames(room,boss,start,()=>0));q.mapId='space-plaza';
  const late=actor('late'),ghost=actor('ghost'),preview=actor('preview','teacher'),dead=actor('dead'),away=actor('away');
  ghost.avatar.blackStar=true;preview.avatar.teacherPreview=true;ensureVitals(dead).hp=0;away.away=true;
  for(const player of [late,ghost,preview,dead,away])room.players.set(player.id,player);
  for(const player of [observer,ghost,preview,dead,away,q])assert.equal(answerConstellationName(room,player,'쌍둥이자리',start+100),null);
  assert.equal(answerConstellationName(room,p,'쌍둥이자리',start+100).status,'correct');
  assert.equal(answerConstellationName(room,p,'까마귀자리',start+10000),null);
  p.avatar.constellationId='libra';p.libraAura={mapId:p.mapId,endsAt:start+60000,size:40,radius:200};
  const hits=tickConstellationNames(room,boss,start+10000);
  assert.deepEqual(new Set(hits.map(h=>h.targetId)),new Set([p.id,combat.id,late.id]));
  assert(hits.every(h=>h.defeated));assert.deepEqual(tickConstellationNames(room,boss,start+10001),[]);
});

test('AI casts during combat, fires its regular homing star through the challenge, and removes symbols on death',()=>{
  const {room,boss,p}=fixture();
  Object.assign(p,{x:boss.x+500,y:boss.y});damageMonster(room,boss,p,1,start);boss.linksReadyAt=start+30000;
  moveMonsters(room,start+100,()=>0);assert(boss.names);
  moveMonsters(room,start+5100,()=>0);
  const view=monsterViews(room,start+5100).find(m=>m.id===boss.id);
  assert(view.homingStar);assert.equal(view.constellationNames.remaining.length,2);
  damageMonster(room,boss,p,50000,start+5101);assert.equal(boss.names,null);
});

test('two sockets coordinate map chat answers, retain partial progress on resume, and keep private chat out of the challenge',async t=>{
  const f=await readingFixture(t);
  for(const p of [f.p,f.q]){
    chargeHuntingStation(p,'math',f.now);p.mapId=spec.mapId;p.avatar.level=5;
  }
  f.room.forgottenConstellation={state:'active',monsterId:spec.monsterId,respawnAt:null};
  const boss=monstersOf(f.room,f.now).get(spec.monsterId);
  assert(tryConstellationNames(f.room,boss,f.now,()=>0));
  const send=(socket,text,other={})=>call(socket,'chat:send',{text,...other});
  function visibleSlots(socket,count){
    return new Promise((resolve,reject)=>{
      const stop=()=>{socket.off('world:positions',read);clearTimeout(timer);};
      function read(data){
        const monster=data.monsters?.find(m=>m.id===boss.id);
        if(!monster||(monster.constellationNames?.remaining.length??0)!==count)return;
        stop();resolve(monster.constellationNames?.remaining||[]);
      }
      const timer=setTimeout(()=>{stop();reject(Error('missing shared symbols'));},2500);
      socket.on('world:positions',read);
    });
  }
  const privateReply=ok(await send(f.student,'쌍둥이자리',{channel:'direct',targetId:f.q.id}));
  assert.equal(privateReply.constellationNameAnswer,undefined);assert.equal(boss.names.symbols.filter(s=>s.solved).length,0);
  const hp=ensureVitals(f.p).hp;
  const oldReply=ok(await send(f.student,'이전 패턴 전용 답안',{constellationNameCastId:'outdated'}));
  assert.equal(oldReply.constellationNameAnswer,'expired');assert.equal(ensureVitals(f.p).hp,hp);
  assert.equal(ok(await send(f.student,'여우자리')).constellationNameAnswer,'wrong');
  assert(ensureVitals(f.p).hp<hp);
  f.room.chat.enabled=false;
  const replies=await Promise.all([send(f.student,'쌍둥이 자리'),send(f.other,'쌍둥이자리')]);
  assert.deepEqual(new Set(replies.map(r=>ok(r).constellationNameAnswer)),new Set(['correct','already']));
  const both=await Promise.all([visibleSlots(f.student,1),visibleSlots(f.other,1)]);
  assert.deepEqual(both[0],[{slot:1,constellationId:'corvus'}]);assert.deepEqual(both[1],both[0]);
  const id=boss.names.id;await f.reconnect();
  const snapshot=f.game.store.snapshot(f.room,f.p,f.now).monsters.find(m=>m.id===boss.id).constellationNames;
  assert.equal(snapshot.id,id);assert.deepEqual(snapshot.remaining,[{slot:1,constellationId:'corvus'}]);
  Object.assign(f.p,{mapId:spec.mapId});assert.equal(ok(await send(f.student,'까마귀자리')).constellationNameAnswer,'complete');
  await Promise.all([visibleSlots(f.student,0),visibleSlots(f.other,0)]);
  assert.equal(boss.names,null);
  assert.equal((await send(f.other,'까마귀자리')).ok,false);
  f.room.chat.enabled=true;
  assert.equal(ok(await send(f.other,'늦은 패턴 답안',{constellationNameCastId:id})).constellationNameAnswer,'expired');
  assert(!f.room.chat.history.some(m=>['늦은 패턴 답안','이전 패턴 전용 답안'].includes(m.text)));
  assert.equal(f.room.chat.history.filter(m=>m.channel==='map'&&['쌍둥이자리','까마귀자리','여우자리'].includes(m.text)).length,0);
});
