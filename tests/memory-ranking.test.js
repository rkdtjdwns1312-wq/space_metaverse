import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {io} from 'socket.io-client';
import {startMemoryRun,flipMemoryCard,memoryRanking,validateMemoryRanking,cancelMemoryRun} from '../server/memory-game.js';
import {resetWeeklyRanking,weekStartKst} from '../server/weekly-ranking.js';
import {PersistentRoomStore} from '../server/persistent-rooms.js';
import {createClassroomServer} from '../server/app.js';
import {STREET,STREET_ID} from '../shared/config.js';

const player={id:'one',nickname:'별이',role:'student'};
function pairs(run){const groups=new Map();run.cards.forEach((symbol,i)=>groups.set(symbol,[...(groups.get(symbol)||[]),i]));return [...groups.values()].flat();}
function finish(room,p=player,elapsed=1000){
  let state=startMemoryRun(room,p,{level:'high'},0);
  for(const index of pairs(room.memoryRuns.get(p.id)))state={...state,...flipMemoryCard(room,p,{runId:state.runId,step:state.step,index,remainingMs:60000,won:true},elapsed)};
  return state;
}

test('상 난이도만 서버 게임을 만들며 카드·시간·완료 수치를 클라이언트에 맡기지 않는다',()=>{
  const room={};for(const level of ['low','medium',undefined])assert.throws(()=>startMemoryRun(room,player,{level},0));
  const start=startMemoryRun(room,player,{level:'high'},0);assert.equal(start.cards,undefined);
  const run=room.memoryRuns.get(player.id);assert.equal(run.cards.length,36);assert.equal(new Set(run.cards).size,18);
  assert.throws(()=>flipMemoryCard(room,{...player,id:'other'},{...start,index:0},100));
  for(const index of [-1,36,1.2,'0'])assert.throws(()=>flipMemoryCard(room,player,{...start,index},100));
  const first=flipMemoryCard(room,player,{...start,index:0,remainingMs:60000,won:true},1000);
  assert.equal(first.done,false);assert.equal(first.remainingMs,59000);assert.equal(first.symbol,run.cards[0]);assert.equal(first.cards,undefined);
  assert.throws(()=>flipMemoryCard(room,player,{...start,index:1},1100));
  assert.throws(()=>flipMemoryCard(room,player,{...start,step:1,index:0},1100));
  const wrong=run.cards.findIndex(s=>s!==run.cards[0]);
  flipMemoryCard(room,player,{...start,step:1,index:wrong},1100);
  assert.throws(()=>flipMemoryCard(room,player,{...start,step:2,index:0},1699));
  assert.equal(flipMemoryCard(room,player,{...start,step:2,index:0},1700).step,3);
  cancelMemoryRun(room,player,'wrong');assert.equal(room.memoryRuns.size,1);
  cancelMemoryRun(room,player,start.runId);assert.equal(room.memoryRuns.size,0);assert.deepEqual(memoryRanking(room),[]);
});

for(const elapsed of [59999,59999.5,60000,60001])test(`마지막 카드 ${elapsed}ms: 서버 마감 경계`,()=>{
  const room={},start=startMemoryRun(room,player,{level:'high'},0),indices=pairs(room.memoryRuns.get(player.id));let step=0;
  for(const index of indices.slice(0,-1))step=flipMemoryCard(room,player,{...start,index,step},1000).step;
  const result=flipMemoryCard(room,player,{...start,index:indices.at(-1),step,remainingMs:60000,won:true},elapsed);
  assert.equal(result.done,true);assert.equal(result.won,elapsed<60000);
  assert.equal(memoryRanking(room).length,elapsed<60000?1:0);assert.equal(room.memoryRuns.size,0);
  assert.throws(()=>flipMemoryCard(room,player,{...start,index:indices.at(-1),step},elapsed));
});

test('기존 게임과 같은 기록별 TOP 10·남은 시간 내림차순·주간 필터와 저장 검증',()=>{
  const room={};for(let i=12;i>=1;i--)finish(room,player,i*1000);
  assert.deepEqual(memoryRanking(room).map(r=>r.remainingMs),Array.from({length:10},(_,i)=>59000-i*1000));
  assert.equal(finish(room,player,20000).rank,null);assert.equal(validateMemoryRanking(room.memoryRanking).length,10);
  assert.deepEqual(validateMemoryRanking(undefined),[]);
  for(const value of [null,[{...room.memoryRanking[0],remainingMs:0}],[{...room.memoryRanking[0],remainingMs:60001}],Array(11).fill(room.memoryRanking[0])])assert.throws(()=>validateMemoryRanking(value));
  room.memoryRanking[0].at=weekStartKst()-1;assert.equal(memoryRanking(room).length,9);
});

test('초기화는 인증된 교사·선택한 게임·이번 주에만 적용한다',()=>{
  const now=Date.now(),teacher={id:'teacher',role:'teacher'},current={at:now},old={at:weekStartKst()-1},future={at:weekStartKst()+7*86400000};
  const room={players:new Map([[teacher.id,teacher],[player.id,player]]),memoryRanking:[old,current,future],starRanking:[current],dodgeRanking:[current]};
  assert.throws(()=>resetWeeklyRanking(room,player,'memory'));assert.throws(()=>resetWeeklyRanking(room,{...teacher},'memory'));
  resetWeeklyRanking(room,teacher,'memory',now);assert.deepEqual(room.memoryRanking,[old,future]);assert.equal(room.starRanking.length,1);assert.equal(room.dodgeRanking.length,1);
});

