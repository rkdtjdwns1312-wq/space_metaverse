import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync,readFileSync,writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {PersistentRoomStore} from '../server/persistent-rooms.js';
import {summonSerena} from '../server/serena.js';
import {monstersOf,damageMonster,moveMonsters} from '../server/monsters.js';
import {settleBossDeaths,restoreSerenaStatue,BOSS_RESPAWN_MS} from '../server/boss-lifecycle.js';
import {serenaEligible} from '../server/serena-progress.js';
import {SERENA} from '../shared/serena.js';
import {mapOf} from '../shared/config.js';

const statue=mapOf(SERENA.mapId).objects.find(o=>o.id===SERENA.statueId);
function fixture(t){
  const dir=mkdtempSync(join(tmpdir(),'serena-save-'));let store=new PersistentRoomStore(dir);
  t.after(()=>{store.close();rmSync(dir,{recursive:true,force:true});});
  const {room}=store.transact(()=>store.create({title:'검사',allowedNames:['1','2']},'teacher'));
  const {player}=store.transact(()=>store.join({code:room.code,nickname:'1',pin:'1234'},'student'));
  const code=room.code;
  return {dir,code,id:player.id,get store(){return store;},get room(){return store.rooms.get(code);},get player(){return store.rooms.get(code).players.get(player.id);},
    restart(){store.close();store=new PersistentRoomStore(dir);store.transact(()=>store.open({code},'teacher'));
      store.transact(()=>store.join({code,nickname:'1',pin:'1234'},'student'));},
    disk(){return JSON.parse(readFileSync(join(dir,code+'.json'),'utf8'));}};
}
function qualify(f){f.store.transact(()=>{
  Object.assign(f.player.avatar,{level:5,form:'transcendent',constellationId:'taurus'});
  f.player.serenaProgress={highestLevel:5,bossKills:['leoon','noksera']};
});locate(f.player);}
const locate=p=>Object.assign(p,{mapId:SERENA.mapId,x:statue.x,y:statue.y+90});

test('소환 저장 실패는 상태와 보스를 롤백하고 성공 뒤 재시작은 같은 한 마리만 복구한다',t=>{
  const f=fixture(t);qualify(f);const now=Date.now(),save=f.store.files.save.bind(f.store.files);
  f.store.files.save=()=>{throw Error('test disk unavailable');};
  assert.throws(()=>f.store.transact(()=>summonSerena(f.room,f.player,now)));
  assert.notEqual(f.room.serena?.state,'active');assert.equal(f.room.monsters.has(SERENA.monsterId),false);
  assert.equal(f.disk().serena.state,'dormant');
  f.store.files.save=save;f.store.transact(()=>summonSerena(f.room,f.player,now));
  const boss=f.room.monsters.get(SERENA.monsterId);damageMonster(f.room,boss,f.player,100,now+1);
  f.restart();assert.equal(f.room.serena.state,'active');assert.equal(serenaEligible(f.player),true);
  const restored=monstersOf(f.room,now+1000).get(SERENA.monsterId);
  assert.deepEqual([restored.x,restored.y,restored.spawnX,restored.spawnY],[statue.x,statue.y,statue.x,statue.y]);
  assert.equal(restored.hp,10000);assert.equal([...f.room.monsters.values()].filter(m=>m.typeId==='serena').length,1);
  locate(f.player);assert.throws(()=>f.store.transact(()=>summonSerena(f.room,f.player,now+1000)));
});

