import test from 'node:test';
import assert from 'node:assert/strict';
import {startStarRun,clickStar,starRanking,cancelStarRun,validateStarRanking} from '../server/star-game.js';
import {currentWeekRecords,weekStartKst} from '../server/weekly-ranking.js';
import {createClassroomServer} from '../server/app.js';
import {STREET,STREET_ID} from '../shared/config.js';
import {io} from 'socket.io-client';

const player={id:'a',nickname:'1'};
function finish(room,elapsed,p=player){
  let state=startStarRun(room,p,0);
  for(let i=0;i<10;i++)state=clickStar(room,p,{runId:state.runId,step:state.step,target:state.target},elapsed*(i+1)/10);
  return state;
}
test('반짝별은 서로 다른 16칸 목표를 10회 처리하고 서버 시간만 기록한다',()=>{
  const room={};let state=startStarRun(room,player,100);assert.equal(state.step,0);
  for(let i=0;i<10;i++){
    const old=state.target;assert.ok(old>=0&&old<16);
    const next=clickStar(room,player,{runId:state.runId,step:state.step,target:old,elapsedMs:1},200+i*100);
    if(i<9)assert.notEqual(next.target,old);state=next;
  }
  assert.equal(state.done,true);assert.equal(state.elapsedMs,1000);assert.equal(state.rank,1);assert.equal(room.starRuns.size,0);
});
test('틀린 칸·다른 학생·중복 클릭·만료된 게임은 기록을 만들 수 없다',()=>{
  const room={},state=startStarRun(room,player,0);
  assert.throws(()=>clickStar(room,{id:'other'},state,100));
  assert.throws(()=>clickStar(room,player,{...state,target:(state.target+1)%16},100));
  assert.equal(room.starRuns.get(player.id).step,0);
  clickStar(room,player,state,100);assert.throws(()=>clickStar(room,player,state,200));
  const fresh=startStarRun(room,player,0);assert.throws(()=>clickStar(room,player,fresh,300001));
  cancelStarRun(room,player,state.runId);assert.equal(room.starRuns.size,1);
  cancelStarRun(room,player,fresh.runId);assert.equal(room.starRuns.size,0);assert.equal(starRanking(room).length,0);
});
test('빠른 기록 10개만 보관하고 느린 신규 기록은 순위 밖으로 처리한다',()=>{
  const room={};for(let i=12;i>=1;i--)finish(room,i*1000);
  assert.deepEqual(starRanking(room).map(r=>r.elapsedMs),Array.from({length:10},(_,i)=>(i+1)*1000));
  assert.equal(finish(room,20000).rank,null);assert.equal(starRanking(room).length,10);
  assert.equal(starRanking({}).length,0);
});
test('한국 월요일 0시 경계·연도 경계를 적용하고 미래 주 기록도 제외한다',()=>{
  const monday=Date.parse('2026-09-14T00:00:00+09:00');
  assert.equal(weekStartKst(monday),monday);assert.equal(weekStartKst(monday-1),monday-7*86400000);
  const values=[{at:monday-1},{at:monday},{at:monday+7*86400000-1},{at:monday+7*86400000}];
  assert.deepEqual(currentWeekRecords(values,monday),values.slice(1,3));
  assert.equal(weekStartKst(Date.parse('2027-01-01T12:00:00+09:00')),Date.parse('2026-12-28T00:00:00+09:00'));
});
test('저장된 별 찾기 기록은 손상·음수·10개 초과를 조용히 수용하지 않는다',()=>{
  const room={};finish(room,500);const rows=starRanking(room);
  assert.equal(validateStarRanking(rows).length,1);assert.deepEqual(validateStarRanking(undefined),[]);
  for(const value of [null,[{...rows[0],elapsedMs:-1}],Array(11).fill(rows[0])])assert.throws(()=>validateStarRanking(value));
});
test('실제 소켓은 오락기 근접을 확인하며 같은 교실의 랭킹만 반환한다',async t=>{
  const key='star-test-private-teacher',game=createClassroomServer({teacherKey:key,studentHours:false}),address=await game.listen(),sockets=[];
  t.after(async()=>{sockets.forEach(s=>s.disconnect());await game.close();});
  const connect=async()=>{const s=io('http://127.0.0.1:'+address.port,{transports:['websocket'],reconnection:false});sockets.push(s);await new Promise(r=>s.once('connect',r));return s;};
  const call=(s,event,data={})=>s.timeout(3000).emitWithAck(event,data),a=await connect(),b=await connect();
  assert.equal((await call(a,'stars:start')).ok,false);
  const ra=await call(a,'room:create',{teacherKey:key,allowedNames:['1']}),rb=await call(b,'room:create',{teacherKey:key,allowedNames:['2']});
  assert.equal((await call(a,'stars:start')).ok,false);
  const room=game.store.rooms.get(ra.room.code),p=room.players.get(ra.selfId),machine=STREET.objects.find(o=>o.gameId==='stars');Object.assign(p,{mapId:STREET_ID,x:machine.x,y:machine.y+60});
  let state=await call(a,'stars:start');assert.equal(state.ok,true);
  for(let i=0;i<10;i++)state=await call(a,'stars:click',{runId:state.runId,step:state.step,target:state.target,elapsedMs:1});
  assert.equal(state.done,true);assert.equal((await call(a,'stars:ranking')).ranking.length,1);
  const other=game.store.rooms.get(rb.room.code).players.get(rb.selfId);Object.assign(other,{mapId:STREET_ID,x:machine.x,y:machine.y+60});
  assert.equal((await call(b,'stars:ranking')).ranking.length,0);
});
