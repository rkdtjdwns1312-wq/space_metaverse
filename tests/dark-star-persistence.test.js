import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync,readFileSync,writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {PersistentRoomStore} from '../server/persistent-rooms.js';
import {summonDarkStar} from '../server/dark-star.js';
import {monstersOf,damageMonster,moveMonsters} from '../server/monsters.js';
import {settleBossDeaths,restoreDarkStarStatue,nextBossRespawnAt} from '../server/boss-lifecycle.js';
import {chargeHuntingStation} from '../server/hunting-time.js';
import {DARK_STAR} from '../shared/dark-star.js';
import {collectEnergyDrop} from '../server/energy-drops.js';
import {mapOf} from '../shared/config.js';

const statue=mapOf(DARK_STAR.mapId).objects.find(o=>o.id===DARK_STAR.statueId);
function fixture(t){
  const dir=mkdtempSync(join(tmpdir(),'darkStar-save-'));let store=new PersistentRoomStore(dir);
  t.after(()=>{store.close();rmSync(dir,{recursive:true,force:true});});
  const {room}=store.transact(()=>store.create({title:'검사',allowedNames:['1','2']},'teacher'));
  const {player}=store.transact(()=>store.join({code:room.code,nickname:'1',pin:'1234'},'student'));
  const code=room.code;
  return {dir,code,id:player.id,get store(){return store;},get room(){return store.rooms.get(code);},get player(){return store.rooms.get(code).players.get(player.id);},
    restart(){store.close();store=new PersistentRoomStore(dir);store.transact(()=>store.open({code},'teacher'));
      store.transact(()=>store.join({code,nickname:'1',pin:'1234'},'student'));},
    disk(){return JSON.parse(readFileSync(join(dir,code+'.json'),'utf8'));}};
}
function qualify(f){f.store.transact(()=>chargeHuntingStation(f.player,'math',Date.now()));locate(f.player);}
const locate=p=>Object.assign(p,{mapId:DARK_STAR.mapId,x:statue.x,y:statue.y+90});

test('소환 저장 실패는 상태와 보스를 롤백하고 성공 뒤 재시작은 같은 한 마리만 복구한다',t=>{
  const f=fixture(t);qualify(f);const now=Date.now(),save=f.store.files.save.bind(f.store.files);
  f.store.files.save=()=>{throw Error('test disk unavailable');};
  assert.throws(()=>f.store.transact(()=>summonDarkStar(f.room,f.player,now)));
  assert.notEqual(f.room.darkStar?.state,'active');assert.equal(f.room.monsters.has(DARK_STAR.monsterId),false);
  assert.equal(f.disk().darkStar.state,'dormant');
  f.store.files.save=save;f.store.transact(()=>summonDarkStar(f.room,f.player,now));
  const boss=f.room.monsters.get(DARK_STAR.monsterId);damageMonster(f.room,boss,f.player,100,now+1);
  f.restart();assert.equal(f.room.darkStar.state,'active');
  const restored=monstersOf(f.room,now+1000).get(DARK_STAR.monsterId);
  assert.deepEqual([restored.x,restored.y,restored.spawnX,restored.spawnY],[statue.x,statue.y,statue.x,statue.y]);
  assert.equal(restored.hp,10000);assert.equal([...f.room.monsters.values()].filter(m=>m.typeId==='dark-star').length,1);
  locate(f.player);assert.throws(()=>f.store.transact(()=>summonDarkStar(f.room,f.player,now+1000)));
});

test('태초의 검은별 처치 저장 실패에는 보상도 복원 시각도 공개하지 않고 재시도는 한 번만 정산한다',t=>{
  const f=fixture(t);qualify(f);const now=Date.now();f.store.transact(()=>summonDarkStar(f.room,f.player,now));
  const boss=f.room.monsters.get(DARK_STAR.monsterId);damageMonster(f.room,boss,f.player,10000,now+10);
  assert.equal(f.room.energyDrops?.size||0,0);assert.equal(f.room.pendingBossDeaths.size,1);
  const save=f.store.files.save.bind(f.store.files);f.store.files.save=()=>{throw Error('test disk unavailable');};
  assert.throws(()=>f.store.transact(()=>settleBossDeaths(f.room)));
  assert.equal(f.room.bossDialogueEvents?.length||0,0,'저장 실패에는 대화도 공개하지 않음');
  assert.equal(f.room.energyDrops?.size||0,0);assert.equal(f.room.pendingBossDeaths.size,1);
  assert.equal(f.room.darkStar.state,'active');assert.equal(f.disk().darkStar.state,'active');
  f.store.files.save=save;f.store.transact(()=>settleBossDeaths(f.room));
  const until=nextBossRespawnAt(now+10),drops=f.room.energyDrops.size;
  assert.equal(f.disk().darkStar.respawnAt,until);assert.equal(f.disk().bossRespawns[DARK_STAR.monsterId],until);
  assert.ok(drops>=4);f.store.transact(()=>settleBossDeaths(f.room));assert.equal(f.room.energyDrops.size,drops);
  assert.equal(f.room.bossDialogueEvents.length,1,'재정산에도 대화는 한 번만 발생');
  assert.equal(f.room.bossDialogueEvents[0].bossId,'dark-star');
  f.restart();assert.equal(f.room.darkStar.state,'recovering');assert.equal(f.room.darkStar.respawnAt,until);
  assert.equal(f.room.bossDialogueEvents?.length||0,0,'재접속으로 처치 대화 재생 안 함');
  assert.equal(monstersOf(f.room,until-1).has(DARK_STAR.monsterId),false);locate(f.player);
  assert.throws(()=>f.store.transact(()=>summonDarkStar(f.room,f.player,until-1)));
  assert.equal(f.store.transact(()=>restoreDarkStarStatue(f.room,until)),true);
  assert.equal(f.disk().darkStar.state,'dormant');f.restart();assert.equal(f.room.darkStar.state,'dormant');
  assert.equal(monstersOf(f.room,until+1).has(DARK_STAR.monsterId),false);
});


test('legacy rooms stay dormant across restart and the black gem pickup persists',t=>{
 const f=fixture(t);const legacy=f.disk();delete legacy.darkStar;writeFileSync(join(f.dir,f.code+'.json'),JSON.stringify(legacy));f.restart();
 assert.equal(f.room.darkStar.state,'dormant');assert(!monstersOf(f.room).has(DARK_STAR.monsterId));qualify(f);
 const now=Date.now();f.store.transact(()=>summonDarkStar(f.room,f.player,now));damageMonster(f.room,f.room.monsters.get(DARK_STAR.monsterId),f.player,10000,now);
 f.store.transact(()=>settleBossDeaths(f.room,now));const gem=[...f.room.energyDrops.values()].find(d=>d.itemId==='black-gem');assert(gem);
 Object.assign(f.player,{x:gem.x,y:gem.y});f.store.transact(()=>collectEnergyDrop(f.room,f.player,gem.id,now+1));
 f.restart();assert.equal(f.player.inventory.find(i=>i.id==='black-gem')?.quantity,1);assert.equal(f.room.darkStar.state,'recovering');
});
