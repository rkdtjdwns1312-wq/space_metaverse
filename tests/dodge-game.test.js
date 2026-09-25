import test from 'node:test';
import assert from 'node:assert/strict';
import {io} from 'socket.io-client';
import {createClassroomServer} from '../server/app.js';
import {STREET,STREET_ID} from '../shared/config.js';
import {
  DODGE_RULES,advanceDodgeRuns,cancelDodgeRun,completeDodgeRun,dodgeRanking,
  setDodgeInput,startDodgeRun,validateDodgeRanking
} from '../server/dodge-game.js';

function fixture(id='student-1',role='student'){
  const player={id,nickname:role==='teacher'?'선생님':'별이',role,connected:true,away:false,mapId:'star-street'};
  const room={players:new Map([[id,player]]),dodgeRanking:[]};
  return {room,player};
}

function harmless(run){run.stars=[];return run;}
function collide(run,speed=12000){
  run.stars=[{id:'fast-star',x:0,y:run.playerBody.y,vx:speed,vy:0,radius:DODGE_RULES.starRadius}];
}
function advanceUntil(room,run,from,to,{parkStars=false}={}){
  let update;
  for(let now=from+DODGE_RULES.maxStepMs;now<=to;now+=DODGE_RULES.maxStepMs){
    if(parkStars)for(const star of run.stars){star.x=30;star.y=30;star.vx=0;star.vy=0;}
    update=advanceDodgeRuns(room,now)[0];
  }
  return update;
}
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const socketCall=(socket,event,data={})=>socket.timeout(3000).emitWithAck(event,data);

test('start creates an isolated 600x420 authoritative run for connected students and teachers',()=>{
  const {room,player}=fixture();
  const state=startDodgeRun(room,player,100);
  assert.equal(state.status,'running');assert.equal(state.arenaWidth,600);assert.equal(state.arenaHeight,420);
  assert.equal(state.wave,1);assert.equal(state.waveCount,2);assert.equal(state.stars.length,2);
  assert.equal(state.player.x,300);assert.equal(state.player.y,210);assert.equal(room.dodgeRuns.size,1);
  const oldRun=state.runId,next=startDodgeRun(room,player,200);assert.notEqual(next.runId,oldRun);assert.equal(room.dodgeRuns.size,1);
  const teacherFixture=fixture('teacher-1','teacher');assert.equal(startDodgeRun(teacherFixture.room,teacherFixture.player,0).status,'running');
  for(const change of [{connected:false},{connected:true,away:true},{away:false,mapId:'star-origin'}]){
    const blocked=fixture();Object.assign(blocked.player,change);
    assert.throws(()=>startDodgeRun(blocked.room,blocked.player,0));
  }
});

test('input is normalized, movement stays inside the arena, and a stale heartbeat stops movement',()=>{
  const {room,player}=fixture(),state=startDodgeRun(room,player,0),run=harmless(room.dodgeRuns.get(player.id));
  setDodgeInput(room,player,{runId:state.runId,x:3,y:4},0);
  assert.equal(advanceDodgeRuns(room,50).length,1);assert.ok(Math.abs(run.playerBody.x-306.9)<1e-9);
  let update=advanceDodgeRuns(room,100)[0];
  assert.ok(Math.abs(update.state.player.x-313.8)<1e-9);assert.ok(Math.abs(update.state.player.y-228.4)<1e-9);
  const stopped={...update.state.player};update=advanceDodgeRuns(room,351)[0];
  assert.equal(update.state.player.x,stopped.x);assert.equal(update.state.player.y,stopped.y);
  update=advanceDodgeRuns(room,401)[0];
  assert.equal(update.state.player.x,stopped.x);assert.equal(update.state.player.y,stopped.y);
  run.playerBody.x=run.playerBody.radius;run.playerBody.y=run.playerBody.radius;
  setDodgeInput(room,player,{runId:state.runId,x:-1,y:-1},401);assert.equal(advanceDodgeRuns(room,451).length,1);update=advanceDodgeRuns(room,501)[0];
  assert.equal(update.state.player.x,run.playerBody.radius);assert.equal(update.state.player.y,run.playerBody.radius);
  const before={...run.input};setDodgeInput(room,player,{runId:'wrong',x:1,y:0},402);assert.deepEqual(run.input,before);
  setDodgeInput(room,player,{runId:state.runId,x:Infinity,y:NaN},402);assert.deepEqual(run.input,{x:0,y:0,at:402});
});

