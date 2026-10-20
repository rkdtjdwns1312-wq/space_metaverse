import test from 'node:test';
import assert from 'node:assert/strict';
import {monstersOf,monsterViews,moveMonsters,damageMonster} from '../server/monsters.js';
import {ensureVitals} from '../server/vitals.js';
import {castLibra} from '../server/libra-skills.js';
import {monsterType} from '../shared/monsters.js';
import {RULES} from '../shared/config.js';
import {damageAfterDefense,defensePowerOf} from '../shared/combat.js';
import {BOSS_MANA,NOKSERA_HORN_BURST,nokseraHornRadius} from '../shared/boss-skills.js';
import {BOSS_RESPAWN_MS} from '../server/boss-lifecycle.js';
const START=1000;
function fixture(id='noksera'){
 const room={players:new Map(),planets:new Map(),...(id==='serena'?{serena:{state:'active'}}:{})};
 const boss=monstersOf(room,START,()=>0).get(id+'-boss');room.monsters=new Map([[boss.id,boss]]);
 const player={id:'a',role:'student',connected:true,away:false,mapId:boss.mapId,x:boss.x+boss.radius+25,y:boss.y,
  avatar:{level:4,constellationId:'taurus'},equipmentSlots:[],inventory:[]};
 room.players.set(player.id,player);boss.attackers.set(player.id,1);boss.targetId=player.id;boss.hornDecisionAt=START;boss.moonReadyAt=Infinity;
 return {room,boss,player};
}
const tick=(f,now)=>moveMonsters(f.room,now,()=>0);

test('보스4종 마나50 생성·스냅샷 읽기 무회복, 일반 몬스터에는 마나 없음',()=>{
 for(const id of ['noksera','leoon','spirit-king','serena']){
  const f=fixture(id);assert.equal(f.boss.mp,50);assert.equal(f.boss.maxMp,50);
  f.boss.mp=13;const v=monsterViews(f.room,START+100000)[0];assert.equal(v.mp,13);assert.equal(v.maxMp,50);assert.equal(f.boss.mp,13);
 }
 const crab=monsterViews({},START).find(m=>m.typeId==='star-crab');assert.equal(crab.mp,0);assert.equal(crab.maxMp,0);
});

test('10초 경계마다5회복·최대50·시간역행/긴점프/비정상시각 안전',()=>{
 for(const id of ['noksera','leoon','spirit-king','serena']){
  const f=fixture(id);f.boss.attackers.clear();f.boss.targetId=null;f.boss.mp=0;
  tick(f,START+9999);assert.equal(f.boss.mp,0);
  tick(f,START+10000);assert.equal(f.boss.mp,5);
  tick(f,START+10000);tick(f,START+500);assert.equal(f.boss.mp,5);
  tick(f,START+20000);assert.equal(f.boss.mp,10);
  tick(f,START+10**12);assert.equal(f.boss.mp,50);
  f.boss.mp=49;tick(f,START+10**12+9999);assert.equal(f.boss.mp,49);
  tick(f,START+10**12+10000);assert.equal(f.boss.mp,50);
  const next=f.boss.nextManaRegenAt;for(const bad of [NaN,Infinity,-Infinity])assert.deepEqual(tick(f,bad),[]);
  assert.equal(f.boss.nextManaRegenAt,next);assert.equal(f.boss.mp,50);
 }
});

test('사망 중 마나회복 없음·24시간 재소환50·세레나 재생성50',()=>{
 for(const id of ['noksera','leoon','spirit-king','serena']){
  const f=fixture(id);Object.assign(f.boss,{hp:0,mp:7,respawnAt:START+BOSS_RESPAWN_MS,pendingAttack:{kind:NOKSERA_HORN_BURST.kind}});
  tick(f,START+20000);assert.equal(f.boss.mp,7);assert.equal(f.boss.pendingAttack,null);
  if(id==='serena'){
   tick(f,START+BOSS_RESPAWN_MS);assert.equal(f.boss.hp,0);assert.equal(f.boss.mp,7);
   f.room.monsters.delete(f.boss.id);assert.equal(monstersOf(f.room,START+BOSS_RESPAWN_MS).get('serena-boss').mp,50);
  }else{tick(f,START+BOSS_RESPAWN_MS);assert.equal(f.boss.hp,f.boss.maxHp);assert.equal(f.boss.mp,50);assert.equal(f.boss.hornReadyAt,0);}
 }
});

