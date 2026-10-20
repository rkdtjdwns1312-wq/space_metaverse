import test from 'node:test';
import assert from 'node:assert/strict';
import {monstersOf,monsterViews,moveMonsters,damageMonster} from '../server/monsters.js';
import {ensureVitals} from '../server/vitals.js';
import {damagePlayersInArea,reflectLibraDamage} from '../server/area-combat.js';
import {castLibra} from '../server/libra-skills.js';
import {castOphiuchus,advanceOphiuchusVenoms,advanceOphiuchusPoison} from '../server/ophiuchus-skills.js';
import {NOKSERA_MOON_PHASE as MOON,NOKSERA_HORN_BURST as HORN,nokseraMoonTimeline} from '../shared/boss-skills.js';
const START=1000;
function fixture(){
  const room={players:new Map(),planets:new Map()};
  const boss=monstersOf(room,START,()=>0).get('noksera-boss');room.monsters=new Map([[boss.id,boss]]);
  const player={id:'moon-tester',role:'student',connected:true,away:false,mapId:boss.mapId,x:boss.x+220,y:boss.y,
    avatar:{level:4,constellationId:'taurus'},equipmentSlots:[],inventory:[],effects:[]};
  room.players.set(player.id,player);boss.attackers.set(player.id,1);boss.targetId=player.id;
  boss.hornReadyAt=Infinity;boss.moonDecisionAt=START;boss.nextAttackAt=Infinity;
  return {room,boss,player};
}
const tick=(f,now,random=()=>0)=>moveMonsters(f.room,now,random);
function full(f){tick(f,START);tick(f,START+2000);return START+9000;}

test('달 준비2초와 공개 timeline 7/6/7초·마나25·쿨60초·준비 중 이동/평타 금지',()=>{
  const f=fixture(),{boss,player,room}=f,xy=[boss.x,boss.y],hp=ensureVitals(player).hp;
  boss.nextAttackAt=0;assert.deepEqual(tick(f,START),[]);assert.equal(boss.mp,25);assert.equal(boss.moonReadyAt,START+60000);
  const v=monsterViews(room,START)[0];assert.deepEqual(v.moonCast,{kind:MOON.kind,mapId:boss.mapId,startsAt:START,endsAt:START+2000});
  assert.deepEqual(v.moonAura,{...nokseraMoonTimeline(START),mapId:boss.mapId});
  assert.deepEqual([v.moonAura.startsAt,v.moonAura.fullStartsAt,v.moonAura.fullEndsAt,v.moonAura.endsAt],[3000,10000,16000,23000]);
  assert.deepEqual(tick(f,START+1999),[]);assert.deepEqual([boss.x,boss.y],xy);assert.equal(ensureVitals(player).hp,hp);
  const hits=tick(f,START+2000);assert.equal(boss.moonCast,null);assert.ok(hits.length);assert.equal(hits[0].skillKind,undefined);
  player.x=boss.x+500;const x=boss.x;tick(f,START+2100);assert.ok(boss.x>x);
  assert.equal(monsterViews(room,START+22000)[0].moonAura,undefined);tick(f,START+22000);assert.equal(boss.moonAura,null);
});

test('보름 시작 포함/종료 제외: 노크 피해0·공격자 동일 고정반환·기여도 보상 불변',()=>{
  for(const [offset,reflect] of [[8999,false],[9000,true],[14999,true],[15000,false],[21999,false],[22000,false]]){
    const f=fixture();full(f);const hp=ensureVitals(f.player).hp,bhp=f.boss.hp;
    const hit=damageMonster(f.room,f.boss,f.player,25,START+offset);
    assert.equal(hit.damage,reflect?0:20);assert.equal(f.boss.hp,bhp-(reflect?0:20));
    assert.equal(ensureVitals(f.player).hp,hp-(reflect?20:0));
    assert.equal(f.boss.contributors.get(f.player.id)||0,reflect?0:20);assert.equal(f.room.energyDrops,undefined);
    if(reflect){assert.equal(hit.reflectedDamage,20);assert.equal(f.room.reflectedVitals.length,1);}
  }
});

test('보스HP1에서도 방어 후 예정피해 전체 반환·보스사망 없음·플레이어 사망/부활 기존처리',()=>{
  for(const bless of [false,true]){
    const f=fixture(),now=full(f);f.boss.hp=1;ensureVitals(f.player).hp=10;
    if(bless)f.player.capricornBlessing={endsAt:now+5000};
    const hit=damageMonster(f.room,f.boss,f.player,5000,now);
    assert.equal(hit.reflectedDamage,4995);assert.equal(f.boss.hp,1);assert.equal(hit.defeated,false);
    assert.equal(f.boss.contributors.size,0);assert.equal(f.room.energyDrops,undefined);
    assert.equal(ensureVitals(f.player).hp>0,bless);if(!bless)assert.equal(ensureVitals(f.player).defeatedAt,now);
  }
});