for(const boundary of [4000,8000])test(`difficulty increases exactly at ${boundary}ms, not before or again after`,()=>{
  const {room,player}=fixture();startDodgeRun(room,player,0);
  const run=harmless(room.dodgeRuns.get(player.id)),waveIndex=boundary/4000;
  advanceUntil(room,run,0,boundary-50,{parkStars:true});
  // Keep existing stars safely away while checking that their speed also increases.
  for(const star of run.stars){star.x=30;star.y=30;star.vx=1;star.vy=0;}
  advanceDodgeRuns(room,boundary-1);
  assert.equal(run.elapsedMs,boundary-1);assert.equal(run.waveIndex,waveIndex-1);
  assert.equal(run.starSpeed,82+7*(waveIndex-1));
  const countBefore=run.stars.length;
  advanceDodgeRuns(room,boundary);
  assert.equal(run.elapsedMs,boundary);assert.equal(run.waveIndex,waveIndex);
  assert.equal(run.starSpeed,82+7*waveIndex);
  assert.equal(run.stars.length,countBefore+2+waveIndex);
  assert.equal(run.stars.length,waveIndex===1?3:7);
  for(const star of run.stars)assert.ok(Math.abs(Math.hypot(star.vx,star.vy)-run.starSpeed)<1e-9);
  advanceDodgeRuns(room,boundary+1);
  assert.equal(run.elapsedMs,boundary+1);assert.equal(run.waveIndex,waveIndex);
  assert.equal(run.starSpeed,82+7*waveIndex);assert.equal(run.stars.length,countBefore+2+waveIndex);
});

test('broadcasts every 50ms, suppressing intervening calls and duplicate timestamps',()=>{
  const {room,player}=fixture();startDodgeRun(room,player,1000);
  const run=harmless(room.dodgeRuns.get(player.id));
  assert.equal(DODGE_RULES.broadcastMs,50);
  for(let now=1050;now<=1500;now+=50){
    assert.deepEqual(advanceDodgeRuns(room,now-1),[]);
    const updates=advanceDodgeRuns(room,now);
    assert.equal(updates.length,1);assert.equal(updates[0].finished,false);
    assert.equal(updates[0].state.elapsedMs,now-1000);assert.equal(run.lastBroadcastAt,now);
    assert.deepEqual(advanceDodgeRuns(room,now),[]);
  }
});

test('49.999ms main ticks each broadcast within the 0.5ms tolerance',()=>{
  const {room,player}=fixture(),startAt=1000.123;startDodgeRun(room,player,startAt);
  const run=harmless(room.dodgeRuns.get(player.id));
  assert.deepEqual(advanceDodgeRuns(room,startAt+49.49),[]);
  for(let tick=1;tick<=20;tick++){
    const now=startAt+tick*49.999,updates=advanceDodgeRuns(room,now);
    assert.equal(updates.length,1,`tick ${tick} must not wait another 50ms`);
    assert.equal(run.lastBroadcastAt,now);
    assert.ok(Math.abs(updates[0].state.elapsedMs-tick*49.999)<1e-8);
  }
});

test('broadcast cadence uses server time while lagged physics remains capped at 50ms',()=>{
  const {room,player}=fixture();startDodgeRun(room,player,0);
  const run=harmless(room.dodgeRuns.get(player.id));
  assert.equal(advanceDodgeRuns(room,49.5).length,1);
  assert.deepEqual(advanceDodgeRuns(room,50),[]);
  const update=advanceDodgeRuns(room,99)[0];
  assert.equal(update.finished,false);assert.equal(run.lastBroadcastAt,99);
  assert.equal(advanceDodgeRuns(room,5000).length,1);
  assert.equal(run.elapsedMs,149);assert.equal(run.waveIndex,0);assert.equal(run.lastBroadcastAt,5000);
});

