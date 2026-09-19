import test from 'node:test';
import assert from 'node:assert/strict';
import {CONSTELLATIONS} from '../shared/constellations.js';
import {defensePowerOf,damageAfterDefense} from '../shared/combat.js';
import {MONSTER_COMBAT} from '../shared/monsters.js';
import {monstersOf,moveMonsters,strikeMonster,selectMonsterTarget,MONSTER_RULES} from '../server/monsters.js';
import {ensureVitals,damagePlayer,playerVitals} from '../server/vitals.js';
import {recoverDefeated,RECOVERY_MS} from '../server/battle-recovery.js';
import {RoomStore} from '../server/rooms.js';
import {fromRecord,toRecord,pinHash} from '../server/persistent-rooms.js';
import {advance} from '../server/world.js';
import {PLAZA_ID} from '../shared/config.js';

const player=(id,constellationId='sagittarius',level=5)=>({id,role:'student',connected:true,away:false,mapId:'star-origin-1',x:198,y:280,avatar:{level,xp:0,constellationId},input:{x:0,y:0,at:0}});
function fixture(id='rabbit'){
 const room={players:new Map(),planets:new Map()},m=monstersOf(room,0).get(id);
 room.monsters=new Map([[id,m]]);return {room,m};
}
test('16종 모든 단계 기본 방어력+계열 보정·0하한, 피해1하한, 위조된 방어력 무시',()=>{
 for(const c of CONSTELLATIONS)for(const level of [1,2,3,4,5]){
   const expected=level===1?0:Math.max(0,[0,0,1,2,3][level-1]+({'제작계':-1,'생산계':-1,'공격계':-1,'수호계':1}[c.type]||0));
   assert.equal(defensePowerOf(level,c.id),expected);
   const p=player('p',c.id,level);p.combat={defensePower:999};
   const result=damagePlayer(p,2,0);assert.equal(result.damage,Math.max(1,2-expected));
 }
 assert.equal(damageAfterDefense(5,0),5);assert.equal(damageAfterDefense(5,5),1);assert.equal(damageAfterDefense(5,9),1);
});
test('공격계3종의 LV2~5 방어0/0/1/2와 실제 몬스터 공격5의 피해5/5/4/3',()=>{
 for(const id of ['ophiuchus','sagittarius','corona-borealis'])for(const [level,defense,damage] of [[2,0,5],[3,0,5],[4,1,4],[5,2,3]]){
   const p=player('p',id,level);assert.equal(defensePowerOf(level,id),defense);
   const before=playerVitals(p).hp.current;assert.equal(damagePlayer(p,5,0).damage,damage);assert.equal(playerVitals(p).hp.current,before-damage);
 }
});
test('단계별 이동량·방향 주기·공격 간격이 정확히1/1.3/1.69배다',()=>{
 for(const [id,power] of [['rabbit',2],['lion',3],['star-keeper',5]]){
   const {room,m}=fixture(id),factor=MONSTER_COMBAT[m.mapId].speedFactor;Object.assign(m,{x:600,y:450});
   moveMonsters(room,0,()=>0);moveMonsters(room,50,()=>0);
   assert.ok(Math.abs(m.x-600-MONSTER_RULES.speed*factor*.05)<1e-8);
   assert.ok(Math.abs(m.nextDirectionAt-1000/factor)<1e-8);
   const p=player('p','gemini');Object.assign(p,{mapId:m.mapId,x:m.x+m.radius+24,y:m.y});room.players.set(p.id,p);
   m.attackers.set(p.id,1);const hit=moveMonsters(room,100,()=>0)[0];assert.ok(hit);assert.equal(hit.damage,Math.max(1,power-2));
   assert.equal(m.nextAttackAt,100+1000/factor);
   assert.equal(moveMonsters(room,m.nextAttackAt-1,()=>0).length,0);
   assert.equal(moveMonsters(room,m.nextAttackAt,()=>0).length,1);
 }
});
test('선공 없음·공격자만 후보·수호/특수/나머지·같은 순위 최신·이탈 후보 제거',()=>{
 const {room,m}=fixture();const people=[player('a'),player('b','aquarius'),player('s','aries'),player('g','leo'),player('g2','libra')];
 for(const p of people)room.players.set(p.id,p);
 assert.equal(moveMonsters(room,0,()=>0).length,0);assert.equal(m.targetId,null);
 const hit=p=>{Object.assign(p,{x:m.x-62,y:m.y,facing:{x:1,y:0}});assert.ok(strikeMonster(room,p,1,10));};
 hit(people[0]);assert.equal(m.targetId,'a','공격하지 않은 수호계는 대상 아님');
 hit(people[1]);assert.equal(m.targetId,'b');hit(people[2]);assert.equal(m.targetId,'s');hit(people[0]);assert.equal(m.targetId,'s');
 hit(people[3]);assert.equal(m.targetId,'g');hit(people[2]);assert.equal(m.targetId,'g');
 hit(people[4]);assert.equal(m.targetId,'g2');hit(people[3]);assert.equal(m.targetId,'g');
 people[3].mapId=PLAZA_ID;assert.equal(selectMonsterTarget(room,m).id,'g2');
 people[4].connected=false;assert.equal(selectMonsterTarget(room,m).id,'s');
 ensureVitals(people[2]).hp=0;assert.equal(selectMonsterTarget(room,m).id,'a');
 people[0].away=true;assert.equal(selectMonsterTarget(room,m).id,'b');people[1].avatar.blackStar=true;assert.equal(selectMonsterTarget(room,m),null);
 assert.equal(m.attackers.size,0);assert.equal(m.hp,m.maxHp);
});
test('마지막 공격자 이탈/사망 즉시 전회복, 남은 공격자는 회복 안 함, 새 공격 피해 유지',()=>{
 const {room,m}=fixture(),a=player('a'),b=player('b');room.players.set(a.id,a);room.players.set(b.id,b);
 m.hp=7;m.attackers.set(a.id,1);m.attackers.set(b.id,2);a.mapId=PLAZA_ID;
 assert.equal(selectMonsterTarget(room,m).id,b.id);assert.equal(m.hp,7);assert.equal(m.mapExitCount,1);
 b.mapId=PLAZA_ID;assert.equal(selectMonsterTarget(room,m),null);assert.equal(m.hp,20);assert.equal(m.mapExitCount,0);
 Object.assign(b,{mapId:m.mapId,x:m.x-62,y:m.y,facing:{x:1,y:0}});
 strikeMonster(room,b,3,0);ensureVitals(b).hp=1;m.nextAttackAt=0;
 assert.equal(moveMonsters(room,0)[0].defeated,true);assert.equal(m.hp,20);assert.equal(m.targetId,null);
 // 같은 틱 사이에 마지막 공격자가 떠나고 새로운 공격이 도착해도 새 피해를 지우지 않습니다.
 ensureVitals(b).hp=40;m.attackers.set(a.id,3);m.hp=5;
 assert.equal(strikeMonster(room,b,3,1).hp,17);
 strikeMonster(room,b,99,2);assert.equal(m.hp,0);selectMonsterTarget(room,m);assert.equal(m.hp,0);
 moveMonsters(room,MONSTER_RULES.respawnMs+1);assert.equal(m.hp,0,'처치 몬스터는 10초 대기');
 moveMonsters(room,MONSTER_RULES.respawnMs+2);assert.equal(m.hp,20);assert.equal(m.mapExitCount,0);
});
test('맵 이탈은 몬스터별 한 번만 누적, 3회 전회복 후 추적 유지와0초기화, 비공격자 제외',()=>{
 const {room,m}=fixture(),anchor=player('anchor','leo'),visitor=player('visitor'),spectator=player('spectator');
 for(const p of [anchor,visitor,spectator])room.players.set(p.id,p);
 m.hp=9;m.attackers.set(anchor.id,1);spectator.mapId=PLAZA_ID;selectMonsterTarget(room,m);assert.equal(m.mapExitCount,0);
 const attack=()=>{Object.assign(visitor,{mapId:m.mapId,x:m.x-62,y:m.y,facing:{x:1,y:0}});strikeMonster(room,visitor,1,0);};
 for(let n=1;n<=3;n++){
   attack();const damaged=m.hp;visitor.mapId=PLAZA_ID;selectMonsterTarget(room,m);
   assert.equal(m.targetId,anchor.id);assert.equal(m.hp,n===3?20:damaged);assert.equal(m.mapExitCount,n===3?0:n);
   selectMonsterTarget(room,m);assert.equal(m.mapExitCount,n===3?0:n,'반복 틱 중복 없음');
   visitor.mapId=m.mapId;selectMonsterTarget(room,m);visitor.mapId=PLAZA_ID;selectMonsterTarget(room,m);
   assert.equal(m.mapExitCount,n===3?0:n,'공격 없는 재입장/이탈 미집계');
 }
 const other=monstersOf({players:room.players},0).get('rabbit');assert.equal(other.mapExitCount,0);
 attack();visitor.connected=false;selectMonsterTarget(room,m);assert.equal(m.mapExitCount,0,'접속 끊김은 맵 이탈 아님');
 anchor.away=true;selectMonsterTarget(room,m);assert.equal(m.hp,20);assert.equal(m.mapExitCount,0);
});
test('추격은 대상 방향으로 이동하고 근접 전에는 피해 없음·스냅샷/재접속은 회복하지 않음',()=>{
 const {room,m}=fixture(),p=player('p');room.players.set(p.id,p);Object.assign(p,{x:m.x-62,y:m.y,facing:{x:1,y:0}});
 strikeMonster(room,p,1,0);p.x=m.x+200;const start=m.x;
 assert.equal(moveMonsters(room,50,()=>0).length,0);assert.ok(m.x>start);assert.equal(ensureVitals(p).hp,40);
 p.x=m.x+70;const hit=moveMonsters(room,200,()=>0)[0];assert.equal(hit.damage,1);
 assert.equal(playerVitals(p).hp.current,39);p.connected=false;moveMonsters(room,250);p.connected=true;
 assert.equal(playerVitals(p).hp.current,39);assert.equal(m.targetId,null);
});
test('HP0 이동 중단→3초 뒤 광장 회복·소유물 유지',()=>{
 const {room,m}=fixture(),p=player('p','gemini',2);room.unattended=true;room.players.set(p.id,p);
 p.starShards=123;p.inventory=[{id:'pencil',quantity:2}];const possessions=JSON.stringify([p.starShards,p.inventory,p.avatar]);
 damagePlayer(p,99,0);p.input={x:1,y:0,at:1};const x=p.x;advance(room,1);assert.equal(p.x,x);
 assert.equal(recoverDefeated(room,RECOVERY_MS-1).length,0);assert.equal(recoverDefeated(room,RECOVERY_MS).length,1);
 assert.equal(p.mapId,PLAZA_ID);assert.deepEqual(playerVitals(p),{hp:{current:10,max:10},mp:{current:10,max:10},defeated:false});
 assert.equal(JSON.stringify([p.starShards,p.inventory,p.avatar]),possessions);
});
test('과거 LV5/LV6 저장자료는 계보·자산을 보존하여 LV5초월체로 읽고 원본을 변경하지 않는다',()=>{
 const store=new RoomStore(),{room}=store.create({title:'마이그레이션',allowedNames:['1']},'t'),p=store.add(room,'1','student','s');
 room.createdAt=Date.now();p.pin=pinHash('1234');p.starShards=321;p.avatar.constellationId='leo';
 for(const level of [5,6]){
   p.avatar.level=level;p.avatar.xp=level===5?17:0;p.avatar.form=level===5?'constellation':'transcendent';
   const record=toRecord(room),before=structuredClone(record),restored=fromRecord(record).players.get(p.id);
   assert.equal(restored.avatar.level,5);assert.equal(restored.avatar.xp,0);assert.equal(restored.avatar.form,'transcendent');assert.equal(restored.avatar.constellationId,'leo');assert.equal(restored.starShards,321);assert.deepEqual(record,before);
 }
});
