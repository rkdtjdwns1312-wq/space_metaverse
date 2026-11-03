import test from 'node:test';
import assert from 'node:assert/strict';
import {TRUTH_CREATOR_BLUE as RULE} from '../shared/truth-creator-blue.js';
import {mapOf} from '../shared/config.js';
import {onOriginFloor} from '../shared/origin-floor.js';
import {ensureVitals} from '../server/vitals.js';
import {tryTruthCreatorBlue,tickTruthCreatorBlue,truthCreatorBlueViews,openTruthCreatorBlue,inputTruthCreatorBlue} from '../server/truth-creator-blue.js';
import {tryTruthCreatorChasers,tickTruthCreatorChasers} from '../server/truth-creator-chasers.js';
import {tryTruthCreatorGalaxy,tickTruthCreatorGalaxy} from '../server/truth-creator-galaxy.js';
import {clearTruthCreatorAttack} from '../server/truth-creator-attack.js';
const now=100000;
function fixture(){
  const map=mapOf('sleeping-stars-4'),boss={id:'truth-creator-boss',typeId:'truth-creator',hp:30000,mp:100,mapId:map.id,x:map.width/2,y:map.height/2,radius:150};
  const player={id:'a',socketId:'socket-a',role:'student',connected:true,away:false,mapId:map.id,x:boss.x+300,y:boss.y,avatar:{level:1},statGrowth:{bonuses:{hp:1000}},equipmentSlots:[],inventory:[]};
  ensureVitals(player);return {boss,player,room:{players:new Map([[player.id,player]]),monsters:new Map([[boss.id,boss]]),planets:new Map()}};
}
function cast(f,at=now){assert.equal(tryTruthCreatorBlue(f.room,f.boss,f.player,at,()=>.25),true);return f.boss.truthCreatorBlue.orbs;}
function open(f,orb,at=orb.landsAt){Object.assign(f.player,{x:orb.x,y:orb.y});return openTruthCreatorBlue(f.room,f.player,orb.id,at);}
const payload=(opened,action=opened.orb.sequence[opened.orb.progress])=>({orbId:opened.orb.id,interactionToken:opened.interactionToken,revision:opened.orb.revision,action});
test('three distinct flying orbs cost MP5/CD30 and begin their independent twenty-second deadlines only on landing',()=>{
  const f=fixture(),orbs=cast(f);assert.equal(f.boss.mp,95);assert.equal(orbs.length,3);assert.equal(tryTruthCreatorBlue(f.room,f.boss,f.player,now+1),false);
  const start=truthCreatorBlueViews(f.boss,now);assert(start.every(orb=>orb.phase==='flying'&&orb.x===f.boss.x&&orb.y===f.boss.y));
  for(const orb of orbs){assert.equal(orb.endsAt-orb.landsAt,20000);assert.equal(orb.landsAt-now,RULE.flightMs);assert(onOriginFloor(mapOf(f.boss.mapId),orb.x,orb.y,48));
    assert.equal(orb.sequence.length,8);assert.equal(new Set(orb.sequence).size,2);assert(!f.room.monsters.has(orb.id),'not a damageable monster');
    for(const other of orbs)if(other!==orb)assert(Math.hypot(orb.x-other.x,orb.y-other.y)>=186);
    assert.throws(()=>open(f,orb,orb.landsAt-1));}
  assert(truthCreatorBlueViews(f.boss,orbs[0].landsAt).every(orb=>orb.phase==='landed'));
  assert(start.every(orb=>!('sequence' in orb)&&!('progress' in orb)),'world packets expose only the objects');
});
test('wrong inputs reset only that orb without extending time; stale retries and reopened old tokens cannot advance twice',()=>{
  const f=fixture(),[orb,other]=cast(f),due=orb.endsAt,opened=open(f,orb),first=payload(opened);
  const accepted=inputTruthCreatorBlue(f.room,f.player,first,orb.landsAt);assert.equal(accepted.orb.progress,1);
  const retry=inputTruthCreatorBlue(f.room,f.player,first,orb.landsAt+1);assert.equal(retry.stale,true);assert.equal(retry.orb.progress,1);
  const reopened=open(f,orb,orb.landsAt+2);assert.equal(reopened.orb.progress,1);assert.notEqual(reopened.interactionToken,opened.interactionToken);
  assert.throws(()=>inputTruthCreatorBlue(f.room,f.player,{...first,revision:1},orb.landsAt+3));
  const wrong=orb.sequence[1]==='attack'?'skill':'attack';const reset=inputTruthCreatorBlue(f.room,f.player,payload(reopened,wrong),orb.landsAt+4);
  assert.equal(reset.correct,false);assert.equal(orb.progress,0);assert.equal(orb.revision,2);assert.equal(other.progress,0);assert.equal(orb.endsAt,due);
  for(const action of ['Q','E','defuse',null,{},8])assert.throws(()=>inputTruthCreatorBlue(f.room,f.player,{...payload(reopened),revision:2,action},orb.landsAt+5));
  for(const revision of [-1,1.5,'2',NaN])assert.throws(()=>inputTruthCreatorBlue(f.room,f.player,{...payload(reopened),revision},orb.landsAt+5));
});
test('all three are individually disarmed; concurrent final packets complete once and future waves never reuse old ids',()=>{
  const f=fixture(),orbs=[...cast(f)],oldId=orbs[0].id;
  for(const orb of orbs){let opened=open(f,orb),last;
    for(let step=0;step<8;step++){last=payload(opened);const result=inputTruthCreatorBlue(f.room,f.player,last,orb.landsAt+step);opened={...result,interactionToken:opened.interactionToken};
      assert.equal(result.disarmed,step===7);}
    assert.equal(opened.orb,null);assert.throws(()=>inputTruthCreatorBlue(f.room,f.player,last,orb.landsAt+9));}
  assert.equal(f.boss.truthCreatorBlue.orbs.length,0);assert.deepEqual(tickTruthCreatorBlue(f.room,f.boss,now+RULE.flightMs+RULE.durationMs),[]);
  assert.equal(tryTruthCreatorBlue(f.room,f.boss,f.player,now+29999),false);cast(f,now+30000);
  assert(!f.boss.truthCreatorBlue.orbs.some(orb=>orb.id===oldId));assert.throws(()=>openTruthCreatorBlue(f.room,f.player,oldId,now+32000));
});
test('per-player/socket tokens, distance, map, life, presence and preview authority are checked on every input',()=>{
  const f=fixture(),[orb]=cast(f),opened=open(f,orb),data=payload(opened);
  const stranger={...f.player,id:'b',socketId:'socket-b',battleVitals:{...f.player.battleVitals}};f.room.players.set(stranger.id,stranger);
  assert.throws(()=>inputTruthCreatorBlue(f.room,stranger,data,orb.landsAt));
  const second=openTruthCreatorBlue(f.room,stranger,orb.id,orb.landsAt);assert.notEqual(second.interactionToken,opened.interactionToken);
  inputTruthCreatorBlue(f.room,f.player,data,orb.landsAt);
  const concurrent=inputTruthCreatorBlue(f.room,stranger,{...payload(second)},orb.landsAt);assert.equal(concurrent.stale,true);assert.equal(orb.progress,1);
  for(const alter of [p=>p.x+=500,p=>p.mapId='space-plaza',p=>p.connected=false,p=>p.away=true,p=>p.avatar.blackStar=true,p=>p.battleVitals.hp=0,p=>p.socketId='new-socket',p=>p.avatar.teacherPreview=true]){
    const g=fixture(),[o]=cast(g),read=open(g,o);alter(g.player);assert.throws(()=>inputTruthCreatorBlue(g.room,g.player,payload(read),o.landsAt));assert.equal(o.progress,0);}
  assert.throws(()=>inputTruthCreatorBlue(f.room,f.player,{...data,revision:orb.revision},orb.endsAt),'exact deadline is too late');
});
test('one unresolved deadline defeats the whole eligible map once, respects Libra and teacher retaliation, and clears on reset',()=>{
  const f=fixture(),[orb]=cast(f),people=[];
  for(const [id,change] of [['immune',{avatar:{level:1,constellationId:'libra'}}],['teacher',{role:'teacher',avatar:{level:6}}],['retaliating',{role:'teacher',teacherGhost:true,avatar:{level:6}}],['preview',{role:'teacher',avatar:{level:6,teacherPreview:true}}],['other',{mapId:'space-plaza'}],['offline',{connected:false}]]){
    const p={...f.player,id,socketId:id,...change,battleVitals:undefined};ensureVitals(p);f.room.players.set(id,p);people.push(p);}
  const immune=f.room.players.get('immune');immune.x+=1000;immune.libraAura={mapId:immune.mapId,endsAt:orb.endsAt+1000,size:20,radius:20};
  f.boss.teacherRetaliation=new Set(['retaliating','preview']);
  assert.deepEqual(tickTruthCreatorBlue(f.room,f.boss,orb.endsAt-1),[]);
  const hits=tickTruthCreatorBlue(f.room,f.boss,orb.endsAt);assert.equal(hits.length,3);assert(hits.find(hit=>hit.targetId==='immune').immune);assert(hits.find(hit=>hit.targetId==='retaliating').defeated);
  assert.equal(f.player.battleVitals.hp,0);assert(f.room.players.get('teacher').battleVitals.hp>0);assert.deepEqual(tickTruthCreatorBlue(f.room,f.boss,orb.endsAt+1),[]);
  for(const change of [g=>g.boss.hp=0,g=>g.boss.mapId='space-plaza',g=>g.player.mapId='space-plaza',g=>g.player.connected=false,g=>g.player.battleVitals.hp=0]){const g=fixture();cast(g);change(g);assert.deepEqual(tickTruthCreatorBlue(g.room,g.boss,now+1),[]);assert.equal(g.boss.truthCreatorBlue,null);}
  const g=fixture();cast(g);clearTruthCreatorAttack(g.boss,g.room);assert.equal(g.boss.truthCreatorBlue,null);
});