test('세레나 처치 저장 실패에는 보상도 복원 시각도 공개하지 않고 재시도는 한 번만 정산한다',t=>{
  const f=fixture(t);qualify(f);const now=Date.now();f.store.transact(()=>summonSerena(f.room,f.player,now));
  const boss=f.room.monsters.get(SERENA.monsterId);damageMonster(f.room,boss,f.player,10000,now+10);
  assert.equal(f.room.energyDrops?.size||0,0);assert.equal(f.room.pendingBossDeaths.size,1);
  const save=f.store.files.save.bind(f.store.files);f.store.files.save=()=>{throw Error('test disk unavailable');};
  assert.throws(()=>f.store.transact(()=>settleBossDeaths(f.room)));
  assert.equal(f.room.bossDialogueEvents?.length||0,0,'저장 실패에는 대화도 공개하지 않음');
  assert.equal(f.room.energyDrops?.size||0,0);assert.equal(f.room.pendingBossDeaths.size,1);
  assert.equal(f.room.serena.state,'active');assert.equal(f.disk().serena.state,'active');
  f.store.files.save=save;f.store.transact(()=>settleBossDeaths(f.room));
  const until=now+10+BOSS_RESPAWN_MS,drops=f.room.energyDrops.size;
  assert.equal(f.disk().serena.respawnAt,until);assert.equal(f.disk().bossRespawns[SERENA.monsterId],until);
  assert.ok(drops>=4);f.store.transact(()=>settleBossDeaths(f.room));assert.equal(f.room.energyDrops.size,drops);
  assert.equal(f.room.bossDialogueEvents.length,1,'재정산에도 대화는 한 번만 발생');
  assert.equal(f.room.bossDialogueEvents[0].bossId,'serena');
  f.restart();assert.equal(f.room.serena.state,'recovering');assert.equal(f.room.serena.respawnAt,until);
  assert.equal(f.room.bossDialogueEvents?.length||0,0,'재접속으로 처치 대화 재생 안 함');
  assert.equal(monstersOf(f.room,until-1).has(SERENA.monsterId),false);locate(f.player);
  assert.throws(()=>f.store.transact(()=>summonSerena(f.room,f.player,until-1)));
  assert.equal(f.store.transact(()=>restoreSerenaStatue(f.room,until)),true);
  assert.equal(f.disk().serena.state,'dormant');f.restart();assert.equal(f.room.serena.state,'dormant');
  assert.equal(monstersOf(f.room,until+1).has(SERENA.monsterId),false);
});

test('기존 세 보스의 처치 시각과 기여 자격은 저장되며 재시작으로 24시간이 늘거나 줄지 않는다',t=>{
  const f=fixture(t),now=Date.now();
  f.store.transact(()=>Object.assign(f.player.avatar,{level:5,form:'transcendent',constellationId:'taurus'}));
  for(const id of ['leoon-boss','noksera-boss','spirit-king-boss']){
    const boss=monstersOf(f.room,now).get(id);f.player.mapId=boss.mapId;
    damageMonster(f.room,boss,f.player,20000,now);
    // 정산이 지연되어도 처치 순간의 접속/맵 조건으로 자격을 부여합니다.
    f.player.mapId='space-plaza';f.player.connected=false;
    f.store.transact(()=>settleBossDeaths(f.room));f.player.connected=true;
  }
  assert.equal(serenaEligible(f.player),true);f.restart();assert.equal(serenaEligible(f.player),true);
  const until=now+BOSS_RESPAWN_MS;
  for(const id of ['leoon-boss','noksera-boss','spirit-king-boss']){
    const boss=monstersOf(f.room,until-1).get(id);assert.equal(boss.hp,0,id);assert.equal(boss.respawnAt,until);
  }
  moveMonsters(f.room,until-1,()=>0);
  assert.ok(['leoon-boss','noksera-boss','spirit-king-boss'].every(id=>f.room.monsters.get(id).hp===0));
  moveMonsters(f.room,until,()=>0);
  assert.ok(['leoon-boss','noksera-boss','spirit-king-boss'].every(id=>f.room.monsters.get(id).hp>0));
});

test('처치 직후 교실 종료도 대기 정산을 저장하여 재개 시 소환을 허용하지 않는다',t=>{
  const f=fixture(t);qualify(f);const now=Date.now();f.store.transact(()=>summonSerena(f.room,f.player,now));
  damageMonster(f.room,f.room.monsters.get(SERENA.monsterId),f.player,10000,now);
  f.store.transact(()=>f.store.destroy(f.room));assert.equal(f.disk().serena.state,'recovering');
  f.restart();assert.equal(f.room.serena.respawnAt,now+BOSS_RESPAWN_MS);
});

test('기존 학생 LV5는 보존하되 없는 과거 보스 기록은 만들지 않는다',t=>{
  const f=fixture(t);f.store.transact(()=>Object.assign(f.player.avatar,{level:5,form:'transcendent',constellationId:'taurus'}));
  const legacy=f.disk();delete legacy.serena;delete legacy.bossRespawns;delete legacy.students[0].serenaProgress;
  writeFileSync(join(f.dir,f.code+'.json'),JSON.stringify(legacy));f.restart();
  assert.deepEqual(f.player.serenaProgress,{highestLevel:5,bossKills:[]});assert.equal(serenaEligible(f.player),false);
});
