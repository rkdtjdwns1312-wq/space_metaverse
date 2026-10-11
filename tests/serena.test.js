import test from 'node:test';
import assert from 'node:assert/strict';
import {SERENA,serenaMap,dormantSerena} from '../shared/serena.js';
import {mapOf} from '../shared/config.js';
import {MONSTER_TYPES,monsterType} from '../shared/monsters.js';
import {monstersOf,monsterViews,damageMonster,moveMonsters} from '../server/monsters.js';
import {summonSerena} from '../server/serena.js';
import {serenaEligible,serenaEligibility,recordSerenaLevel,recordBossVictory,validateSerenaProgress} from '../server/serena-progress.js';
import {monsterRespawnMs,restoreSerenaStatue,BOSS_RESPAWN_MS,validateSerenaState,validateBossRespawns} from '../server/boss-lifecycle.js';
import {ensureVitals} from '../server/vitals.js';
import {isFree} from '../server/world.js';
import {onOriginFloor} from '../shared/origin-floor.js';

const statue=mapOf(SERENA.mapId).objects.find(o=>o.id===SERENA.statueId);
function fixture(){
  const player={id:'a',role:'student',connected:true,away:false,mapId:SERENA.mapId,x:statue.x,y:statue.y+90,
    avatar:{level:5,constellationId:'taurus'},equipmentSlots:[null,null,null],inventory:[],
    serenaProgress:{highestLevel:5,bossKills:['leoon','noksera']}};
  return {player,room:{players:new Map([['a',player]]),planets:new Map()}};
}

test('세레나 자격은 LV5와 두 보스 직접 처치 경력을 모두 요구하며 교사 예외가 없다',()=>{
  for(const [level,kills] of [[4,['leoon','noksera']],[5,[]],[5,['leoon']],[5,['noksera']]]){
    const {room,player}=fixture();player.avatar.level=level;player.serenaProgress={highestLevel:level,bossKills:kills};
    assert.equal(serenaEligible(player),false);
    assert.throws(()=>summonSerena(room,player,1000),{message:'자격이 충분하지 않습니다'});
  }
  const {player}=fixture();player.role='teacher';delete player.serenaProgress;
  assert.equal(serenaEligibility(player).reachedLv5,false);
  assert.equal(serenaEligible(player),false);
  player.role='student';assert.deepEqual(validateSerenaProgress(undefined,player.avatar),{highestLevel:5,bossKills:[]});
  recordSerenaLevel(player);player.avatar.level=2;assert.equal(serenaEligibility(player).reachedLv5,true);
});

test('처치 기록은 같은 맵의 실제 피해 기여자만 인정하고 파티·오프라인·무피해는 제외한다',()=>{
  const {room,player}=fixture();
  for(const id of ['a','b','party','offline','away','other','zero']){
    const p={...player,id,serenaProgress:{highestLevel:5,bossKills:[]}};
    if(id==='offline')p.connected=false;if(id==='away')p.away=true;if(id==='other')p.mapId='space-plaza';
    room.players.set(id,p);
  }
  room.parties=new Map([['party',{memberIds:[...room.players.keys()]}]]);
  const contributions=new Map([['a',1],['b',20],['offline',40],['away',40],['other',40],['zero',0]]);
  for(const typeId of ['leoon','noksera'])recordBossVictory(room,{typeId,mapId:SERENA.mapId},contributions);
  for(const [id,p] of room.players)assert.equal(serenaEligible(p),['a','b'].includes(id),id);
});

test('소환은 맵·거리·접속·생존을 서버에서 검사하며 중복 생성하지 않는다',()=>{
  for(const change of [{mapId:'space-plaza'},{x:0,y:0},{connected:false},{away:true}]){
    const {room,player}=fixture();Object.assign(player,change);assert.throws(()=>summonSerena(room,player,1000));
    assert.equal(room.serena,undefined);
  }
  const dead=fixture();ensureVitals(dead.player).hp=0;assert.throws(()=>summonSerena(dead.room,dead.player,1000));
  const {room,player}=fixture();assert.equal(monstersOf(room,1000).has(SERENA.monsterId),false);
  assert.deepEqual(summonSerena(room,player,1000),{serena:{state:'active',respawnAt:null,monsterId:SERENA.monsterId}});
  const boss=room.monsters.get(SERENA.monsterId);
  assert.equal(boss.hp,10000);assert.equal(boss.mapId,SERENA.mapId);
  assert.deepEqual([boss.x,boss.y,boss.spawnX,boss.spawnY],[statue.x,statue.y,statue.x,statue.y]);
  assert.throws(()=>summonSerena(room,player,1001));
  assert.equal([...monstersOf(room,1001).values()].filter(m=>m.typeId==='serena').length,1);
  assert.equal(monsterType('serena').power,30);assert.equal(monsterType('serena').defense,0);
});

test('석상은 휴면 때만 서버 이동을 막고 세레나 상태별 공통 목록과 일치한다',()=>{
  const {room,player}=fixture(),map=mapOf(SERENA.mapId);
  room.monsters=new Map([[SERENA.monsterId,{id:SERENA.monsterId,hp:0}]]);
  assert.equal(isFree(room,statue.x,statue.y,player.id,map.id,true,player),false);
  for(const state of [{state:'active',respawnAt:null,monsterId:SERENA.monsterId},{state:'recovering',respawnAt:1000,monsterId:null}]){
    room.serena=state;assert.equal(serenaMap(map,state).objects.some(o=>o.id===SERENA.statueId),false);
    // 실제 보스와의 접촉은 별개이므로 석상만 사라진 지형 판정을 검사합니다.
    assert.equal(isFree(room,statue.x,statue.y,player.id,map.id,false,player),true);
  }
  room.serena=dormantSerena();assert.equal(serenaMap(map,room.serena),map);
});