test('천칭 반사와 달 반사가 서로 재귀하지 않고 공격자 방어를 이중 적용하지 않음',()=>{
  const f=fixture(),now=full(f);f.player.avatar.constellationId='libra';castLibra(f.room,f.player,now);
  const hp=ensureVitals(f.player).hp,bhp=f.boss.hp;
  const hit=damageMonster(f.room,f.boss,f.player,15,now);assert.equal(hit.reflectedDamage,10);
  assert.equal(ensureVitals(f.player).hp,hp-10);assert.equal(f.boss.hp,bhp);
  reflectLibraDamage(f.room,f.player,{sourceMonsterId:f.boss.id},20,now);
  assert.equal(f.boss.hp,bhp);assert.equal(ensureVitals(f.player).hp,hp-10);assert.equal(f.room.reflectedVitals.length,1);
  damagePlayersInArea(f.room,{mapId:f.boss.mapId,x:f.player.x,y:f.player.y,radius:10,sourceMonsterId:f.boss.id},20,now);
  assert.equal(f.boss.hp,bhp);assert.equal(ensureVitals(f.player).hp,hp-10);
});

test('달 반사에도 황소면역·헤라클레스방패·염소부활 유지 및 정확한 만료 경계',()=>{
  const f=fixture(),now=full(f),hp=ensureVitals(f.player).hp;
  f.player.taurusImmuneUntil=now+1;
  f.player.herculesShield={hp:12,absorbed:0,endsAt:now+5000};
  assert.equal(damageMonster(f.room,f.boss,f.player,25,now).reflectedDamage,0);
  assert.equal(ensureVitals(f.player).hp,hp);assert.equal(f.player.herculesShield.hp,12);
  // 면역 만료 후 예정피해20 중 방패12 흡수, HP8 감소 (공격자 방어4를 다시 빼지 않음).
  assert.equal(damageMonster(f.room,f.boss,f.player,25,now+1).reflectedDamage,8);
  assert.equal(ensureVitals(f.player).hp,hp-8);assert.equal(f.player.herculesShield.hp,0);
  assert.equal(f.player.herculesShield.absorbed,12);assert.equal(f.player.herculesShield.endsAt,now+1);
  f.player.herculesShield={hp:50,absorbed:0,endsAt:now+2};
  assert.equal(damageMonster(f.room,f.boss,f.player,25,now+2).reflectedDamage,20);
  assert.equal(f.player.herculesShield.hp,50);
  ensureVitals(f.player).hp=5;f.player.herculesShield={hp:15,absorbed:0,endsAt:now+5000};
  f.player.capricornBlessing={endsAt:now+5000};
  assert.equal(damageMonster(f.room,f.boss,f.player,25,now+3).reflectedDamage,5);
  assert.ok(ensureVitals(f.player).hp>0);assert.equal(ensureVitals(f.player).defeatedAt,null);
  assert.equal(f.player.capricornBlessing,null);assert.equal(f.boss.hp,2000);
});

test('독 공통피해 경로: 보름 중 직접/지속피해 반환·다른맵/접속종료 시 전송/반환 없음',()=>{
  const f=fixture(),now=full(f);f.player.avatar.constellationId='ophiuchus';f.player.x=f.boss.x;f.player.y=f.boss.y;
  const hp=ensureVitals(f.player).hp,bhp=f.boss.hp;
  castOphiuchus(f.room,f.player,now);const direct=advanceOphiuchusVenoms(f.room,now+1000);
  assert.equal(direct[0].targets[0].damage,0);assert.ok(direct[0].targets[0].reflectedDamage>0);
  const after=ensureVitals(f.player).hp;assert.ok(after<hp);assert.equal(f.boss.hp,bhp);
  const poison=advanceOphiuchusPoison(f.room,now+2000);assert.ok(poison.events.length);
  assert.equal(poison.events[0].targets[0].damage,0);assert.ok(ensureVitals(f.player).hp<after);assert.equal(f.boss.hp,bhp);
  for(const mutate of [p=>p.mapId='space-plaza',p=>p.connected=false,p=>p.away=true]){
    const g=fixture(),at=full(g),before=ensureVitals(g.player).hp;mutate(g.player);
    damageMonster(g.room,g.boss,g.player,15,at);assert.equal(ensureVitals(g.player).hp,before);assert.equal(g.room.reflectedVitals,undefined);
  }
});

