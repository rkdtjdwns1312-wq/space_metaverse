import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {io} from 'socket.io-client';
import {createTetrisRuns,tetrisRanking,validateTetrisRanking} from '../server/tetris-game.js';
import {createSignalRuns,signalRanking} from '../server/signal-game.js';
import {createClassroomServer} from '../server/app.js';
import {resetWeeklyRanking} from '../server/weekly-ranking.js';
import {oneStrokePuzzle} from '../client/star-path-game.js';
import {STREET,STREET_ID} from '../shared/config.js';

test('별 테트리스는 서버 낙하와 회전으로 줄을 지우고 종료 후 한 번만 기록한다',()=>{
  const runs=createTetrisRuns({randomPiece:()=>1}),player={id:'p',nickname:'별이',role:'student'};
  const room={players:new Map([[player.id,player]]),tetrisRanking:[]};
  let now=0,state=runs.start(player,now);
  assert.equal(state.board.length,20);assert.equal(state.current.type,1);
  assert.throws(()=>runs.finish(room,player,{runId:state.runId},now));
  for(const shift of [-4,-2,0,2,4]){
    for(let i=0;i<Math.abs(shift);i++)state=runs.move(player,{runId:state.runId,move:shift<0?'left':'right'},now);
    while(state.current&&!state.done){now+=100;state=runs.state(player,{runId:state.runId},now);}
    if(!state.done){now+=400;state=runs.state(player,{runId:state.runId},now);}
  }
  assert.equal(state.lines,2);
  while(!state.done&&now<1_000_000){now+=500;state=runs.state(player,{runId:state.runId},now);}
  assert.equal(state.done,true);
  const finished=runs.finish(room,player,{runId:state.runId},now,Date.now());
  assert.ok(finished.lines>=2);assert.equal(finished.ranking[0].lines,finished.lines);
  assert.throws(()=>runs.finish(room,player,{runId:state.runId},now));
});

test('테트리스 랭킹은 지운 줄 우선, 같으면 먼저 끝난 기록 우선이며 교사만 초기화한다',()=>{
  const now=Date.now(),teacher={id:'t',role:'teacher'},student={id:'a',role:'student'};
  const room={players:new Map([[teacher.id,teacher],[student.id,student]]),tetrisRanking:[
    {id:'late',playerId:'a',nickname:'가',lines:4,at:now+2},
    {id:'early',playerId:'b',nickname:'나',lines:4,at:now+1},
    {id:'many',playerId:'c',nickname:'다',lines:7,at:now}
  ]};
  assert.deepEqual(tetrisRanking(room).map(r=>r.id),['many','early','late']);
  assert.throws(()=>resetWeeklyRanking(room,student,'tetris',now));
  resetWeeklyRanking(room,teacher,'tetris',now);assert.equal(room.tetrisRanking.length,0);
  assert.throws(()=>validateTetrisRanking([{id:'x',playerId:'x',nickname:'x',lines:-1,at:now}]));
});

test('우주 신호 랭킹은 완료 단계와 도달 시각 순이며 교사 초기화만 허용한다',()=>{
  const runs=createSignalRuns(),now=Date.now(),teacher={id:'t',role:'teacher'},a={id:'a',nickname:'가',role:'student'},b={id:'b',nickname:'나',role:'student'};
  const room={players:new Map([[teacher.id,teacher],[a.id,a],[b.id,b]]),signalRanking:[]};
  const playStage=(player,at)=>{
    let run=runs.start(player),result;
    for(const signal of run.sequence)result=runs.choose(room,player,{runId:run.runId,signal},at);
    return {run,result};
  };
  playStage(a,now+1);playStage(b,now+2);
  assert.deepEqual(signalRanking(room).map(r=>r.playerId),['a','b']);
  let run=runs.start(b),result;
  for(const signal of run.sequence)result=runs.choose(room,b,{runId:run.runId,signal},now+3);
  for(const signal of result.sequence)result=runs.choose(room,b,{runId:run.runId,signal},now+4);
  assert.deepEqual(signalRanking(room).map(r=>r.playerId),['b','a']);
  assert.equal(signalRanking(room)[0].stage,2);
  assert.throws(()=>resetWeeklyRanking(room,a,'signal',now));
  resetWeeklyRanking(room,teacher,'signal',now);assert.equal(room.signalRanking.length,0);
});

