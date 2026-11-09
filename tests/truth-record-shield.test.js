import test from 'node:test';
import assert from 'node:assert/strict';
import {damagePlayer,ensureVitals} from '../server/vitals.js';
import {RoomStore,playerEffectsView} from '../server/rooms.js';
import {equip,unequip} from '../server/equipment.js';
import {equipmentOf,equipmentStatText} from '../shared/equipment.js';
import {activeStatuses} from '../shared/statuses.js';
import {defeatRecordPlayer} from '../server/star-record-challenge.js';
import {beginSerenaSkill,tickSerenaSkills} from '../server/serena-skills.js';
import {tickDarkStarSkills} from '../server/dark-star-skills.js';

const NOW=100000;
const makePlayer=(id='truth-record')=>({id:'p',role:'student',connected:true,away:false,mapId:'battle',x:100,y:100,
  avatar:{level:5,constellationId:'aquarius'},equipmentSlots:[id,null,null],inventory:[],effects:[],input:{x:1,y:0,at:NOW}});
const roomOf=p=>({players:new Map([[p.id,p]])});
const ready=(p,now)=>activeStatuses({...p,effects:playerEffectsView(p,false,now)},now).some(s=>s.id==='truth-record-shield');

test('진리 보호막은 첫 타격만 완전히 막고 사용180초 경계에서 1회 재준비된다',()=>{
  const p=makePlayer(),hp=ensureVitals(p).hp;
  assert.equal(ready(p,NOW),true);
  assert.equal(damagePlayer(p,10,NOW,{fixedDamage:10}).truthRecordShield,true);
  assert.equal(ensureVitals(p).hp,hp);assert.equal(p.damageNumbers,undefined);
  assert.equal(ready(p,NOW),false);
  assert.equal(damagePlayer(p,2,NOW,{fixedDamage:2}).damage,2,'same-tick second hit is not blocked');
  assert.equal(damagePlayer(p,2,NOW+179999,{fixedDamage:2}).damage,2);
  assert.equal(ready(p,NOW+180000),true);
  assert.equal(damagePlayer(p,9999,NOW+180000,{fixedDamage:9999}).truthRecordShield,true);
  assert.equal(ensureVitals(p).hp,hp-4);assert.equal(ready(p,NOW+180000),false);
});

test('준비된 보호막은 장시간 기다려도 한 번만 저장되고 피해0에는 소모되지 않는다',()=>{
  const p=makePlayer();
  assert.equal(damagePlayer(p,0,NOW,{fixedDamage:0}).damage,0);assert.equal(ready(p,NOW),true);
  assert.equal(damagePlayer(p,4,NOW+1800000,{fixedDamage:4}).truthRecordShield,true);
  assert.equal(damagePlayer(p,4,NOW+1800000,{fixedDamage:4}).damage,4);
});

test('실제 장착해제·강화장비 교체·세션 재접속은 보호막 대기시간을 초기화하지 않는다',()=>{
  const p=makePlayer();damagePlayer(p,5,NOW,{fixedDamage:5});
  unequip(p,1);assert.equal(ready(p,NOW+1),false);
  p.inventory.push({id:'truth-record+9',quantity:1});equip(p,'truth-record+9',2);
  const store=new RoomStore(),room={...roomOf(p),code:'ABCDEF'},token='a'.repeat(64);
  store.rooms.set(room.code,room);store.sessions.set(token,{room,player:p});
  p.connected=false;p.expiresAt=NOW+10000;
  const session=store.resume(token,'new-socket',NOW+2);
  assert.equal(session.player,p);assert.equal(ready(p,NOW+2),false);
  assert.equal(damagePlayer(p,1,NOW+2,{fixedDamage:1}).damage,1);
  assert.equal(damagePlayer(p,1,NOW+180000,{fixedDamage:1}).truthRecordShield,true);
});

test('기본·강화9단계는 공격력과 초기화 확률을 유지하고 같은 보호막을 적용한다',()=>{
  for(let stage=0;stage<=9;stage++){
    const id='truth-record'+(stage?'+'+stage:''),item=equipmentOf(id),n=Math.max(0,stage-6),p=makePlayer(id);
    assert.equal(item.bonus.attack,3+n*(n+1)/2);
    assert.equal(item.cooldownResetChance,(40+Math.min(stage,6)*5)/100);
    assert.match(equipmentStatText(item),/180초마다 모든 피해 1회 완전 차단/);
    assert.equal(damagePlayer(p,9999,NOW).truthRecordShield,true);
  }
  const p=makePlayer(null);assert.equal(ready(p,NOW),false);
  assert.equal(damagePlayer(p,1,NOW,{fixedDamage:1}).damage,1);
});

