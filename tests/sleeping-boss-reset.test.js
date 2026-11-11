import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync,readFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve,sep} from 'node:path';
import {PersistentRoomStore,toRecord,fromRecord} from '../server/persistent-rooms.js';
import {nextSleepingBossResetAt,needsSleepingBossReset,restoreSleepingBossStatues,settleBossDeaths,
  validateDarkStarState,validateStarRecordState,validateForgottenConstellationState,validateTruthCreatorState} from '../server/boss-lifecycle.js';
import {DARK_STAR} from '../shared/dark-star.js';
import {STAR_RECORD} from '../shared/star-record.js';
import {FORGOTTEN_CONSTELLATION} from '../shared/forgotten-constellation.js';
import {TRUTH_CREATOR,TRUTH_CREATOR_REQUIRED_BOSSES} from '../shared/truth-creator.js';
import {summonDarkStar} from '../server/dark-star.js';
import {summonStarRecord} from '../server/star-record.js';
import {summonForgottenConstellation} from '../server/forgotten-constellation.js';
import {summonTruthCreator} from '../server/truth-creator.js';
import {monstersOf,damageMonster,monsterViews} from '../server/monsters.js';
import {mapOf} from '../shared/config.js';
import {chargeHuntingStation} from '../server/hunting-time.js';
const bosses=[['darkStar',DARK_STAR,summonDarkStar,validateDarkStarState],['starRecord',STAR_RECORD,summonStarRecord,validateStarRecordState],
  ['forgottenConstellation',FORGOTTEN_CONSTELLATION,summonForgottenConstellation,validateForgottenConstellationState],['truthCreator',TRUTH_CREATOR,summonTruthCreator,validateTruthCreatorState]];