test('한붓그리기 모든 난이도 도형은 연결되어 있고 홀수 차수 점이 정확히 둘이다',()=>{
  for(const difficulty of ['low','medium','high'])for(const seed of [0,.99]){
    const puzzle=oneStrokePuzzle(difficulty,()=>seed),degree=Array(puzzle.points.length).fill(0);
    const seen=new Set([0]),stack=[0];
    for(const [a,b] of puzzle.edges){degree[a]++;degree[b]++;}
    while(stack.length){const node=stack.pop();for(const [a,b] of puzzle.edges){const next=a===node?b:b===node?a:null;
      if(next!==null&&!seen.has(next)){seen.add(next);stack.push(next);}}}
    assert.equal(seen.size,puzzle.points.length);assert.equal(degree.filter(value=>value%2).length,2);
  }
});

test('저장 실패로 교실이 복구되어도 우주 신호 진행·재시도 상태가 보존된다',async t=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'signal-rollback-'));
  const game=createClassroomServer({teacherKey:'signal-rollback-key',dataDir:dir,studentHours:false,teacherManagedAccounts:false,unattended:true});
  const {port}=await game.listen(),sockets=[];
  t.after(async()=>{sockets.forEach(socket=>socket.disconnect());await game.close();fs.rmSync(dir,{recursive:true,force:true});});
  const connect=async()=>{const socket=io('http://127.0.0.1:'+port,{transports:['websocket'],forceNew:true,reconnection:false});sockets.push(socket);
    await new Promise((resolve,reject)=>{socket.once('connect',resolve);socket.once('connect_error',reject);});return socket;};
  const call=(socket,event,data={})=>socket.timeout(4000).emitWithAck(event,data);
  const teacher=await connect(),created=await call(teacher,'room:create',{teacherKey:'signal-rollback-key',allowedNames:['1']});assert.ok(created.ok,created.error);
  const student=await connect(),joined=await call(student,'room:join',{code:created.room.code,nickname:'1',pin:'1234'});assert.ok(joined.ok,joined.error);
  const signal=STREET.objects.find(object=>object.gameId==='signal');
  const current=()=>game.store.rooms.get(created.room.code);
  Object.assign(current().players.get(joined.selfId),{mapId:STREET_ID,x:signal.x,y:signal.y});
  const originalPlayer=current().players.get(joined.selfId);
  const started=await call(student,'signal:start');assert.equal(started.ok,true);
  assert.equal(JSON.stringify(game.store.snapshot(current(),originalPlayer)).includes('signalRun'),false);
  assert.equal(JSON.stringify(game.store.records.get(created.room.code)).includes('signalRun'),false);
  const originalSave=game.store.files.save.bind(game.store.files);
  game.store.files.save=()=>{throw new Error('simulated signal save failure');};
  try{assert.equal((await call(student,'tutorial:complete')).ok,false);}
  finally{game.store.files.save=originalSave;}
  assert.equal(current().players.get(joined.selfId),originalPlayer);
  const first=await call(student,'signal:choose',{runId:started.runId,signal:started.sequence[0]});
  assert.equal(first.ok,true);assert.equal(first.correct,true);
  game.store.files.save=()=>{throw new Error('simulated signal save failure');};
  try{assert.equal((await call(student,'signal:choose',{runId:started.runId,signal:started.sequence[1]})).ok,false);}
  finally{game.store.files.save=originalSave;}
  assert.equal(current().signalRanking.length,0);
  const retried=await call(student,'signal:choose',{runId:started.runId,signal:started.sequence[1]});
  assert.equal(retried.ok,true);assert.equal(retried.stageCleared,1);
  assert.equal(current().signalRanking[0].playerId,joined.selfId);
});
