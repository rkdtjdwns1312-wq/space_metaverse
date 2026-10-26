import test from 'node:test';
import assert from 'node:assert/strict';
import {SERENA_SKILLS,serenaRedRadii} from '../shared/serena-skills.js';
import {SERENA} from '../shared/serena.js';
import {RULES} from '../shared/config.js';
import {damageAfterDefense,defensePowerOf} from '../shared/combat.js';
import {monstersOf,monsterViews,moveMonsters,damageMonster} from '../server/monsters.js';
import {beginSerenaSkill,tickSerenaSkills,trySerenaSkills,serenaSkillViews} from '../server/serena-skills.js';
import {ensureVitals} from '../server/vitals.js';

function fixture(count=3){
  const room={players:new Map(),planets:new Map(),serena:{state:'active',respawnAt:null,monsterId:SERENA.monsterId}};
  const boss=monstersOf(room,1000,()=>0).get(SERENA.monsterId);
  room.monsters=new Map([[boss.id,boss]]);
  for(let i=0;i<count;i++){
    const p={id:`p${i}`,role:'student',accountKind:'master',connected:true,away:false,mapId:boss.mapId,x:boss.x+300+i*700,y:boss.y,
      avatar:{level:5,constellationId:'taurus'},equipmentSlots:[],inventory:[],input:{x:0,y:0,at:0}};
    ensureVitals(p);room.players.set(p.id,p);
  }
  return {room,boss,players:[...room.players.values()]};
}
const view=(f,now)=>serenaSkillViews(f.room,f.boss,now);

test('three server-owned spells have requested mana, cooldown, duration and target limits',()=>{
  const f=fixture(35);
  for(const [kind,cooldown,duration,count] of [['yellow',30000,20000,35],['black',30000,10000,2],['red',60000,20000,2]]){
    assert.equal(beginSerenaSkill(f.room,f.boss,kind,1000,()=>0),true);
    const marks=view(f,1000).marks.filter(m=>m.kind===kind);
    assert.equal(marks.length,count);assert.equal(new Set(marks.map(m=>m.playerId)).size,count);
    assert.equal(marks[0].endsAt,1000+duration);assert.equal(f.boss.serenaSkills.ready[kind],1000+cooldown);
    assert.equal(beginSerenaSkill(f.room,f.boss,kind,1001,()=>0),false);
  }
  assert.equal(f.boss.mp,70);
  assert.equal(beginSerenaSkill(f.room,f.boss,'yellow',30999),false);
  assert.equal(beginSerenaSkill(f.room,f.boss,'yellow',31000),true);
  f.boss.mp=9;assert.equal(beginSerenaSkill(f.room,f.boss,'black',31000),false);
});

test('yellow follows carrier for warning placement, locks coordinates and explodes after two seconds at 100% attack',()=>{
  const f=fixture(1),p=f.players[0];
  beginSerenaSkill(f.room,f.boss,'yellow',1000);
  assert.equal(tickSerenaSkills(f.room,f.boss,2999).length,0);assert.equal(view(f,2999).warnings.length,0);
  p.x+=100;tickSerenaSkills(f.room,f.boss,3000);
  const w=view(f,3000).warnings[0];assert.equal(w.x,p.x);assert.equal(w.endsAt,5000);assert.equal(w.radius,55);
  p.x+=300;assert.equal(tickSerenaSkills(f.room,f.boss,4999).length,0);
  assert.equal(tickSerenaSkills(f.room,f.boss,5000).length,0);
  assert.equal(view(f,5000).bursts[0].x,w.x);assert.equal(view(f,5000).warnings[0].x,p.x);
  const hp=p.battleVitals.hp,hits=tickSerenaSkills(f.room,f.boss,7000);
  assert.equal(hits.length,1);assert.equal(hits[0].damage,damageAfterDefense(30,defensePowerOf(5,'taurus',p)));
  assert.equal(p.battleVitals.hp,hp-hits[0].damage);
});

test('yellow creates ten warnings, last explodes at 22 seconds, and long stalls never replay missed pulses',()=>{
  const f=fixture(1),p=f.players[0];beginSerenaSkill(f.room,f.boss,'yellow',1000);
  let count=0;
  for(let now=3000;now<=21000;now+=2000){p.x+=300;tickSerenaSkills(f.room,f.boss,now);count++;assert.equal(f.boss.serenaSkills.sequence,count+1);}
  assert.equal(view(f,21000).marks.length,0);assert.equal(view(f,21000).warnings.length,1);
  tickSerenaSkills(f.room,f.boss,23000);assert.equal(view(f,23000).warnings.length,0);
  const stalled=fixture(1);beginSerenaSkill(stalled.room,stalled.boss,'yellow',1000);tickSerenaSkills(stalled.room,stalled.boss,19000);
  assert.equal(view(stalled,19000).warnings.length,1);
  tickSerenaSkills(stalled.room,stalled.boss,90000);assert.equal(view(stalled,90000).marks.length,0);
});

