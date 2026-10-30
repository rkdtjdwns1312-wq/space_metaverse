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
  for(const [kind,cooldown,duration,count] of [['yellow',30000,20000,35],['black',30000,10000,2],['red',60000,5000,2]]){
    const f=fixture(35);
    assert.equal(beginSerenaSkill(f.room,f.boss,kind,1000,()=>0),true);
    const marks=view(f,1000).marks.filter(m=>m.kind===kind);
    assert.equal(marks.length,count);assert.equal(new Set(marks.map(m=>m.playerId)).size,count);
    assert.equal(marks[0].endsAt,1000+duration);assert.equal(f.boss.serenaSkills.ready[kind],1000+cooldown);
    assert.equal(beginSerenaSkill(f.room,f.boss,kind,1001,()=>0),false);
    assert.equal(f.boss.mp,90);
    assert.equal(beginSerenaSkill(f.room,f.boss,kind,1000+cooldown-1),false);
  }
});

test('세레나는 세 스킬을 겹치지 않고 한 번의 확률 판단 후 다음 기회를 기다린다',()=>{
  const f=fixture(3),p=f.players[0];
  assert.equal(beginSerenaSkill(f.room,f.boss,'yellow',1000,()=>0),true);
  assert.equal(beginSerenaSkill(f.room,f.boss,'black',11000,()=>0),false);
  assert.equal(beginSerenaSkill(f.room,f.boss,'red',23000,()=>0),false,'마지막 경고의 폭발까지 시전 잠금');
  tickSerenaSkills(f.room,f.boss,21000);
  tickSerenaSkills(f.room,f.boss,23000);
  assert.equal(trySerenaSkills(f.room,f.boss,p,23650,()=>0),false,'폭발 후 판단 휴식');
  tickSerenaSkills(f.room,f.boss,25650);
  assert.equal(trySerenaSkills(f.room,f.boss,p,25650,()=>1),false,'판단 실패 시 즉시 다른 스킬 시도하지 않음');
  assert.equal(trySerenaSkills(f.room,f.boss,p,25651,()=>0),false,'판단 간격 2초');
  assert.equal(trySerenaSkills(f.room,f.boss,p,27650,()=>0),true,'다음 판단에서 다른 스킬 시작');
  assert.equal(f.boss.serenaSkills.marks.filter(mark=>mark.kind==='red').length,2);
  assert.equal(beginSerenaSkill(f.room,f.boss,'black',37650,()=>0),false);
});