test('세레나 경고는 2초 동안 고정되고 회피한 폭발도 원래 좌표를 전달한다',()=>{
  const {room,player}=fixture();summonSerena(room,player,1000);
  const boss=room.monsters.get(SERENA.monsterId);room.monsters=new Map([[boss.id,boss]]);
  player.x=boss.x+boss.radius+20;player.y=boss.y;
  boss.attackers.set(player.id,1);boss.targetId=player.id;boss.nextAttackAt=1000;
  assert.equal(moveMonsters(room,1000,()=>0).length,0);
  const warning=monsterViews(room,1000)[0].warning;
  assert.deepEqual(warning,{x:player.x,y:player.y,radius:90,startsAt:1000,endsAt:3000});
  player.x+=500;assert.equal(moveMonsters(room,2999,()=>0).length,0);
  const [hit]=moveMonsters(room,3000,()=>0);
  assert.equal(hit.attackOnly,true);assert.equal(hit.warningX,warning.x);assert.equal(hit.warningY,warning.y);assert.equal(hit.warningRadius,90);
  assert.equal(boss.nextAttackAt,6000);
});

test('세레나는 시작점4의 모서리와 외곽을 향해 걸어도 실제 바닥 밖으로 나가지 않는다',()=>{
  for(const angle of [0,Math.PI/4,Math.PI/2,Math.PI,Math.PI*1.25,Math.PI*1.5]){
    const {room,player}=fixture();summonSerena(room,player,1000);
    const boss=room.monsters.get(SERENA.monsterId),map=mapOf(SERENA.mapId);
    room.monsters=new Map([[boss.id,boss]]);boss.patrolStartedAt=1000;boss.lastMoveAt=1000;
    for(let now=1100;now<61000;now+=100){
      moveMonsters(room,now,()=>angle/(Math.PI*2));
      assert.equal(onOriginFloor(map,boss.x,boss.y,boss.radius),true);
    }
  }
});

test('세레나 보상은 고유 재료 1·빅뱅 1·탐사권 1~2·에너지 1400~1600이다',()=>{
  for(const count of [1,2]){
    const {room,player}=fixture();summonSerena(room,player,1000);const boss=room.monsters.get(SERENA.monsterId);
    damageMonster(room,boss,player,10000,2000,{energyRoll:(min,max)=>{assert.deepEqual([min,max],[1400,1601]);return 1600;},bossRoll:()=>count});
    const drops=[...room.energyDrops.values()];
    assert.equal(drops.filter(d=>d.itemId==='radiant-star-origin').length,1);
    assert.equal(drops.filter(d=>d.itemId==='spirit-king-soul').length,0);
    assert.equal(drops.filter(d=>d.itemId==='gold-big-bang-card').length,1);
    assert.equal(drops.filter(d=>d.itemId==='exploration-ticket').length,count);
    assert.equal(drops.find(d=>!d.kind).total,1600);
    assert.deepEqual(room.serena,{state:'recovering',respawnAt:2000+BOSS_RESPAWN_MS,monsterId:null});
    moveMonsters(room,2000+BOSS_RESPAWN_MS,()=>0);assert.equal(boss.hp,0);
    assert.equal(restoreSerenaStatue(room,1999+BOSS_RESPAWN_MS),false);
    assert.equal(restoreSerenaStatue(room,2000+BOSS_RESPAWN_MS),true);
    assert.equal(room.monsters.has(SERENA.monsterId),false);assert.deepEqual(room.serena,dormantSerena());
  }
});

test('일반 LV1/2 10초·LV3 15초·LV4 20초, 모든 보스 24시간 경계를 지킨다',()=>{
  for(const type of MONSTER_TYPES){
    assert.equal(monsterRespawnMs(type),type.boss?86400000:type.level===4?20000:type.level===3?15000:10000,type.id);
  }
  for(const level of [1,2,3,4]){
    const {room,player}=fixture();const boss=[...monstersOf(room,1000,()=>0).values()].find(m=>!monsterType(m.typeId).boss&&monsterType(m.typeId).level===level);
    room.monsters=new Map([[boss.id,boss]]);player.mapId=boss.mapId;
    damageMonster(room,boss,player,1e6,2000);const until=boss.respawnAt;
    moveMonsters(room,until-1,()=>0);assert.equal(boss.hp,0);
    moveMonsters(room,until,()=>0);assert.equal(boss.hp,boss.maxHp);
  }
  for(const typeId of ['leoon','noksera','spirit-king']){
    const {room,player}=fixture(),boss=monstersOf(room,1000).get(typeId+'-boss');
    room.monsters=new Map([[boss.id,boss]]);player.mapId=boss.mapId;
    damageMonster(room,boss,player,1e6,2000);assert.equal(boss.respawnAt,2000+BOSS_RESPAWN_MS);
    moveMonsters(room,boss.respawnAt-1,()=>0);assert.equal(boss.hp,0);
    moveMonsters(room,boss.respawnAt,()=>0);assert.equal(boss.hp,boss.maxHp);
  }
});

test('조작되거나 손상된 영속 자격·상태·시간 데이터는 거부한다',()=>{
  for(const value of [{highestLevel:6,bossKills:[]},{highestLevel:5,bossKills:['fake']},{highestLevel:5,bossKills:['leoon','leoon']}])assert.throws(()=>validateSerenaProgress(value));
  for(const value of [{state:'active',respawnAt:null,monsterId:null},{state:'recovering',respawnAt:NaN,monsterId:null}])assert.throws(()=>validateSerenaState(value));
  assert.throws(()=>validateBossRespawns({'fake-boss':1000}));assert.throws(()=>validateBossRespawns({'leoon-boss':-1}));
});
