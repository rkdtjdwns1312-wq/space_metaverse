import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync,readFileSync,writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {PersistentRoomStore} from '../server/persistent-rooms.js';
import {summonTruthCreator} from '../server/truth-creator.js';
import {TRUTH_CREATOR,TRUTH_CREATOR_REQUIRED_BOSSES,truthCreatorEligible} from '../shared/truth-creator.js';
import {mapOf} from '../shared/config.js';
import {monstersOf,damageMonster} from '../server/monsters.js';
import {settleBossDeaths,restoreTruthCreatorStatue,nextBossRespawnAt} from '../server/boss-lifecycle.js';
import {chargeHuntingStation} from '../server/hunting-time.js';
const now=Date.parse('2026-11-02T12:00:00+09:00');
function fixture(t){
  const dir=mkdtempSync(join(tmpdir(),'truth-creator-save-'));let store=new PersistentRoomStore(dir,{clock:()=>now});
  t.after(()=>{store.close();rmSync(dir,{recursive:true,force:true});});
  const {room}=store.transact(()=>store.create({title:'보스검사',allowedNames:['1']},'teacher'));
  const {player}=store.transact(()=>store.join({code:room.code,nickname:'1',pin:'1234'},'student')),code=room.code,path=join(dir,code+'.json');
  return {path,get store(){return store;},get room(){return store.rooms.get(code);},get player(){return store.rooms.get(code).players.get(player.id);},
    restart(){store.close();store=new PersistentRoomStore(dir,{clock:()=>now});store.transact(()=>store.open({code},'teacher'));store.transact(()=>store.join({code,nickname:'1',pin:'1234'},'student'));},
    disk(){return JSON.parse(readFileSync(path,'utf8'));}};
}
function locate(f){const statue=mapOf(TRUTH_CREATOR.mapId).objects.find(o=>o.id===TRUTH_CREATOR.statueId);Object.assign(f.player,{mapId:TRUTH_CREATOR.mapId,x:statue.x,y:statue.y+90});chargeHuntingStation(f.player,'math',now);}
test('old saves acquire a dormant boss without fabricating missing victory records',t=>{
  const f=fixture(t);f.store.transact(()=>{f.player.serenaProgress={highestLevel:1,bossKills:['leoon','noksera']};});
  const record=f.disk();delete record.truthCreator;writeFileSync(f.path,JSON.stringify(record));f.restart();
  assert.equal(f.room.truthCreator.state,'dormant');assert.deepEqual(f.player.serenaProgress.bossKills,['leoon','noksera']);
  assert.equal(truthCreatorEligible(f.player),false);assert(!monstersOf(f.room,now).has(TRUTH_CREATOR.monsterId));
});
test('summon and victory settlement roll back on save failure; restart and next-day statue preserve all records',t=>{
  const f=fixture(t);f.store.transact(()=>{f.player.serenaProgress={highestLevel:1,bossKills:[...TRUTH_CREATOR_REQUIRED_BOSSES]};});locate(f);
  const save=f.store.files.save.bind(f.store.files);f.store.files.save=()=>{throw Error('test disk unavailable');};
  assert.throws(()=>f.store.transact(()=>summonTruthCreator(f.room,f.player,now)));assert.notEqual(f.room.truthCreator?.state,'active');assert.equal(f.disk().truthCreator.state,'dormant');
  f.store.files.save=save;locate(f);f.store.transact(()=>summonTruthCreator(f.room,f.player,now));f.restart();
  assert.equal(f.room.truthCreator.state,'active');assert.equal(truthCreatorEligible(f.player),true);
  const boss=monstersOf(f.room,now).get(TRUTH_CREATOR.monsterId);assert.equal(boss.hp,30000);
  locate(f);damageMonster(f.room,boss,f.player,30000,now+10);assert.equal(f.room.energyDrops?.size||0,0);
  const saveAgain=f.store.files.save.bind(f.store.files);f.store.files.save=()=>{throw Error('test disk unavailable');};
  assert.throws(()=>f.store.transact(()=>settleBossDeaths(f.room,now+11)));
  assert.equal(f.room.truthCreator.state,'active');assert(!f.player.serenaProgress.bossKills.includes('truth-creator'));assert.equal(f.room.energyDrops?.size||0,0);
  f.store.files.save=saveAgain;f.store.transact(()=>settleBossDeaths(f.room,now+12));
  assert(f.player.serenaProgress.bossKills.includes('truth-creator'));const count=f.room.energyDrops.size;
  f.store.transact(()=>settleBossDeaths(f.room,now+13));assert.equal(f.room.energyDrops.size,count);
  const due=nextBossRespawnAt(now+10);assert.equal(f.disk().truthCreator.respawnAt,due);f.restart();
  assert.equal(f.room.truthCreator.state,'recovering');assert.equal(truthCreatorEligible(f.player),true);assert(!monstersOf(f.room,due-1).has(boss.id));
  f.store.transact(()=>restoreTruthCreatorStatue(f.room,due));f.restart();assert.equal(f.room.truthCreator.state,'dormant');assert(!monstersOf(f.room,due+1).has(boss.id));
});