test('황소·천칭 무적과 망토가 먼저 막은 타격은 진리 보호막을 중복 소모하지 않는다',()=>{
  const p=makePlayer(),room=roomOf(p);p.taurusImmuneUntil=NOW+100;
  assert.equal(damagePlayer(p,5,NOW,{room}).immune,true);assert.equal(ready(p,NOW),true);
  p.avatar.constellationId='libra';p.libraAura={endsAt:NOW+100,mapId:p.mapId,size:100,radius:100};
  assert.equal(damagePlayer(p,5,NOW,{room,fixedDamage:5}).immune,true);assert.equal(ready(p,NOW),true);
  assert.equal(defeatRecordPlayer(room,p,NOW).immune,true);assert.equal(ready(p,NOW),true);
  p.libraAura=null;p.taurusImmuneUntil=0;p.equipmentSlots[1]='dream-guardian-cloak';
  assert.equal(damagePlayer(p,5,NOW,{room}).guardian,true);assert.equal(ready(p,NOW),true);
  assert.equal(damagePlayer(p,5,NOW,{room}).truthRecordShield,true);
  assert.equal(p.dreamGuardianNextAt,NOW+30000);
});

test('즉사 공통 경로와 무적 무시 패턴도 진리 보호막을 한 번만 소모한다',()=>{
  for(const bypassProtection of [false,true]){
    const p=makePlayer(),room=roomOf(p),hp=ensureVitals(p).hp;
    const hit=defeatRecordPlayer(room,p,NOW,{bypassProtection});
    assert.equal(hit.truthRecordShield,true);assert.equal(hit.damage,0);assert.equal(hit.defeated,false);
    assert.equal(ensureVitals(p).hp,hp);assert.equal(p.battleVitals.defeatedAt,null);assert.equal(p.input.x,1);
    assert.equal(defeatRecordPlayer(room,p,NOW+1,{bypassProtection}).defeated,true);
    assert.equal(p.battleVitals.defeatedAt,NOW+1);
  }
});

test('세레나 검은별 즉사는 보호막1회로 막고 다음 즉사는 정상 처리한다',()=>{
  const p=makePlayer(),room=roomOf(p),boss={id:'serena',typeId:'serena',mapId:p.mapId,x:100,y:100,hp:100,mp:100};
  assert.equal(beginSerenaSkill(room,boss,'black',NOW,()=>0),true);
  const hits=tickSerenaSkills(room,boss,NOW+10000);
  assert.equal(hits.length,1);assert.equal(hits[0].truthRecordShield,true);assert(ensureVitals(p).hp>0);
  assert.equal(tickSerenaSkills(room,boss,NOW+10001).length,0);
  assert.equal(beginSerenaSkill(room,boss,'black',NOW+30000,()=>0),true);
  assert.equal(tickSerenaSkills(room,boss,NOW+40000)[0].defeated,true);
});

test('검은별 퍼즐 실패·흡수 즉사도 보호막을 한 번만 사용한다',()=>{
  const p=makePlayer(),room=roomOf(p),boss={id:'dark',typeId:'dark-star',mapId:p.mapId,x:100,y:100,hp:100};
  boss.darkStarSkills={mapId:p.mapId,cards:[],puzzleEndsAt:NOW,absorption:null,absorptionQueue:[],satellites:[],paths:[],projectiles:[]};
  assert.equal(tickDarkStarSkills(room,boss,NOW)[0].truthRecordShield,true);
  boss.darkStarSkills.absorption={endsAt:NOW+180000,x:100,y:100,radius:100};
  assert.equal(tickDarkStarSkills(room,boss,NOW+180000)[0].truthRecordShield,true);
  boss.darkStarSkills.absorption={endsAt:NOW+180001,x:100,y:100,radius:100};
  assert.equal(tickDarkStarSkills(room,boss,NOW+180001)[0].defeated,true);
});
