import test from 'node:test';
import assert from 'node:assert/strict';
import {readingFixture,call,ok} from './helpers/reading-fixture.js';
import {PLAYGROUND_ID,PLAYGROUND} from '../shared/config.js';
import {huntingCycle} from '../shared/hunting-time.js';
import {chargeHuntingStation} from '../server/hunting-time.js';
import {DUEL_ARCADES} from '../shared/duel-arcade.js';

function placeAtMachine(f,gameId){
  const machine=PLAYGROUND.objects.find(object=>object.gameId===gameId);
  assert(machine,`missing ${gameId} machine`);
  f.mutate(player=>Object.assign(player,{mapId:PLAYGROUND_ID,x:machine.x,y:machine.y}));
}

test('completed memory earns one playground credit; invalid completion earns none; failed final save retries and persists after restart',async t=>{
  const f=await readingFixture(t);placeAtMachine(f,'memory');
  f.mutate(player=>chargeHuntingStation(player,'math',f.now));
  const before=f.p.huntingTime.remainingMs;
  const started=ok(await call(f.student,'memory:start',{level:'high'}));
  const invalid=await call(f.student,'memory:flip',{runId:'forged',step:0,index:0});
  assert.equal(invalid.ok,false);
  assert.deepEqual(f.p.huntingTime.chargedPlaygrounds,[],'invalid completion does not award playground time');

  const run=f.room.memoryRuns.get(f.p.id),pairs=new Map();
  run.cards.forEach((card,index)=>{if(!pairs.has(card))pairs.set(card,[]);pairs.get(card).push(index);});
  const moves=[];let step=0;
  for(const indices of pairs.values())for(const index of indices)moves.push({runId:started.runId,step:step++,index});
  for(const move of moves.slice(0,-1))ok(await call(f.student,'memory:flip',move));
  const finalMove=moves.at(-1);
  await f.fail(async()=>{
    const failed=await call(f.student,'memory:flip',finalMove);
    assert.equal(failed.ok,false,'last matching pair save must fail');
  });
  assert.deepEqual(f.p.huntingTime.chargedPlaygrounds,[],'save failure rolls back the credit');
  assert.equal(f.p.huntingTime.remainingMs,before);
  assert.ok(f.room.memoryRuns.has(f.p.id),'failed save keeps the final move retryable');

  const result=ok(await call(f.student,'memory:flip',finalMove));
  assert.equal(result.won,true);
  assert.equal(f.p.huntingTime.remainingMs,before+10*60_000);
  assert.deepEqual(f.p.huntingTime.chargedPlaygrounds,['memory']);
  assert.equal(f.p.huntingTime.cycle,huntingCycle(f.now));
  await f.restart();
  assert.deepEqual(f.p.huntingTime.chargedPlaygrounds,['memory']);
  assert.equal(f.p.huntingTime.remainingMs,before+10*60_000);
});

test('omok victory and both playground credits commit together; final move retries after storage failure',async t=>{
 const f=await readingFixture(t),machine=DUEL_ARCADES.find(o=>o.gameId==='omok');
 f.mutate(()=>{for(const p of [f.p,f.q])Object.assign(p,{mapId:PLAYGROUND_ID,x:machine.x,y:machine.y});});
 const invited=ok(await call(f.student,'duel:invite',{objectId:machine.id,targetId:f.q.id})).state.game;
 let g=ok(await call(f.other,'duel:respond',{inviteId:invited.id,accept:true})).state.game;
 const winner=g.turnId,loser=g.players.find(p=>p.id!==winner).id;
 const sock=id=>id===f.p.id?f.student:f.other;
 const move=async(index,id)=>{const r=ok(await call(sock(id),'duel:move',{sessionId:g.id,revision:g.revision,index}));g=r.state.game;};
 for(let x=3;x<7;x++){await move(105+x,winner);await move(x,loser);}
 const final={sessionId:g.id,revision:g.revision,index:112};
 await f.fail(async()=>assert.equal((await call(sock(winner),'duel:move',final)).ok,false));
 for(const p of [f.p,f.q]){assert.deepEqual(p.huntingTime.chargedPlaygrounds,[]);assert.equal(p.huntingTime.remainingMs,0);}
 g=ok(await call(sock(winner),'duel:move',final)).state.game;assert.equal(g.phase,'finished');
 for(const p of [f.p,f.q]){assert.deepEqual(p.huntingTime.chargedPlaygrounds,['duel-omok']);assert.equal(p.huntingTime.remainingMs,600000);}
 assert.equal((await call(sock(winner),'duel:move',final)).ok,false);
 await f.restart();for(const p of [f.p,f.q])assert.equal(p.huntingTime.remainingMs,600000);
});