test('준비 중 죽음/기절/수면/대상이탈/맵변경 취소·달 공개상태 제거, 마나환불 없음',()=>{
  for(const mutate of [f=>{f.boss.hp=0;f.boss.respawnAt=999999;},f=>f.boss.stunUntil=START+1500,
    f=>f.boss.sleepUntil=START+1500,f=>f.player.connected=false,f=>f.player.mapId='space-plaza',
    f=>f.boss.mapId='sun-paradise-3',f=>f.boss.mapId='missing-map']){
    const f=fixture();tick(f,START);mutate(f);assert.deepEqual(tick(f,START+2000),[]);
    assert.equal(f.boss.moonCast,null);assert.equal(f.boss.moonAura,null);assert.equal(f.boss.mp,25);
    const v=monsterViews(f.room,START+2000)[0];assert.equal(v.moonCast,undefined);assert.equal(v.moonAura,undefined);
  }
});

test('달 활성 후 행동불능은 달을 지우지 않으며 사망/재소환/맵변경은 제거',()=>{
  const f=fixture();full(f);f.boss.stunUntil=START+12000;tick(f,START+10000);assert.ok(f.boss.moonAura);
  f.boss.stunUntil=0;damageMonster(f.room,f.boss,f.player,5000,START+16000,{energyRoll:()=>400,bossRoll:()=>2});
  assert.equal(f.boss.hp,0);assert.equal(f.boss.moonAura,null);assert.equal(f.boss.moonCast,null);
  tick(f,f.boss.respawnAt);assert.equal(f.boss.mp,50);assert.equal(f.boss.moonReadyAt,0);assert.equal(f.boss.moonAura,null);
  const g=fixture();full(g);g.boss.mapId='sun-paradise-3';tick(g,START+3000);assert.equal(g.boss.moonAura,null);
});

test('2초 간격40% 확률·실패시 평타/추적·마나/쿨/반경 조건·시간점프 한 번 판단',()=>{
  const f=fixture();let rolls=0;const rng=()=>{rolls++;return .4;};
  f.boss.nextAttackAt=0;assert.ok(tick(f,START,rng).length);assert.equal(rolls,1);
  for(let at=START+50;at<START+2000;at+=50)tick(f,at,rng);assert.equal(rolls,1);
  tick(f,START+2000,()=>{rolls++;return .39999;});assert.equal(rolls,2);assert.ok(f.boss.moonCast);
  for(const setup of [g=>g.boss.mp=24,g=>g.boss.moonReadyAt=START+60000,g=>g.player.x+=2000,g=>{g.boss.attackers.clear();g.boss.targetId=null;g.boss.patrolStartedAt=START+60000;}]){
    const g=fixture();setup(g);let count=0;tick(g,START,()=>{count++;return .9;});assert.equal(count,0);assert.equal(g.boss.moonCast,undefined);
  }
  const g=fixture();let count=0;tick(g,START+1e10,()=>{count++;return .9;});assert.equal(count,1);
  tick(g,START+1e10+1,()=>{count++;return .9;});assert.equal(count,1);
});

test('스킬1/2 준비는 배타적·달 유지 중 스킬1 허용·20초 끝 전 재시전 금지',()=>{
  const f=fixture();f.boss.hornReadyAt=0;f.boss.hornDecisionAt=START;
  tick(f,START);assert.equal(f.boss.pendingAttack.kind,HORN.kind);assert.equal(f.boss.moonCast,undefined);
  tick(f,START+1000);assert.equal(f.boss.moonCast,undefined);tick(f,START+3000);
  tick(f,START+3050);assert.ok(f.boss.moonCast);assert.equal(f.boss.pendingAttack,null);
  const g=fixture();tick(g,START);g.boss.hornReadyAt=0;g.boss.hornDecisionAt=0;
  tick(g,START+1000);assert.equal(g.boss.pendingAttack,undefined);
  tick(g,START+2000);assert.equal(g.boss.pendingAttack.kind,HORN.kind);assert.ok(g.boss.moonAura);
  const h=fixture();full(h);h.boss.moonReadyAt=0;h.boss.mp=50;
  tick(h,START+21999);assert.equal(h.boss.moonCast,null);assert.equal(h.boss.mp,50);
  tick(h,START+22000);assert.ok(h.boss.moonCast);assert.equal(h.boss.mp,25);
});

test('지연된 준비완료는 원래타임라인을 유지하며 이미 끝난 달을 다시 시작하지 않음',()=>{
  const f=fixture();tick(f,START);tick(f,START+30000);assert.equal(f.boss.moonCast,null);assert.equal(f.boss.moonAura,null);
  assert.equal(monsterViews(f.room,START+30000)[0].moonAura,undefined);assert.equal(f.boss.moonReadyAt,START+60000);
});
