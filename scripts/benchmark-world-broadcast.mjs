// Deterministic application JSON bytes, excluding Socket.IO/TLS overhead and compression.
// Run: node scripts/benchmark-world-broadcast.mjs
import assert from 'node:assert/strict';
import {RoomStore} from '../server/rooms.js';
import {monstersOf,monsterViews} from '../server/monsters.js';
import {worldBroadcastFrame} from '../server/world-broadcast.js';
import {tryTruthCreatorGalaxy} from '../server/truth-creator-galaxy.js';
import {aimTruthCreator} from '../server/truth-creator-attack.js';
import {TRUTH_CREATOR} from '../shared/truth-creator.js';

const now=Date.parse('2026-11-03T03:00:00Z'),rows=[];
for(const players of [10,20,35])for(const scenario of ['normal','boss','split']){
  const store=new RoomStore(),names=Array.from({length:players},(_,i)=>String(i+1));
  const {room}=store.create({allowedNames:names},'teacher');
  room.truthCreator={state:'active',respawnAt:null,monsterId:TRUTH_CREATOR.monsterId};
  const monsters=monstersOf(room,now,()=>.5),boss=monsters.get(TRUTH_CREATOR.monsterId);
  const viewers=names.map((nickname,i)=>{
    const player=store.join({code:room.code,nickname},`socket-${i}`).player;
    player.mapId=scenario==='normal'||scenario==='split'&&i<Math.ceil(players/2)?'star-origin-1':TRUTH_CREATOR.mapId;
    player.x=boss.x+300;player.y=boss.y;return player;
  });
  // Keep the same active boss wave (one visible orb, seven queued) in every scenario.
  const target=viewers.find(p=>p.mapId===boss.mapId)||{...viewers[0],mapId:boss.mapId};
  aimTruthCreator(room,boss,target,now);
  assert.equal(tryTruthCreatorGalaxy(room,boss,target,now,()=>.5),true);
  const at=now+100,all=monsterViews(room,at),frame=worldBroadcastFrame(room,at);
  assert.equal(all.find(m=>m.id===boss.id).truthCreatorEffects.galaxies.length,1);
  const positions=viewers.map(p=>[p.id,p.x,p.y,1]);
  let before=0,after=0;
  for(const viewer of viewers){
    const current=frame(viewer,positions),legacy={...current,monsters:all};delete legacy.mapId;
    before+=Buffer.byteLength(JSON.stringify(legacy));after+=Buffer.byteLength(JSON.stringify(current));
    assert.ok(current.monsters.every(m=>m.mapId===viewer.mapId));
  }
  const occupiedMaps=new Set(viewers.map(p=>p.mapId)).size;
  rows.push({players,scenario,allMonsters:all.length,occupiedMaps,beforeBytesPerTick:before,afterBytesPerTick:after,
    savedPercent:+((1-after/before)*100).toFixed(1),beforeKiBPerSecond:+(before*10/1024).toFixed(1),
    afterKiBPerSecond:+(after*10/1024).toFixed(1),mapEffectBuildsBefore:players,mapEffectBuildsAfter:occupiedMaps});
}
console.log(JSON.stringify({basis:'10 Hz, student recipients only, full moving-player coordinates; 43 base monsters + active truth boss/one galaxy orb with seven queued; JSON bytes before framing/compression',rows},null,2));