test('상 완료 저장 실패 복구·재시도·재시작 복원·교사 초기화 저장 실패 복구',()=>{
  const dir=mkdtempSync(join(tmpdir(),'memory-ranking-'));let store;
  try{
    store=new PersistentRoomStore(dir);let {room,player:p}=store.transact(()=>store.create({allowedNames:['1']},'teacher'));
    const code=room.code,id=p.id,start=startMemoryRun(room,p,{level:'high'},0),indices=pairs(room.memoryRuns.get(id));let step=0;
    for(const index of indices.slice(0,-1))step=flipMemoryCard(room,p,{...start,index,step},1000).step;
    const final={...start,index:indices.at(-1),step},save=store.files.save.bind(store.files);
    store.files.save=()=>{throw Error('disk full');};assert.throws(()=>store.transact(()=>flipMemoryCard(room,p,final,2000)),/disk full/);
    room=store.rooms.get(code);p=room.players.get(id);assert.equal(room.memoryRuns.get(id).step,35);assert.equal(room.memoryRanking?.length||0,0);
    store.files.save=save;store.transact(()=>flipMemoryCard(room,p,final,2100));assert.equal(room.memoryRanking.length,1);
    store.files.save=()=>{throw Error('disk full');};assert.throws(()=>store.transact(()=>resetWeeklyRanking(room,p,'memory')),/disk full/);
    room=store.rooms.get(code);assert.equal(room.memoryRanking.length,1);store.files.save=save;
    store.close();store=new PersistentRoomStore(dir);({room,player:p}=store.transact(()=>store.open({code},'teacher2')));
    assert.equal(room.memoryRanking[0].remainingMs,57900);assert.equal(room.memoryRuns,undefined);
    store.transact(()=>resetWeeklyRanking(room,p,'memory'));store.close();store=new PersistentRoomStore(dir);
    assert.deepEqual(store.transact(()=>store.open({code},'teacher3')).room.memoryRanking,[]);
  }finally{store?.close();rmSync(dir,{recursive:true,force:true});}
});

test('실제 소켓: 근접·학생 위조 거부·교실 격리·초기화 실패 무방송·세 게임 초기화 지속 저장',async t=>{
  const dir=mkdtempSync(join(tmpdir(),'arcade-reset-socket-')),key='arcade-reset-test-private',sockets=[];
  const game=createClassroomServer({teacherKey:key,dataDir:dir,studentHours:false,teacherManagedAccounts:false}),address=await game.listen();
  t.after(async()=>{sockets.forEach(s=>s.disconnect());await game.close();rmSync(dir,{recursive:true,force:true});});
  const connect=async()=>{const socket=io('http://127.0.0.1:'+address.port,{transports:['websocket'],reconnection:false});sockets.push(socket);await new Promise(r=>socket.once('connect',r));return socket;};
  const call=(s,event,data={})=>s.timeout(3000).emitWithAck(event,data),teacher=await connect(),student=await connect(),other=await connect();
  assert.equal((await call(student,'memory:start',{level:'high'})).ok,false);
  const created=await call(teacher,'room:create',{teacherKey:key,allowedNames:['1']}),joined=await call(student,'room:join',{code:created.room.code,nickname:'1',pin:'1234'});
  assert.equal(joined.ok,true);const otherCreated=await call(other,'room:create',{teacherKey:key,allowedNames:['2']});
  assert.equal((await call(student,'memory:start',{level:'high'})).ok,false);
  const place=(code,id,gameId)=>{const room=game.store.rooms.get(code),p=room.players.get(id),m=STREET.objects.find(o=>o.gameId===gameId);Object.assign(p,{mapId:STREET_ID,x:m.x,y:m.y+60});return {room,p};};
  place(created.room.code,joined.selfId,'memory');assert.equal((await call(student,'memory:start',{level:'low'})).ok,false);
  let state=await call(student,'memory:start',{level:'high'});assert.equal(state.ok,true);assert.equal(state.cards,undefined);
  const run=game.store.rooms.get(created.room.code).memoryRuns.get(joined.selfId);
  for(const index of pairs(run))state={...state,...await call(student,'memory:flip',{runId:state.runId,step:state.step,index,remainingMs:999999})};
  assert.equal(state.won,true);assert.ok(state.remainingMs<60000);
  for(const [gameId,field] of [['memory','memoryRanking'],['tetris','tetrisRanking'],['dodge','dodgeRanking']]){
    const {room}=place(created.room.code,created.selfId,gameId);place(created.room.code,joined.selfId,gameId);place(otherCreated.room.code,otherCreated.selfId,gameId);
    if(gameId!=='memory')game.store.transact(()=>{room[field]=[{id:gameId,playerId:joined.selfId,nickname:'1',...(gameId==='tetris'?{lines:5}:{elapsedMs:1000}),at:Date.now()}];});
    assert.equal((await call(other,`${gameId}:ranking`)).ranking.length,0);
    assert.equal((await call(student,`${gameId}:ranking`)).canReset,false);
    assert.equal((await call(student,`${gameId}:ranking:reset`,{role:'teacher',playerId:created.selfId,teacherKey:key,game:'other'})).ok,false);
    assert.equal(game.store.rooms.get(created.room.code)[field].length,1);
    let broadcasts=0;const onReset=()=>broadcasts++;student.on(`${gameId}:ranking`,onReset);
    const save=game.store.files.save.bind(game.store.files);game.store.files.save=()=>{throw Error('simulated disk full');};
    assert.equal((await call(teacher,`${gameId}:ranking:reset`)).ok,false);assert.equal(game.store.rooms.get(created.room.code)[field].length,1);
    await new Promise(r=>setTimeout(r,30));assert.equal(broadcasts,0);game.store.files.save=save;
    assert.equal((await call(teacher,`${gameId}:ranking:reset`)).ok,true);assert.deepEqual(game.store.records.get(created.room.code)[field],[]);
    student.off(`${gameId}:ranking`,onReset);
  }
});
