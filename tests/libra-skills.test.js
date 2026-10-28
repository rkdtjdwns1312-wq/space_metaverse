import test from 'node:test';
import assert from 'node:assert/strict';
import {castLibra,advanceLibraAuras} from '../server/libra-skills.js';
import {ensureVitals,damagePlayer} from '../server/vitals.js';
import {damagePlayersInArea} from '../server/area-combat.js';
import {damageTargets} from '../server/sagittarius-skills.js';
import {monstersOf,moveMonsters} from '../server/monsters.js';
import {characterAbilities} from '../shared/character-skills.js';

const NOW=1000000;
const player=(id,constellationId='sagittarius',level=4)=>({id,role:'student',connected:true,away:false,
  mapId:'star-origin-1',x:500,y:450,avatar:{level,constellationId},equipmentSlots:[]});
function fixture(level=4){
  const caster=player('caster','libra',level),ally=player('ally'),attacker=player('attacker');
  ally.x+=100;attacker.x=1800;
  const room={players:new Map([caster,ally,attacker].map(p=>[p.id,p])),planets:new Map(),monsters:new Map()};
  castLibra(room,caster,NOW);
  return {room,caster,ally,attacker};
}
const hitArea=(room,target,source,now=NOW+1)=>damagePlayersInArea(room,
  {mapId:target.mapId,x:target.x,y:target.y,radius:0,...source},10,now).find(hit=>hit.targetId===target.id);

test('천칭 LV2~4: 자신과 파티가 다른/없는 아군에게 반사와 공격력 버프 적용',()=>{
  for(const level of [2,3,4])for(const parties of [false,true]){
    const {room,caster,ally,attacker}=fixture(level);
    if(parties)room.parties=new Map([['a',{memberIds:[caster.id]}],['b',{memberIds:[ally.id]}]]);
    const hp=ensureVitals(ally).hp,enemyHp=ensureVitals(attacker).hp;
    const hit=hitArea(room,ally,{sourceId:attacker.id});
    assert.equal(hit.damage,0);assert.equal(hit.reflectedDamage,10);
    assert.equal(ensureVitals(ally).hp,hp);assert.equal(ensureVitals(attacker).hp,enemyHp-10);
    assert.equal(ally.libraBuff.bonus,level-1);
    assert.equal(damagePlayer(caster,10,NOW+1,{room}).damage,0);
  }
});

test('범위 경계 포함·경계 밖 즉시 해제·이동 직후 진입도 틱 갱신 전에 보호',()=>{
  const {room,caster,ally}=fixture(),aura=caster.libraAura;
  ally.x=caster.x+aura.radius;ally.y=caster.y+aura.size*.22;
  assert.equal(damagePlayer(ally,10,NOW+1,{room}).damage,0);
  ally.x+=.01;
  assert.equal(damagePlayer(ally,10,NOW+1,{room}).damage,10);
  advanceLibraAuras(room,NOW+1);assert.equal(ally.libraBuff,null);
  ally.x-=.01;
  assert.equal(damagePlayer(ally,10,NOW+1,{room}).damage,0);
  caster.x-=100;
  assert.equal(damagePlayer(ally,10,NOW+1,{room}).damage,10);
});

test('정확한 만료 시각부터 보호 해제·버프와 시전 상태 정리',()=>{
  const {room,caster,ally}=fixture(),end=caster.libraAura.endsAt;
  assert.equal(damagePlayer(ally,10,end-1,{room}).damage,0);
  assert.equal(damagePlayer(ally,10,end,{room}).damage,10);
  advanceLibraAuras(room,end);
  assert.equal(caster.libraAura,null);assert.equal(ally.libraBuff,null);assert.equal(caster.libraBuff,null);
});

test('시전자 맵 이탈·접속 종료·자리비움·검은별·사망·오라 제거는 즉시 보호 해제',()=>{
  for(const mutate of [p=>p.mapId='space-plaza',p=>p.connected=false,p=>p.away=true,
    p=>p.avatar.blackStar=true,p=>ensureVitals(p).hp=0,p=>p.libraAura=null]){
    const {room,caster,ally}=fixture();mutate(caster);
    assert.equal(damagePlayer(ally,10,NOW+1,{room}).damage,10);
    advanceLibraAuras(room,NOW+1);assert.equal(ally.libraBuff,null);
  }
});

test('다른 맵·방 및 비활동 아군은 보호/공격력 버프에서 제외',()=>{
  for(const mutate of [p=>p.mapId='space-plaza',p=>p.connected=false,p=>p.away=true,p=>p.avatar.blackStar=true]){
    const {room,ally}=fixture();mutate(ally);
    assert.equal(damagePlayer(ally,10,NOW+1,{room}).damage,10);
    advanceLibraAuras(room,NOW+1);assert.equal(ally.libraBuff,null);
  }
  const {room,ally}=fixture();ensureVitals(ally).hp=0;
  assert.equal(damagePlayer(ally,10,NOW+1,{room}),null);
  advanceLibraAuras(room,NOW+1);assert.equal(ally.libraBuff,null);
  const outside=player('outside');
  assert.equal(damagePlayer(outside,10,NOW+1,{room:{players:new Map([[outside.id,outside]])}}).damage,10);
});