test('the active-star ceiling never deletes a live star and only limits later spawning after natural exit',()=>{
  const {room,player}=fixture(),start=startDodgeRun(room,player,0),run=room.dodgeRuns.get(player.id);
  run.stars=Array.from({length:DODGE_RULES.maxActiveStars},(_,i)=>({id:'kept-'+i,x:30+i%100,y:30+(i%20)*10,vx:0,vy:0,radius:1}));
  let state=advanceUntil(room,run,0,4000).state;
  assert.equal(state.stars.length,120);assert.deepEqual(state.stars.map(s=>s.id),run.stars.map(s=>s.id));
  run.stars[0].x=DODGE_RULES.width+2;run.stars[0].vx=1;
  assert.equal(advanceDodgeRuns(room,4050).length,1);assert.equal(run.stars.length,119);assert.ok(!run.stars.some(s=>s.id==='kept-0'));
  state=advanceUntil(room,run,4050,8000).state;assert.equal(state.stars.length,120);
  assert.equal(state.stars.filter(s=>s.id.startsWith('kept-')).length,119);
  cancelDodgeRun(room,player,start.runId);assert.equal(room.dodgeRuns.size,0);
});

test('swept collision catches a fast star, freezes pending state, and completion records exactly once',()=>{
  const {room,player}=fixture(),start=startDodgeRun(room,player,0),run=room.dodgeRuns.get(player.id);collide(run);
  const update=advanceDodgeRuns(room,50)[0];
  assert.equal(update.playerId,player.id);assert.equal(update.finished,true);assert.equal(update.state.status,'pending');
  run.retryAt=200;const frozen=structuredClone(run);setDodgeInput(room,player,{runId:start.runId,x:1,y:0},60);cancelDodgeRun(room,player,start.runId);
  assert.throws(()=>startDodgeRun(room,player,70));
  assert.deepEqual(advanceDodgeRuns(room,100),[]);assert.deepEqual(run,frozen);
  const retry=advanceDodgeRuns(room,200);assert.equal(retry.length,1);assert.equal(retry[0].finished,true);assert.deepEqual(run,frozen);
  const result=completeDodgeRun(room,player,start.runId);
  assert.equal(result.elapsedMs,50);assert.equal(result.rank,1);assert.equal(result.ranking.length,1);
  assert.equal(room.dodgeRuns.size,0);assert.throws(()=>completeDodgeRun(room,player,start.runId));
  assert.equal(room.dodgeRanking.length,1);
});

test('ranking keeps this KST week only, orders longest first, caps at ten, and stays separated by room',()=>{
  const now=Date.now(),old={id:'old',playerId:'old-player',nickname:'지난별',elapsedMs:999999,at:now-8*86400000};
  const current={id:'current',playerId:'current-player',nickname:'이번별',elapsedMs:500,at:now};
  const a=fixture(),b=fixture('student-b');a.room.dodgeRanking=[old,current];b.room.dodgeRanking=[];
  assert.deepEqual(dodgeRanking(a.room).map(r=>r.id),['current']);assert.equal(a.room.dodgeRanking.length,1);
  for(let i=0;i<11;i++){
    const player={id:'rank-'+i,nickname:'별'+i,role:'student',connected:true,away:false,mapId:'star-street'};
    a.room.players.set(player.id,player);const started=startDodgeRun(a.room,player,0),run=a.room.dodgeRuns.get(player.id);
    const duration=1000+i*100;
    for(let now=50;now<duration;now+=50){run.stars=[];advanceDodgeRuns(a.room,now);}
    run.stars=[{id:'hit-'+i,x:run.playerBody.x,y:run.playerBody.y,vx:0,vy:0,radius:1}];
    assert.equal(advanceDodgeRuns(a.room,duration)[0].finished,true);completeDodgeRun(a.room,player,started.runId);
  }
  const ranking=dodgeRanking(a.room);assert.equal(ranking.length,10);
  assert.deepEqual(ranking.map(r=>r.elapsedMs),[2000,1900,1800,1700,1600,1500,1400,1300,1200,1100]);
  assert.deepEqual(ranking.map(r=>r.rank),[1,2,3,4,5,6,7,8,9,10]);assert.deepEqual(dodgeRanking(b.room),[]);
});