test('black counts contact entry once, requires separation, and five contacts clear the death mark',()=>{
  const f=fixture(2),[p,other]=f.players;beginSerenaSkill(f.room,f.boss,'black',1000,()=>0);
  for(let i=0;i<5;i++){
    other.x=p.x+RULES.radius*2;tickSerenaSkills(f.room,f.boss,1100+i*1000);
    if(i<4){assert.equal(view(f,1100+i*1000).marks.find(m=>m.playerId===p.id).remaining,4-i);
      tickSerenaSkills(f.room,f.boss,1200+i*1000);assert.equal(view(f,1200+i*1000).marks.find(m=>m.playerId===p.id).remaining,4-i);}
    other.x=p.x+200;tickSerenaSkills(f.room,f.boss,1500+i*1000);
  }
  assert.equal(view(f,6000).marks.length,0);assert.equal(tickSerenaSkills(f.room,f.boss,11000).length,0);
  assert.equal(p.battleVitals.hp,500);
});

test('black deadline kills exactly once despite defenses and leaves normal defeated state',()=>{
  const f=fixture(1),p=f.players[0];beginSerenaSkill(f.room,f.boss,'black',1000,()=>0);
  p.taurusImmuneUntil=20000;p.herculesShield={endsAt:20000,hp:999,absorbed:0};p.capricornBlessing={endsAt:20000};
  assert.equal(tickSerenaSkills(f.room,f.boss,10999).length,0);
  const hits=tickSerenaSkills(f.room,f.boss,11000);
  assert.equal(hits.length,1);assert.equal(hits[0].defeated,true);assert.equal(p.battleVitals.hp,0);assert.equal(p.battleVitals.defeatedAt,11000);
  assert.deepEqual(p.input,{x:0,y:0,at:0});assert.equal(tickSerenaSkills(f.room,f.boss,12000).length,0);
});

test('red follows carrier, excludes self, uses ellipse and ticks every two seconds with attack power',()=>{
  const f=fixture(3),[p,other,outside]=f.players;beginSerenaSkill(f.room,f.boss,'red',1000,()=>0);
  // Keep a single carrier to isolate damage/self exclusion (random selection itself is tested above).
  f.boss.serenaSkills.marks=f.boss.serenaSkills.marks.filter(m=>m.playerId===p.id);
  const {radiusX,radiusY}=serenaRedRadii(p);p.x+=100;other.x=p.x+radiusX;outside.x=p.x;outside.y=p.y+radiusY+RULES.radius+1;
  assert.equal(tickSerenaSkills(f.room,f.boss,2999).length,0);
  const hits=tickSerenaSkills(f.room,f.boss,3000);assert.deepEqual(hits.map(h=>h.targetId),[other.id]);assert.equal(hits[0].damage,25);
  assert.equal(p.battleVitals.hp,500);assert.equal(outside.battleVitals.hp,500);assert.equal(tickSerenaSkills(f.room,f.boss,4999).length,0);
  p.x+=1000;other.x=p.x;assert.equal(tickSerenaSkills(f.room,f.boss,5000).length,1);
});

test('eligibility excludes offline/away/dead/other-map/black-star and teacher preview; teacher retaliation opt-in is preserved',()=>{
  const f=fixture(9);
  Object.assign(f.players[1],{connected:false});Object.assign(f.players[2],{away:true});f.players[3].mapId='space-plaza';f.players[4].battleVitals.hp=0;
  f.players[5].avatar.blackStar=true;f.players[6].role='teacher';f.players[7].role='teacher';f.players[7].avatar.teacherPreview=true;f.players[8].role='teacher';
  f.boss.teacherRetaliation=new Set([f.players[7].id,f.players[8].id]);
  beginSerenaSkill(f.room,f.boss,'yellow',1000);
  assert.deepEqual(view(f,1000).marks.map(m=>m.playerId),[f.players[0].id,f.players[8].id]);
});

test('carrier departure/death and boss map change/death remove marks and pending warnings',()=>{
  for(const change of [p=>p.connected=false,p=>p.away=true,p=>p.mapId='space-plaza',p=>p.battleVitals.hp=0]){
    const f=fixture(1);beginSerenaSkill(f.room,f.boss,'yellow',1000);tickSerenaSkills(f.room,f.boss,3000);change(f.players[0]);
    assert.equal(tickSerenaSkills(f.room,f.boss,5000).length,0);assert.equal(view(f,5000).marks.length,0);assert.equal(view(f,5000).warnings.length,0);
  }
  for(const change of [b=>b.mapId='space-plaza',b=>b.hp=0]){
    const f=fixture(1);beginSerenaSkill(f.room,f.boss,'yellow',1000);tickSerenaSkills(f.room,f.boss,3000);change(f.boss);
    assert.equal(tickSerenaSkills(f.room,f.boss,5000).length,0);assert.equal(f.boss.serenaSkills,null);
  }
});