test('red chasers and blue puzzles never overlap and a blocked cast spends no mana or cooldown',()=>{
  const f=fixture();assert(tryTruthCreatorChasers(f.room,f.boss,f.player,now));
  assert.equal(tryTruthCreatorBlue(f.room,f.boss,f.player,now,()=>.25),false);
  assert.equal(f.boss.mp,90);assert.equal(f.boss.truthCreatorBlue,undefined);
  tickTruthCreatorChasers(f.room,f.boss,now+10000);
  const orbs=cast(f,now+10000);assert.equal(f.boss.mp,85);
  const readyAt=f.boss.truthCreatorChasers.readyAt;
  assert.equal(tryTruthCreatorChasers(f.room,f.boss,f.player,now+30000),false);
  assert.equal(f.boss.mp,85);assert.equal(f.boss.truthCreatorChasers.readyAt,readyAt);
  for(const orb of [...orbs]){let opened=open(f,orb,now+30000);
    for(let i=0;i<8;i++){const result=inputTruthCreatorBlue(f.room,f.player,payload(opened),now+30000+i);opened={...result,interactionToken:opened.interactionToken};}}
  assert(tryTruthCreatorChasers(f.room,f.boss,f.player,now+30010));assert.equal(f.boss.mp,75);
  const g=fixture();cast(g);assert.equal(tryTruthCreatorChasers(g.room,g.boss,g.player,now),false);
  assert.equal(g.boss.truthCreatorChasers,undefined);assert.equal(g.boss.mp,95);
});