test('advance cancels runs after leave, disconnect, away, or map change without touching another room',()=>{
  for(const change of [null,{connected:false},{away:true},{mapId:'star-origin'}]){
    const {room,player}=fixture(),other=fixture('other');startDodgeRun(room,player,0);startDodgeRun(other.room,other.player,0);
    if(change===null)room.players.delete(player.id);else Object.assign(player,change);
    assert.deepEqual(advanceDodgeRuns(room,50),[]);assert.equal(room.dodgeRuns.size,0);assert.equal(other.room.dodgeRuns.size,1);
  }
});

test('persisted dodge ranking validation accepts legacy absence and rejects malformed rows',()=>{
  assert.deepEqual(validateDodgeRanking(undefined),[]);
  const valid=[{id:'run',playerId:'student',nickname:'별 친구',elapsedMs:1234,at:Date.now()}];
  assert.deepEqual(validateDodgeRanking(valid),valid);assert.notEqual(validateDodgeRanking(valid),valid);
  for(const value of [null,{},Array(11).fill(valid[0]),[{...valid[0],id:''}],[{...valid[0],nickname:'!'}],
    [{...valid[0],elapsedMs:0}],[{...valid[0],elapsedMs:1.5}],[{...valid[0],at:-1}]])assert.throws(()=>validateDodgeRanking(value));
});

test('real socket wiring enforces arcade access, accepts no-ack input, broadcasts physics, completes collision, and cancels on map leave',async t=>{
  const game=createClassroomServer({teacherKey:'dodge-socket-test-secret',studentHours:false}),address=await game.listen();
  const socket=io(`http://127.0.0.1:${address.port}`,{transports:['websocket'],forceNew:true,reconnection:false});
  t.after(async()=>{socket.disconnect();await game.close();});
  await new Promise((resolve,reject)=>{socket.once('connect',resolve);socket.once('connect_error',reject);});
  const created=await socketCall(socket,'room:create',{teacherKey:'dodge-socket-test-secret',title:'회피 테스트',allowedNames:['1']});
  assert.equal(created.ok,true);assert.equal((await socketCall(socket,'dodge:start',{})).ok,false);
  const room=game.store.rooms.get(created.room.code),player=room.players.get(created.selfId),machine=STREET.objects.find(object=>object.gameId==='dodge');
  Object.assign(player,{mapId:STREET_ID,x:machine.x,y:machine.y+50});
  assert.deepEqual(await socketCall(socket,'dodge:ranking',{}),{ok:true,ranking:[]});
  const started=await socketCall(socket,'dodge:start',{});assert.equal(started.ok,true);assert.equal(started.arenaWidth,600);assert.equal(started.stars.length,2);
  socket.emit('dodge:input',{runId:started.runId,x:20,y:0,elapsedMs:999999999});
  const moved=await new Promise((resolve,reject)=>{
    const timeout=setTimeout(()=>reject(new Error('dodge movement broadcast timeout')),1500);
    const listener=event=>{if(event.state?.runId===started.runId&&event.state.player.x>300){clearTimeout(timeout);socket.off('dodge:state',listener);resolve(event);}};
    socket.on('dodge:state',listener);
  });
  assert.equal(moved.finished,false);assert.ok(moved.state.elapsedMs<999999999);
  const run=room.dodgeRuns.get(player.id);run.stars=[{id:'socket-hit',x:run.playerBody.x,y:run.playerBody.y,vx:0,vy:0,radius:10}];
  const finished=await new Promise((resolve,reject)=>{
    const timeout=setTimeout(()=>reject(new Error('dodge finish broadcast timeout')),1500);
    const listener=event=>{if(event.finished&&event.state?.runId===started.runId&&event.result){clearTimeout(timeout);socket.off('dodge:state',listener);resolve(event);}};
    socket.on('dodge:state',listener);
  });
  assert.equal(finished.state.status,'pending');assert.ok(finished.result.elapsedMs>0);assert.equal(finished.result.rank,1);
  assert.equal(room.dodgeRuns.size,0);assert.equal((await socketCall(socket,'dodge:ranking',{})).ranking.length,1);
  const second=await socketCall(socket,'dodge:start',{});assert.equal(second.ok,true);player.mapId='star-origin';
  for(let i=0;i<20&&room.dodgeRuns.has(player.id);i++)await sleep(25);
  assert.equal(room.dodgeRuns.has(player.id),false);assert.equal(room.dodgeRanking.length,1);
});