test('겹친 천칭: 최고 반사 배율 한 번·시전 장비 스냅샷·강한 영역 종료 후 약한 영역 유지',()=>{
  const {room,caster,ally,attacker}=fixture(),strong=player('strong','libra',2);
  strong.equipmentSlots=['star-pattern-gloves'];room.players.set(strong.id,strong);castLibra(room,strong,NOW);
  strong.equipmentSlots=[];ally.equipmentSlots=['star-pattern-gloves'];
  const enemyHp=ensureVitals(attacker).hp;
  assert.equal(hitArea(room,ally,{sourceId:attacker.id}).reflectedDamage,12);
  assert.equal(ensureVitals(attacker).hp,enemyHp-12);
  assert.equal(room.reflectedVitals.length,1);assert.equal(ally.libraBuff.bonus,3);
  // 아군 자신의 천칭도 다른 영역과 합산하지 않습니다.
  ally.libraAura={...caster.libraAura};
  assert.equal(damagePlayer(ally,10,NOW+1,{room}).reflectedDamage,12);
  strong.libraAura.endsAt=NOW+2;
  assert.equal(damagePlayer(ally,10,NOW+2,{room}).reflectedDamage,10);
});

test('공격자도 천칭 보호 중일 때 한 번만 반사하고 무한 왕복하지 않는다',()=>{
  const {room,ally,attacker}=fixture();attacker.avatar.constellationId='libra';castLibra(room,attacker,NOW);
  const hp=ensureVitals(attacker).hp;
  const hit=hitArea(room,ally,{sourceId:attacker.id});
  assert.equal(hit.reflectedDamage,10);assert.equal(ensureVitals(attacker).hp,hp-6);
  assert.equal(room.reflectedVitals.length,1);assert.equal(ensureVitals(ally).hp,30);
});

test('까마귀 투사체 공통 피해 경로도 아군 반사·범위 밖 피해 처리',()=>{
  const {room,caster,ally,attacker}=fixture();
  attacker.avatar.constellationId='corvus';
  const hit=damageTargets(room,attacker,[{kind:'player',entity:ally}],10,NOW+1).playerTargets[0];
  assert.equal(hit.damage,0);assert.equal(hit.reflectedDamage,10);
  caster.x-=2000;
  assert.equal(damageTargets(room,attacker,[{kind:'player',entity:ally}],10,NOW+2).playerTargets[0].damage,10);
});

test('실제 몬스터 근접 공격은 범위 내 아군 대신 몬스터에 반사한다',()=>{
  const {room,ally}=fixture();
  const monster=monstersOf({players:room.players,planets:new Map()},NOW).get('star-crab');
  Object.assign(monster,{x:ally.x-62,y:ally.y,spawnX:ally.x-62,spawnY:ally.y,hp:50,maxHp:50,
    lastMoveAt:NOW,nextAttackAt:NOW,attackers:new Map([[ally.id,NOW]])});
  room.monsters=new Map([[monster.id,monster]]);
  const hits=moveMonsters(room,NOW+1,()=>0),hit=hits.find(h=>h.targetId===ally.id);
  assert.ok(hit);assert.equal(hit.damage,0);assert.equal(hit.reflectedDamage,3);
  assert.equal(ensureVitals(ally).hp,30);assert.equal(monster.hp,47);
});

test('기존 무적·교사 고정피해 예외 및 방패 우선순위 유지',()=>{
  const {room,ally}=fixture();ally.herculesShield={endsAt:NOW+5000,hp:20,absorbed:0};
  assert.equal(damagePlayer(ally,10,NOW+1,{room}).reflectedDamage,10);
  assert.equal(ally.herculesShield.hp,20);
  ally.taurusImmuneUntil=NOW+5000;
  const hit=damagePlayer(ally,10,NOW+1,{room});assert.equal(hit.immune,true);assert.equal(hit.reflectedDamage,undefined);
  assert.equal(damagePlayer(ally,10,NOW+1,{room,fixedDamage:1}).damage,1);
});

test('천칭 설명은 아군 반사·중복 없음과 기존 4줄 형식을 안내',()=>{
  const {caster}=fixture(),description=characterAbilities(caster)[1].description;
  assert.match(description,/자신과 범위 안 아군이 받을 피해/);assert.match(description,/중복 없음/);
  assert.equal(description.split('\n').length,4);
});