test('blue puzzles exclude every queued and flying galaxy, in either casting order',()=>{
  const f=fixture();cast(f);assert.equal(tryTruthCreatorGalaxy(f.room,f.boss,f.player,now,()=>0),false);
  assert.equal(f.boss.mp,95);assert.equal(f.boss.truthCreatorGalaxy,undefined);
  const g=fixture();g.player.y=g.boss.y+350;assert(tryTruthCreatorGalaxy(g.room,g.boss,g.player,now,()=>0));
  assert.equal(tryTruthCreatorBlue(g.room,g.boss,g.player,now),false);assert.equal(g.boss.mp,70);
  assert.equal(g.boss.truthCreatorBlue,undefined);
  const state=g.boss.truthCreatorGalaxy;
  // The entire spawn queue must finish, then the last projectile must leave the map.
  for(let i=0;i<7;i++){tickTruthCreatorGalaxy(g.room,g.boss,state.nextSpawnAt);assert.equal(tryTruthCreatorBlue(g.room,g.boss,g.player,state.nextSpawnAt||now+8000),false);}
  assert.equal(state.queue.length,0);assert(state.orbs.length);
  const lastEnd=Math.max(...state.orbs.map(orb=>orb.endsAt));tickTruthCreatorGalaxy(g.room,g.boss,lastEnd);
  assert.equal(state.orbs.length,0);assert(tryTruthCreatorBlue(g.room,g.boss,g.player,lastEnd,()=>.25));assert.equal(g.boss.mp,65);
});