test('지연된 노란 경고 폭발이 끝날 때까지 다른 스킬을 시작하지 않는다',()=>{
  const f=fixture(1),p=f.players[0];
  assert.equal(beginSerenaSkill(f.room,f.boss,'yellow',1000),true);
  tickSerenaSkills(f.room,f.boss,21000);
  assert.equal(trySerenaSkills(f.room,f.boss,p,26000,()=>0),false,'미처 처리되지 않은 경고를 우선 완료');
  tickSerenaSkills(f.room,f.boss,26000);
  assert.equal(f.boss.serenaSkills.bursts[0].endsAt,26650);
  assert.equal(beginSerenaSkill(f.room,f.boss,'black',26000),false);
  tickSerenaSkills(f.room,f.boss,26650);
  assert.equal(trySerenaSkills(f.room,f.boss,p,28649,()=>0),false,'실제 폭발 후 판단 휴식');
  assert.equal(trySerenaSkills(f.room,f.boss,p,28650,()=>0),true);
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

test('red server roll is one or two per mark and its serialized view carries the required number',()=>{
  const f=fixture(3),rolls=[0,0,0,.999999];
  beginSerenaSkill(f.room,f.boss,'red',1000,()=>rolls.shift());
  assert.deepEqual(view(f,1000).marks.map(mark=>mark.requiredFriends),[1,2]);
  assert.deepEqual(view(f,1000).marks.map(mark=>mark.nearbyFriends),[0,0]);
  assert.doesNotThrow(()=>JSON.stringify(view(f,1000)));
});

test('red requires simultaneous distinct other classmates, follows the victim, and never damages nearby allies',()=>{
  const f=fixture(3),[p,first,second]=f.players;
  beginSerenaSkill(f.room,f.boss,'red',1000,()=>0);
  f.boss.serenaSkills.marks=f.boss.serenaSkills.marks.filter(mark=>mark.playerId===p.id);
  const mark=f.boss.serenaSkills.marks[0];mark.requiredFriends=2;
  const {radiusX,radiusY}=serenaRedRadii(p);
  first.x=p.x+radiusX;second.x=p.x;second.y=p.y+radiusY+1;
  for(const now of [2000,3000,4000]){
    assert.equal(tickSerenaSkills(f.room,f.boss,now).length,0);
    assert.equal(view(f,now).marks[0].nearbyFriends,1,'same friend cannot count twice');
  }
  first.x=p.x+radiusX+1;second.y=p.y;tickSerenaSkills(f.room,f.boss,4500);
  assert.equal(view(f,4500).marks[0].nearbyFriends,1,'visits are not accumulated');
  p.x+=500;first.x=p.x+100;second.x=p.x-100;tickSerenaSkills(f.room,f.boss,5999);
  assert.equal(view(f,5999).marks.length,0);assert.equal(tickSerenaSkills(f.room,f.boss,6000).length,0);
  assert(f.players.every(player=>player.battleVitals.hp===500));
});

test('red exact five-second deadline wins, movement and defenses cannot avoid 200% victim-only damage, and late ticks never replay',()=>{
  const f=fixture(3),[p,other]=f.players;beginSerenaSkill(f.room,f.boss,'red',1000,()=>0);
  f.boss.serenaSkills.marks=f.boss.serenaSkills.marks.filter(mark=>mark.playerId===p.id);
  p.taurusImmuneUntil=20000;p.herculesShield={endsAt:20000,hp:999,absorbed:0};
  p.libraAura={endsAt:20000,mapId:p.mapId,size:0,radius:300,skillDamageFactor:1};
  assert.equal(tickSerenaSkills(f.room,f.boss,5999).length,0);
  p.x+=1000;other.x=p.x;other.y=p.y;
  const hits=tickSerenaSkills(f.room,f.boss,6000);
  assert.deepEqual(hits.map(hit=>[hit.targetId,hit.damage]),[[p.id,60]]);
  assert.equal(p.battleVitals.hp,440);assert.equal(other.battleVitals.hp,500);
  assert.equal(p.herculesShield.hp,999);assert.equal(f.boss.hp,10000);
  assert.equal(view(f,6000).bursts[0].kind,'red');assert.equal(view(f,6000).bursts[0].x,p.x);
  assert.equal(tickSerenaSkills(f.room,f.boss,90000).length,0);
  const late=fixture(1);beginSerenaSkill(late.room,late.boss,'red',1000,()=>0);
  assert.equal(tickSerenaSkills(late.room,late.boss,90000)[0].damage,60);
  assert.equal(tickSerenaSkills(late.room,late.boss,90001).length,0);
});

test('red rescue excludes teacher/offline/away/dead/black-star/other-map and includes a living LV1 classmate',()=>{
  const f=fixture(8),p=f.players[0];beginSerenaSkill(f.room,f.boss,'red',1000,()=>0);
  f.boss.serenaSkills.marks=f.boss.serenaSkills.marks.filter(mark=>mark.playerId===p.id);
  for(const other of f.players.slice(1))Object.assign(other,{x:p.x+20,y:p.y});
  f.players[1].role='teacher';f.boss.teacherRetaliation=new Set([f.players[1].id]);
  f.players[2].connected=false;f.players[3].away=true;f.players[4].battleVitals.hp=0;
  f.players[5].avatar.blackStar=true;f.players[6].mapId='space-plaza';f.players[7].x=p.x+1000;
  tickSerenaSkills(f.room,f.boss,2000);assert.equal(view(f,2000).marks[0].nearbyFriends,0);
  const rescuer=f.players[7];rescuer.avatar.level=1;rescuer.x=p.x+50;tickSerenaSkills(f.room,f.boss,3000);
  assert.equal(view(f,3000).marks.length,0);assert.equal(p.battleVitals.hp,500);
});

test('red cleanup handles victim departure/KO and boss defeat/map change without a late blast',()=>{
  for(const change of [p=>p.connected=false,p=>p.away=true,p=>p.mapId='space-plaza',p=>p.battleVitals.hp=0]){
    const f=fixture(1);beginSerenaSkill(f.room,f.boss,'red',1000,()=>0);change(f.players[0]);
    assert.equal(tickSerenaSkills(f.room,f.boss,6000).length,0);assert.equal(view(f,6000).marks.length,0);
  }
  for(const change of [boss=>boss.hp=0,boss=>boss.mapId='space-plaza']){
    const f=fixture(1);beginSerenaSkill(f.room,f.boss,'red',1000,()=>0);change(f.boss);
    assert.equal(tickSerenaSkills(f.room,f.boss,6000).length,0);assert.equal(f.boss.serenaSkills,null);
  }
  const f=fixture(1),p=f.players[0];beginSerenaSkill(f.room,f.boss,'red',1000,()=>0);p.battleVitals.hp=50;
  assert.equal(tickSerenaSkills(f.room,f.boss,6000)[0].defeated,true);assert.equal(p.battleVitals.defeatedAt,6000);
  assert.deepEqual(p.input,{x:0,y:0,at:0});
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

test('Libra immunity blocks yellow damage without reflecting or canceling boss skills',()=>{
  const f=fixture(1),[p]=f.players;
  beginSerenaSkill(f.room,f.boss,'yellow',1000,()=>0);tickSerenaSkills(f.room,f.boss,3000);
  p.avatar.constellationId='libra';p.libraAura={endsAt:9000,mapId:p.mapId,size:0,radius:300,skillDamageFactor:1};
  f.boss.hp=1;
  const hits=tickSerenaSkills(f.room,f.boss,5000);
  assert.equal(hits.length,1);assert.equal(hits[0].damage,0);assert.equal(f.boss.hp,1);assert.ok(f.boss.serenaSkills);
  assert.equal(tickSerenaSkills(f.room,f.boss,7000)[0].damage,0);
});

test('jittered server ticks preserve ten scheduled yellow pulses without catch-up volleys',()=>{
  for(const kind of ['yellow']){
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


test('천칭 무적은 빨간별 고정 피해와 검은별 즉사를 막되 정확한 만료에는 피해를 받는다',()=>{
  for(const kind of ['red','black'])for(const active of [true,false]){
    const f=fixture(1),[p]=f.players;p.avatar.constellationId='libra';
    beginSerenaSkill(f.room,f.boss,kind,1000,()=>0);
    const at=1000+SERENA_SKILLS[kind].durationMs,hp=ensureVitals(p).hp;
    p.libraAura={endsAt:at+(active?1:0),mapId:p.mapId,size:0,radius:300};
    const hits=tickSerenaSkills(f.room,f.boss,at),hit=hits.find(h=>h.targetId===p.id);
    assert.ok(hit);assert.equal(hit.damage===0,active);assert.equal(ensureVitals(p).hp===hp,active);
  }
});