test('normal AI casts probabilistically only in combat, integrates snapshots, and clears on actual boss defeat',()=>{
  const f=fixture(1),p=f.players[0];moveMonsters(f.room,3000,()=>0);assert.equal(f.boss.serenaSkills,undefined);
  f.boss.attackers.set(p.id,1);f.boss.targetId=p.id;
  moveMonsters(f.room,3100,()=>0);assert.equal(f.boss.mp,90);
  const effects=monsterViews(f.room,3100)[0].serenaSkillEffects;assert.equal(effects.marks[0].kind,'yellow');assert.doesNotThrow(()=>JSON.stringify(effects));
  damageMonster(f.room,f.boss,p,10000,3200);assert.equal(f.boss.serenaSkills,null);
  const fail=fixture(1);assert.equal(trySerenaSkills(fail.room,fail.boss,fail.players[0],1000,()=>1),false);assert.equal(fail.boss.mp,100);
  assert.equal(trySerenaSkills(fail.room,fail.boss,fail.players[0],1001,()=>0),false);assert.equal(fail.boss.mp,100);
});

test('failed casting never consumes mana, and sleep/stun block new casts without canceling already marked effects',()=>{
  const f=fixture(1);f.boss.sleepUntil=2000;assert.equal(beginSerenaSkill(f.room,f.boss,'black',1000),false);assert.equal(f.boss.mp,100);
  assert.equal(beginSerenaSkill(f.room,f.boss,'yellow',2000),true);f.boss.stunUntil=10000;
  tickSerenaSkills(f.room,f.boss,4000);assert.equal(view(f,4000).warnings.length,1);
  assert.equal(beginSerenaSkill(f.room,f.boss,'red',4000),false);
  const empty=fixture(0);assert.equal(beginSerenaSkill(empty.room,empty.boss,'yellow',1000),false);assert.equal(empty.boss.mp,100);
  assert.equal(SERENA_SKILLS.yellow.mana,10);
});

test('Libra reflection can defeat Serena and cancels remaining marked areas in that same tick',()=>{
  const f=fixture(3),[p,other]=f.players;
  beginSerenaSkill(f.room,f.boss,'red',1000,()=>0);
  f.boss.serenaSkills.marks=f.boss.serenaSkills.marks.filter(m=>m.playerId===p.id);
  other.x=p.x+100;other.libraAura={endsAt:9000,mapId:other.mapId,size:0,radius:300,skillDamageFactor:1};
  f.boss.hp=1;
  const hits=tickSerenaSkills(f.room,f.boss,3000);
  assert.equal(hits.length,1);assert.equal(hits[0].damage,0);assert.equal(f.boss.hp,0);assert.equal(f.boss.serenaSkills,null);
  assert.equal(tickSerenaSkills(f.room,f.boss,5000).length,0);
});

test('jittered server ticks preserve ten scheduled yellow/red pulses without catch-up volleys',()=>{
  for(const kind of ['yellow','red']){
    const f=fixture(2),[carrier,other]=f.players;beginSerenaSkill(f.room,f.boss,kind,1000,()=>0);
    f.boss.serenaSkills.marks=f.boss.serenaSkills.marks.filter(m=>m.playerId===carrier.id);
    let hitCount=0;
    for(let i=1;i<=10;i++){
      carrier.x+=300;other.x=carrier.x+100;
      const now=1000+i*2020;
      hitCount+=tickSerenaSkills(f.room,f.boss,now).length;
      if(kind==='yellow'){
        assert.equal(f.boss.serenaSkills.warnings.length,1);
        assert.equal(f.boss.serenaSkills.warnings[0].startsAt,now);
        assert.equal(f.boss.serenaSkills.warnings[0].endsAt,now+2000);
      }
    }
    assert.equal(f.boss.serenaSkills.marks.length,0);
    if(kind==='yellow')assert.equal(f.boss.serenaSkills.sequence,12); // two original marks + ten warnings
    else assert.equal(hitCount,10);
    assert.equal(tickSerenaSkills(f.room,f.boss,21201).length,0);
  }
  const f=fixture(1);beginSerenaSkill(f.room,f.boss,'yellow',1000);
  for(let now=3000;now<=19000;now+=2000){f.players[0].x+=300;tickSerenaSkills(f.room,f.boss,now);}
  const sequence=f.boss.serenaSkills.sequence;f.players[0].x+=300;
  tickSerenaSkills(f.room,f.boss,23000);assert.equal(f.boss.serenaSkills.sequence,sequence);assert.equal(f.boss.serenaSkills.marks.length,0);
});