const at=s=>Date.parse(s+'+09:00'),before=at('2026-11-12T06:59:59'),opening=at('2026-11-12T07:00:00');
function fixture(t,initial=before){
  const dir=mkdtempSync(join(tmpdir(),'sleeping-reset-'));let now=initial,store=new PersistentRoomStore(dir,{clock:()=>now});
  const {room}=store.transact(()=>store.create({title:'석상 검사',allowedNames:['1']},'teacher'));
  const {player}=store.transact(()=>store.join({code:room.code,nickname:'1',pin:'1234'},'student')),code=room.code,id=player.id;
  t.after(()=>{store.close();assert(resolve(dir).startsWith(resolve(tmpdir())+sep));rmSync(dir,{recursive:true,force:true});});
  return {get store(){return store;},get room(){return store.rooms.get(code);},get player(){return store.rooms.get(code).players.get(id);},
    get now(){return now;},set now(value){now=value;},disk:()=>JSON.parse(readFileSync(join(dir,code+'.json'),'utf8')),
    restart(){store.close();store=new PersistentRoomStore(dir,{clock:()=>now});store.transact(()=>store.open({code},'teacher'));}};
}
function summonAll(f){
  f.store.transact(()=>{
    f.player.serenaProgress={highestLevel:5,bossKills:[...TRUTH_CREATOR_REQUIRED_BOSSES]};
    chargeHuntingStation(f.player,'math',f.now);
    for(const [,spec,summon] of bosses){const statue=mapOf(spec.mapId).objects.find(o=>o.id===spec.statueId);
      Object.assign(f.player,{mapId:spec.mapId,x:statue.x,y:statue.y+90});summon(f.room,f.player,f.now);}
  });
}
test('다음 한국 07시 계산: 직전·정각·월말·연말·윤일, 손상된 저장 시각 거부',()=>{
  for(const [start,end] of [['2026-11-12T06:59:59','2026-11-12T07:00:00'],['2026-11-12T07:00:00','2026-11-13T07:00:00'],
    ['2026-11-30T22:00:00','2026-12-01T07:00:00'],['2026-12-31T22:00:00','2027-01-01T07:00:00'],['2028-02-28T22:00:00','2028-02-29T07:00:00']])
    assert.equal(nextSleepingBossResetAt(at(start)),at(end));
  for(const [,spec,,validate] of bosses)for(const resetAt of [-1,NaN,Infinity,opening+1,null])
    assert.throws(()=>validate({state:'active',respawnAt:null,monsterId:spec.monsterId,resetAt}));
});
test('4종 실제 소환은 다음07시를 저장하고 살아 있는 보스·패턴·자식·수면 구름만 정리한다',t=>{
  const f=fixture(t);summonAll(f);const studentData=structuredClone(toRecord(f.room).students);
  f.room.serena={state:'active',respawnAt:null,monsterId:'serena-boss'};
  f.room.bossRespawns={'noksera-boss':opening+86400000};monstersOf(f.room,before);
  const otherBosses=structuredClone([...f.room.monsters].filter(([,m])=>['noksera','leoon','spirit-king','serena'].includes(m.typeId)));
  for(const [key,spec] of bosses)assert.equal(f.disk()[key].resetAt,opening,spec.typeId);
  const dark=f.room.monsters.get(DARK_STAR.monsterId),truth=f.room.monsters.get(TRUTH_CREATOR.monsterId);
  dark.darkStarSkills={cards:[{id:'card'}],paths:[{}],projectiles:[{}],satellites:[{}]};
  truth.truthCreatorSentries={ids:new Set(['sentry'])};truth.truthCreatorBlue={orbs:[{sessions:new Map([['1',{}]])}]};truth.truthCreatorGalaxy={orbs:[{}]};truth.truthCreatorChasers={orbs:[{}]};
  for(const [id,owner] of [['card',DARK_STAR.monsterId],['sentry',TRUTH_CREATOR.monsterId]])f.room.monsters.set(id,{id,summonerId:owner});
  f.room.ariesClouds=new Map([['old',{monsterId:DARK_STAR.monsterId}],['other',{monsterId:'leoon-boss'}]]);
  f.room.starRecord.state='active';f.room.monsters.get(STAR_RECORD.monsterId).recordFlow={participants:new Map([['1',{}]])};
  f.room.monsters.get(FORGOTTEN_CONSTELLATION.monsterId).gather={stars:[{}]};
  assert.equal(needsSleepingBossReset(f.room,before),false);assert.equal(restoreSleepingBossStatues(f.room,before),false);
  assert.equal(f.store.transact(()=>restoreSleepingBossStatues(f.room,opening)),true);
  for(const [key,spec] of bosses){assert.equal(f.room[key].state,'dormant');assert(!f.room.monsters.has(spec.monsterId));}
  assert(!f.room.monsters.has('card'));assert(!f.room.monsters.has('sentry'));assert.deepEqual([...f.room.ariesClouds.keys()],['other']);
  assert.equal(dark.darkStarSkills,null);assert.equal(truth.truthCreatorBlue,null);assert.equal(truth.truthCreatorGalaxy,null);assert.equal(truth.truthCreatorChasers,null);
  assert.equal(restoreSleepingBossStatues(f.room,opening+1),false);assert.equal(needsSleepingBossReset(f.room,opening+1),false);
  assert.deepEqual(toRecord(f.room).students,studentData);assert.equal(f.room.energyDrops?.size||0,0);
  assert.equal(f.room.serena.state,'active');assert.equal(f.room.bossRespawns['noksera-boss'],opening+86400000);
  assert.deepEqual([...f.room.monsters].filter(([,m])=>['noksera','leoon','spirit-king','serena'].includes(m.typeId)),otherBosses);
  assert(!monsterViews(f.room,opening+1).some(m=>bosses.some(([,spec])=>m.id===spec.monsterId)));
});
test('07시 전 재시작은 active와 일정을 보존하고 오프라인 여러 날 경과는 석상만 복원한다',t=>{
  const f=fixture(t);summonAll(f);const data=f.disk().students;f.restart();
  for(const [key] of bosses){assert.equal(f.room[key].state,'active');assert.equal(f.room[key].resetAt,opening);}
  f.now=opening+3*86400000;f.restart();
  for(const [key,spec] of bosses){assert.equal(f.room[key].state,'dormant');assert(!monstersOf(f.room,f.now).has(spec.monsterId));}
  assert.deepEqual(f.disk().students,data);assert.equal(f.room.energyDrops?.size||0,0);f.restart();
  for(const [key] of bosses)assert.equal(f.room[key].state,'dormant');
});
test('구버전 active는 최초 로딩 다음07시부터 적용하고 소환일/학생 자료를 추정하지 않는다',t=>{
  const f=fixture(t);summonAll(f);const legacy=f.disk();for(const [key] of bosses)delete legacy[key].resetAt;
  const restored=fromRecord(legacy,before);for(const [key] of bosses){assert.equal(restored[key].state,'active');assert.equal(restored[key].resetAt,opening);}
  const saved=toRecord(restored);assert.deepEqual(saved.students,legacy.students);
  const next=fromRecord(saved,opening);for(const [key] of bosses)assert.equal(next[key].state,'dormant');
});
test('새벽 처치한4종의 저장 대기·표시시간은 바로오는07시이며 오프라인 경과 후 보상을 재지급하지 않는다',t=>{
  const f=fixture(t);summonAll(f);
  for(const [,spec] of bosses){const boss=f.room.monsters.get(spec.monsterId);Object.assign(f.player,{mapId:spec.mapId,x:boss.x,y:boss.y});
    damageMonster(f.room,boss,f.player,boss.hp,before);assert.equal(boss.respawnAt,opening);}
  f.store.transact(()=>settleBossDeaths(f.room,before));f.restart();
  for(const [key] of bosses){assert.equal(f.room[key].state,'recovering');assert.equal(f.room[key].respawnAt,opening);}
  const students=structuredClone(f.disk().students);f.now=opening;f.restart();
  for(const [key,spec] of bosses){assert.equal(f.room[key].state,'dormant');assert.equal(f.disk().bossRespawns[spec.monsterId],undefined);}
  assert.equal(f.room.energyDrops?.size||0,0);assert.equal(f.room.bossDialogueEvents?.length||0,0);assert.deepEqual(f.disk().students,students);
});
test('석상 복귀 저장 실패는 살아 있는 보스·패턴·일정까지 원복하고 재시도는 한 번만 적용한다',t=>{
  const f=fixture(t);summonAll(f);const old=f.disk(),save=f.store.files.save.bind(f.store.files);
  f.room.monsters.get(STAR_RECORD.monsterId).recordMath={stars:[{id:1}]};
  f.store.files.save=()=>{throw Error('reset write failed');};
  assert.throws(()=>f.store.transact(()=>restoreSleepingBossStatues(f.room,opening)),/reset write failed/);
  for(const [key,spec] of bosses){assert.equal(f.room[key].state,'active');assert(f.room.monsters.has(spec.monsterId));}
  assert.equal(f.room.monsters.get(STAR_RECORD.monsterId).recordMath.stars.length,1);assert.deepEqual(f.disk(),old);
  f.store.files.save=save;assert.equal(f.store.transact(()=>restoreSleepingBossStatues(f.room,opening)),true);
  assert.equal(f.store.transact(()=>restoreSleepingBossStatues(f.room,opening+1)),false);
});
test('06:59 처치 미정산 보상은07시 복귀보다 먼저 한 번 정산하고 같은날 소환을 반복 초기화하지 않는다',t=>{
  const f=fixture(t);summonAll(f);
  for(const [,spec] of bosses){const boss=f.room.monsters.get(spec.monsterId);Object.assign(f.player,{mapId:spec.mapId,x:boss.x,y:boss.y});damageMonster(f.room,boss,f.player,boss.hp,before);}
  assert.equal(f.room.pendingBossDeaths.size,4);assert.equal(restoreSleepingBossStatues(f.room,opening),false);
  const save=f.store.files.save.bind(f.store.files);f.store.files.save=()=>{throw Error('settlement failed');};
  assert.throws(()=>f.store.transact(()=>{settleBossDeaths(f.room,opening);restoreSleepingBossStatues(f.room,opening);}));
  assert.equal(f.room.pendingBossDeaths.size,4);assert.equal(f.room.energyDrops?.size||0,0);
  f.store.files.save=save;f.store.transact(()=>{settleBossDeaths(f.room,opening);restoreSleepingBossStatues(f.room,opening);});
  const drops=f.room.energyDrops.size;assert(drops>0);assert.equal(f.room.pendingBossDeaths.size,0);assert.equal(f.room.bossDialogueEvents.length,4);
  f.store.transact(()=>{settleBossDeaths(f.room,opening+1);restoreSleepingBossStatues(f.room,opening+1);});assert.equal(f.room.energyDrops.size,drops);assert.equal(f.room.bossDialogueEvents.length,4);
  f.now=opening;summonAll(f);for(const [key] of bosses){assert.equal(f.room[key].state,'active');assert.equal(f.room[key].resetAt,opening+86400000);}
  assert.equal(restoreSleepingBossStatues(f.room,opening+1000),false);
});
