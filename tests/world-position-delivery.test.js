import test from 'node:test';
import assert from 'node:assert/strict';
import {emitWorldPositions} from '../server/world-broadcast.js';
import {visiblePositions} from '../server/teacher-ghost.js';
const fake=()=>{
  const sent=[],socket={connected:true,data:{},conn:{transport:{writable:true}},volatile:{emit:(event,frame)=>sent.push({event,frame})}};
  return {socket,sent};
};
const frame=positions=>({positionTime:100,monsters:[{id:'boss',x:10,y:20}],positions});
test('버려진 마지막 이동 델타는 다음 writable 빈 델타에서 최신 전체 좌표로 복구하고 그 다음에는 델타로 돌아간다',()=>{
  const {socket,sent}=fake();let fullCalls=0,current=[['p',4,5,1]];
  const full=()=>{fullCalls++;return current;};
  socket.conn.transport.writable=false;
  for(let i=0;i<10;i++)assert.equal(emitWorldPositions(socket,frame,[['p',i,i,1]],full),false);
  assert.equal(sent.length,0);assert.equal(fullCalls,0);assert.equal(socket.data.worldPositionResync,true);
  current=[['p',20,30,1]];socket.conn.transport.writable=true;
  assert.equal(emitWorldPositions(socket,frame,[],full),true);assert.deepEqual(sent[0].frame.positions,current);
  assert.equal(sent[0].event,'world:positions');assert.deepEqual(sent[0].frame.monsters,[{id:'boss',x:10,y:20}]);
  assert.equal(fullCalls,1);assert.equal(socket.data.worldPositionResync,false);
  emitWorldPositions(socket,frame,[],full);assert.deepEqual(sent[1].frame.positions,[]);assert.equal(fullCalls,1);
});
test('재동기화는 관찰자별이며 숨은 교사 위치 필터와 다른 연결의 델타를 보존한다',()=>{
  const a=fake(),b=fake(),student={id:'p',role:'student'},teacher={id:'t',role:'teacher',teacherGhost:true};
  const room={players:new Map([['p',student],['t',teacher]])},all=[['p',5,6,1],['t',30,40,1]];
  a.socket.conn.transport.writable=false;emitWorldPositions(a.socket,frame,[all[0]],()=>all);
  emitWorldPositions(b.socket,frame,[],()=>all);assert.deepEqual(b.sent[0].frame.positions,[]);
  a.socket.conn.transport.writable=true;
  emitWorldPositions(a.socket,frame,[],()=>visiblePositions(room,all,student));assert.deepEqual(a.sent[0].frame.positions,[all[0]]);
  assert.equal(b.socket.data.worldPositionResync,false);
});
test('연결 종료와 프레임 준비 중 전송불가도 큐를 만들지 않고 다음 가능한 전송만 복구한다',()=>{
  const {socket,sent}=fake();socket.connected=false;
  assert.equal(emitWorldPositions(socket,frame,[],()=>[]),false);assert.equal(sent.length,0);
  socket.connected=true;
  assert.equal(emitWorldPositions(socket,positions=>{socket.conn.transport.writable=false;return frame(positions);},[['p',1,2,1]],()=>[]),false);
  assert.equal(sent.length,0);assert.equal(socket.data.worldPositionResync,true);
  socket.conn.transport.writable=true;emitWorldPositions(socket,frame,[],()=>[['p',3,4,1]]);
  assert.deepEqual(sent[0].frame.positions,[['p',3,4,1]]);
});
