import test from 'node:test';
import assert from 'node:assert/strict';
import {hallOfFame,recordOmokWin,validateOmokWinRecords} from '../server/hall-of-fame.js';
import {weekStartKst} from '../server/weekly-ranking.js';
import {mkdtempSync,rmSync} from 'node:fs';
import {join} from 'node:path';
import {PersistentRoomStore} from '../server/persistent-rooms.js';

const now=Date.parse('2026-10-29T03:00:00Z'),week=weekStartKst(now);

test('hall shows tied first places across existing weekly arcade rankings and Omok wins per classroom',()=>{
  const room={memoryRanking:[
    {id:'m1',playerId:'a',nickname:'별이',remainingMs:50000,at:week+1},
    {id:'m2',playerId:'b',nickname:'달이',remainingMs:50000,at:week+2},
    {id:'old',playerId:'c',nickname:'옛별',remainingMs:60000,at:week-1}],
    starRanking:[{id:'s1',playerId:'a',nickname:'별이',elapsedMs:1000,at:week+1},{id:'s2',playerId:'b',nickname:'달이',elapsedMs:1000,at:week+2},
      {id:'s3',playerId:'a',nickname:'별이',elapsedMs:1200,at:week+3}],
    dodgeRanking:[{id:'d1',playerId:'a',nickname:'별이',elapsedMs:5000,at:week+1},{id:'d2',playerId:'b',nickname:'달이',elapsedMs:5000,at:week+2}],
    tetrisRanking:[{id:'t1',playerId:'a',nickname:'별이',lines:10,at:week+1},{id:'t2',playerId:'b',nickname:'달이',lines:10,at:week+2}],
    signalRanking:[{id:'n1',playerId:'a',nickname:'별이',stage:5,at:week+1},{id:'n2',playerId:'b',nickname:'달이',stage:5,at:week+2}],
    omokWinRecords:[{id:'o1',playerId:'a',nickname:'별이',at:week+1},{id:'o2',playerId:'b',nickname:'달이',at:week+2},
      {id:'o3',playerId:'a',nickname:'별이',at:week+3},{id:'o4',playerId:'b',nickname:'달이',at:week+4},
      {id:'o5',playerId:'c',nickname:'해',at:week+5},{id:'past',playerId:'d',nickname:'옛달',at:week-1}]};
  const result=hallOfFame(room,now);
  assert.deepEqual(result.games.map(game=>game.id),['stars','memory','dodge','tetris','signal','omok']);
  assert.deepEqual(result.games.map(game=>game.winners),Array.from({length:6},()=>['달이','별이']));
  assert.equal(result.memory.title,'별 그림 짝 맞추기 · 상 난이도 · 이번 주');assert.equal(result.omok.title,'별 오목 · 이번 주 승리');
  const empty=hallOfFame({},now);assert(empty.games.every(game=>game.winners.length===0));
});

test('Omok weekly winner records are unique per match, validated and persist per classroom',()=>{
  const dir=mkdtempSync(join(process.cwd(),'.hall-of-fame-'));let store;
  try{
    store=new PersistentRoomStore(dir);const {room}=store.transact(()=>store.create({title:'명예반',allowedNames:['별이']},'teacher'));
    store.transact(()=>assert.equal(recordOmokWin(room,{matchId:'match-a',playerId:'p',nickname:'별이',at:now}),true));
    store.transact(()=>assert.equal(recordOmokWin(room,{matchId:'match-a',playerId:'p',nickname:'별이',at:now}),false));
    const code=room.code;store.close();store=new PersistentRoomStore(dir);
    const loaded=store.transact(()=>store.open({code},'teacher')).room;
    assert.deepEqual(loaded.omokWinRecords,[{id:'match-a',playerId:'p',nickname:'별이',at:now}]);
    const other=store.create({title:'다른반',allowedNames:['달이']},'teacher').room;
    assert.deepEqual(hallOfFame(other,now).omok.winners,[]);
    assert.throws(()=>validateOmokWinRecords([{id:'x',playerId:'p',nickname:'bad name 😊',at:now}]));
  }finally{store?.close();rmSync(dir,{recursive:true,force:true});}
});

test('Omok record week boundary uses the supplied event timestamp',()=>{
  const room={omokWinRecords:[{id:'old',playerId:'old-player',nickname:'옛별',at:week+10}]};
  const nextWeek=week+7*24*60*60*1000;
  recordOmokWin(room,{matchId:'new',playerId:'p',nickname:'별이',at:nextWeek});
  assert.deepEqual(room.omokWinRecords,[{id:'new',playerId:'p',nickname:'별이',at:nextWeek}]);
});