test('노크세라 고정 경고3초·마나15·기존방어 적용한200% 한 번 타격과 payload',()=>{
 const f=fixture();const {boss,room,player}=f,position=[boss.x,boss.y],hp=ensureVitals(player).hp;
 assert.deepEqual(tick(f,START),[]);assert.equal(boss.mp,35);assert.equal(boss.hornReadyAt,START+NOKSERA_HORN_BURST.cooldownMs);
 const warning=monsterViews(room,START)[0].warning;
 assert.deepEqual(warning,{kind:'noksera-horn-burst',x:position[0],y:position[1],radius:nokseraHornRadius(boss),startsAt:START,endsAt:START+3000});
 assert.ok(Math.abs(warning.radius-590.4)<1e-9);
 tick(f,START+1500);assert.deepEqual([boss.x,boss.y],position);assert.equal(boss.moving,false);assert.equal(ensureVitals(player).hp,hp);
 tick(f,START+2999);assert.equal(ensureVitals(player).hp,hp);
 const hits=tick(f,START+3000);assert.equal(hits.length,1);assert.equal(hits[0].skillKind,warning.kind);
 assert.equal(hits[0].warningX,position[0]);assert.equal(hits[0].warningY,position[1]);assert.equal(hits[0].warningRadius,warning.radius);
 const damage=damageAfterDefense(40,defensePowerOf(4,'taurus',player));assert.equal(hits[0].damage,damage);assert.equal(ensureVitals(player).hp,hp-damage);
 assert.equal(boss.pendingAttack,null);assert.equal(monsterViews(room,START+3000)[0].warning,undefined);assert.deepEqual(tick(f,START+3000),[]);
});

test('시전 중심은 보스/대상이 움직여도 고정·탈출 성공시 attackOnly 이벤트만',()=>{
 const f=fixture();tick(f,START);const warning={...f.boss.pendingAttack};f.boss.x+=150;f.player.x=warning.x+warning.radius+RULES.radius+1;
 const hp=ensureVitals(f.player).hp,hits=tick(f,START+3000);assert.equal(hits.length,1);assert.equal(hits[0].attackOnly,true);
 assert.equal(hits[0].x,warning.x);assert.equal(hits[0].y,warning.y);assert.equal(ensureVitals(f.player).hp,hp);
});

test('원형 경계 바로 안쪽 포함, 바깥/다른맵/비접속/자리비움/교사 제외, 여러 아군에 한 번씩',()=>{
 const f=fixture();tick(f,START);const warning=f.boss.pendingAttack;
 for(const id of ['inside','edge','outside','other','offline','away','teacher']){
  const p={...f.player,id,avatar:{...f.player.avatar},x:warning.x+warning.radius+RULES.radius,y:warning.y};
  if(id==='edge')p.x-=1e-7;if(id==='inside')p.x=warning.x;if(id==='outside')p.x+=.1;if(id==='other')p.mapId='space-plaza';
  if(id==='offline')p.connected=false;if(id==='away')p.away=true;if(id==='teacher')p.role='teacher';
  f.room.players.set(id,p);
 }
 const hits=tick(f,START+3000);assert.deepEqual(hits.map(h=>h.targetId).sort(),['a','edge','inside']);
});

test('전투대상 없이 시전하지 않으며 마나부족·쿨타임에는 기존 일반공격',()=>{
 const idle=fixture();idle.boss.attackers.clear();tick(idle,START);assert.equal(idle.boss.pendingAttack,undefined);assert.equal(idle.boss.mp,50);
 for(const mana of [0,14]){const f=fixture();f.boss.mp=mana;const hits=tick(f,START);assert.ok(hits.length);assert.equal(hits[0].skillKind,undefined);assert.equal(f.boss.mp,mana);}
 const f=fixture();tick(f,START);tick(f,START+3000);const hits=tick(f,START+5000);assert.ok(hits.length);assert.equal(hits[0].skillKind,undefined);
 ensureVitals(f.player).hp=100;f.boss.attackers.set(f.player.id,2);tick(f,START+20000);assert.equal(f.boss.pendingAttack?.kind,NOKSERA_HORN_BURST.kind);
});

test('사망·기절·수면 취소, 틱 사이에 끝난 상태이상도 취소하며 마나환불 없음',()=>{
 for(const status of ['dead','stunUntil','sleepUntil'])for(const delayed of [false,true]){
  const f=fixture();tick(f,START);const hp=ensureVitals(f.player).hp;
  if(status==='dead'){f.boss.hp=0;f.boss.respawnAt=START+BOSS_RESPAWN_MS;}else f.boss[status]=START+1500;
  assert.deepEqual(tick(f,START+(delayed?3000:500)),[]);assert.equal(f.boss.pendingAttack,null);assert.equal(f.boss.mp,35);assert.equal(ensureVitals(f.player).hp,hp);
 }
 const f=fixture();tick(f,START);damageMonster(f.room,f.boss,f.player,5000,START+500,{energyRoll:()=>400,bossRoll:()=>2});assert.equal(f.boss.pendingAttack,null);assert.deepEqual(tick(f,START+3000),[]);
});

