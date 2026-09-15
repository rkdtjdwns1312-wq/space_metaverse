import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {PersistentRoomStore} from '../server/persistent-rooms.js';
import {startStarRun,clickStar} from '../server/star-game.js';
import {startDodgeRun,completeDodgeRun} from '../server/dodge-game.js';
import {STREET_ID} from '../shared/config.js';

test('두 랭킹은 재시작 후 복원되며 진행 중인 게임은 복원하지 않는다',()=>{
  const dir=mkdtempSync(join(tmpdir(),'ranking-save-'));let store;
  try{
    store=new PersistentRoomStore(dir);const {room,player}=store.transact(()=>store.create({allowedNames:['1']},'teacher'));
    Object.assign(player,{mapId:STREET_ID});
    let state=startStarRun(room,player,0);
    for(let i=0;i<10;i++)state=store.transact(()=>clickStar(room,player,state,100*(i+1)));
    const dodge=startDodgeRun(room,player,0),run=room.dodgeRuns.get(player.id);run.status='pending';run.elapsedMs=12345;
    store.transact(()=>completeDodgeRun(room,player,dodge.runId));
    startStarRun(room,player,3000);startDodgeRun(room,player,3000);
    const code=room.code;store.close();store=new PersistentRoomStore(dir);
    const reopened=store.transact(()=>store.open({code},'new-teacher')).room;
    assert.equal(reopened.starRanking[0].elapsedMs,1000);assert.equal(reopened.dodgeRanking[0].elapsedMs,12345);
    assert.equal(reopened.starRuns,undefined);assert.equal(reopened.dodgeRuns,undefined);
  }finally{store?.close();rmSync(dir,{recursive:true,force:true});}
});
test('랭킹 저장 실패는 완료 직전 게임으로 되돌려서 재시도해도 중복 기록이 없다',()=>{
  const dir=mkdtempSync(join(tmpdir(),'ranking-rollback-'));let store;
  try{
    store=new PersistentRoomStore(dir);const session=store.transact(()=>store.create({allowedNames:['1']},'teacher')),code=session.room.code,id=session.player.id;
    let state=startStarRun(session.room,session.player,0);
    for(let i=0;i<9;i++)state=clickStar(session.room,session.player,state,100*(i+1));
    const save=store.files.save.bind(store.files);store.files.save=()=>{throw Error('simulated disk full');};
    assert.throws(()=>store.transact(()=>clickStar(session.room,session.player,state,1000)),/disk full/);
    let room=store.rooms.get(code),player=room.players.get(id);assert.equal(room.starRuns.get(id).step,9);assert.equal(room.starRanking?.length||0,0);
    store.files.save=save;store.transact(()=>clickStar(room,player,state,1100));assert.equal(room.starRanking.length,1);
    Object.assign(player,{mapId:STREET_ID});const dodge=startDodgeRun(room,player,0);room.dodgeRuns.get(id).status='pending';room.dodgeRuns.get(id).elapsedMs=5000;
    store.files.save=()=>{throw Error('simulated disk full');};
    assert.throws(()=>store.transact(()=>completeDodgeRun(room,player,dodge.runId)),/disk full/);
    room=store.rooms.get(code);player=room.players.get(id);assert.equal(room.dodgeRuns.get(id).status,'pending');assert.equal(room.dodgeRanking?.length||0,0);
    store.files.save=save;store.transact(()=>completeDodgeRun(room,player,dodge.runId));assert.equal(room.dodgeRanking.length,1);
    assert.throws(()=>store.transact(()=>completeDodgeRun(room,player,dodge.runId)));assert.equal(store.rooms.get(code).dodgeRanking.length,1);
  }finally{store?.close();rmSync(dir,{recursive:true,force:true});}
});