test('대상 이탈/사망/접속해제·맵 변경/삭제 시 폭발 없음',()=>{
 for(const mutate of [f=>f.player.mapId='space-plaza',f=>ensureVitals(f.player).hp=0,f=>f.player.connected=false,
  f=>f.room.players.clear(),f=>f.boss.mapId='sun-paradise-3',f=>f.boss.mapId='removed-map']){
  const f=fixture();tick(f,START);mutate(f);assert.deepEqual(tick(f,START+3000),[]);assert.equal(f.boss.pendingAttack,null);
 }
});

test('천칭 반사는 기존 피해 경로로 한 번만 반환하며 보스 마나를 재차 소비하지 않음',()=>{
 const f=fixture();f.player.avatar.constellationId='libra';castLibra(f.room,f.player,START);const hp=ensureVitals(f.player).hp;
 tick(f,START);const before=f.boss.hp,hits=tick(f,START+3000);assert.equal(hits.length,1);assert.equal(hits[0].damage,0);
 assert.ok(hits[0].reflectedDamage>0);assert.equal(f.boss.hp,before-hits[0].reflectedDamage);assert.equal(ensureVitals(f.player).hp,hp);assert.equal(f.boss.mp,35);
});

test('성령왕·세레나 경고2초/기존30공격/쿨3초는 유지되고 마나는 소비하지 않음',()=>{
 for(const id of ['spirit-king','serena']){
  const f=fixture(id);tick(f,START);assert.equal(f.boss.pendingAttack.endsAt,START+2000);assert.equal(f.boss.pendingAttack.kind,undefined);
  const hits=tick(f,START+2000);assert.equal(hits.length,1);assert.equal(hits[0].skillKind,undefined);
  assert.equal(hits[0].damage,damageAfterDefense(monsterType(id).power,defensePowerOf(4,'taurus',f.player)));
  assert.equal(f.boss.nextAttackAt,START+5000);assert.equal(f.boss.mp,BOSS_MANA.max);
 }
});

test('2초 판단 간격·40% 경계, 실패 시 평타/추적 유지·매틱 난수 금지',()=>{
 const f=fixture();let rolls=0;const random=()=>{rolls++;return .4;};
 f.boss.hornDecisionAt=START+2000;
 assert.ok(moveMonsters(f.room,START,random).length);assert.equal(rolls,0);assert.equal(f.boss.mp,50);
 for(let now=START+50;now<START+2000;now+=50)moveMonsters(f.room,now,random);
 assert.equal(rolls,0);assert.ok(moveMonsters(f.room,START+2000,random).length);assert.equal(rolls,1);assert.equal(f.boss.pendingAttack,undefined);
 for(let now=START+2050;now<START+4000;now+=50)moveMonsters(f.room,now,random);
 assert.equal(rolls,1);
 moveMonsters(f.room,START+4000,()=>{rolls++;return .399999;});assert.equal(rolls,2);assert.equal(f.boss.mp,35);
 assert.equal(f.boss.pendingAttack.kind,NOKSERA_HORN_BURST.kind);
 const chase=fixture();chase.player.x=chase.boss.x+500;const x=chase.boss.x;
 moveMonsters(chase.room,START+100,()=>.9);assert.ok(chase.boss.x>x);assert.equal(chase.boss.mp,50);
});

test('반경 밖·마나부족·쿨타임 중 판정 없음, 긴 시간 점프도 한 번만 시도',()=>{
 for(const setup of [f=>f.player.x=f.boss.x+nokseraHornRadius(f.boss)+1000,f=>f.boss.mp=14,f=>f.boss.hornReadyAt=START+20000]){
  const f=fixture();setup(f);let rolls=0;moveMonsters(f.room,START,()=>{rolls++;return 0;});assert.equal(rolls,0);assert.equal(f.boss.pendingAttack,undefined);
 }
 const f=fixture();let rolls=0;const random=()=>{rolls++;return .9;};
 moveMonsters(f.room,START+10**10,random);assert.equal(rolls,1);assert.equal(f.boss.mp,50);
 moveMonsters(f.room,START+10**10+1,random);assert.equal(rolls,1);
 // 쿨타임 만료는 사용 보장이 아닙니다.
 const cooled=fixture();tick(cooled,START);tick(cooled,START+3000);
 moveMonsters(cooled.room,START+20000,()=>.8);assert.equal(cooled.boss.pendingAttack,null);assert.equal(cooled.boss.mp,45);
});
