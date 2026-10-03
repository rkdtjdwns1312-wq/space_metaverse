import test from 'node:test';
import assert from 'node:assert/strict';
import {io} from 'socket.io-client';
import {createClassroomServer} from '../server/app.js';
import {advancePassiveRecovery,PASSIVE_RECOVERY_MS} from '../server/passive-recovery.js';
import {ensureVitals} from '../server/vitals.js';

function fixture(level=4){
  const p={id:'p',connected:true,role:'student',avatar:{level,constellationId:'leo'},mapId:'star-plaza'};
  const room={players:new Map([[p.id,p]])};
  return {p,room,value:ensureVitals(p)};
}

test('모든 아바타는 서버 시간 10초마다 최대 HP/MP의 10%를 회복하고 최대치를 넘지 않는다',()=>{
  const {p,room,value}=fixture();value.hp=10;value.mp=5;
  assert.equal(PASSIVE_RECOVERY_MS,10000);
  assert.deepEqual(advancePassiveRecovery(room,1000),[]);
  assert.deepEqual(advancePassiveRecovery(room,10999),[]);
  assert.deepEqual(advancePassiveRecovery(room,11000).map(u=>u.playerId),['p']);
  assert.deepEqual([value.hp,value.mp],[19,9]);
  advancePassiveRecovery(room,31000);assert.deepEqual([value.hp,value.mp],[37,17]);
  advancePassiveRecovery(room,200000);assert.deepEqual([value.hp,value.mp],[90,40]);
  assert.deepEqual(advancePassiveRecovery(room,210000),[]);
  p.avatar.level=1;const small=ensureVitals(p);small.hp=1;small.mp=0;
  advancePassiveRecovery(room,220000);advancePassiveRecovery(room,230000);
  assert.equal(small.mp,1);
});

test('맵 이동에도 주기는 유지하고 접속 종료·자리 비움·쓰러짐에는 누적하지 않는다',()=>{
  const {p,room,value}=fixture();value.hp=5;value.mp=5;
  advancePassiveRecovery(room,0);p.mapId='other';advancePassiveRecovery(room,10000);
  assert.deepEqual([value.hp,value.mp],[14,9]);
  p.connected=false;advancePassiveRecovery(room,20000);p.connected=true;
  advancePassiveRecovery(room,30000);assert.deepEqual([value.hp,value.mp],[14,9]);
  advancePassiveRecovery(room,40000);assert.deepEqual([value.hp,value.mp],[23,13]);
  p.away=true;advancePassiveRecovery(room,50000);p.away=false;value.hp=0;
  advancePassiveRecovery(room,60000);assert.equal(value.hp,0);
  value.hp=1;advancePassiveRecovery(room,70000);advancePassiveRecovery(room,80000);
  assert.equal(value.hp,10);
});

test('변신 중에는 늘어난 최대치 기준으로 같은 10초 주기만 적용한다',()=>{
  const {p,room}=fixture(5);p.avatar.constellationId='corvus';p.transformation={active:true};
  const value=ensureVitals(p);value.hp=10;value.mp=10;
  advancePassiveRecovery(room,0);advancePassiveRecovery(room,9999);
  assert.deepEqual([value.hp,value.mp],[10,10]);
  advancePassiveRecovery(room,10000);assert.deepEqual([value.hp,value.mp],[18,17]);
});

test('접속 중 학생의 자동 회복은 서버가 같은 맵 화면에 전송한다',async t=>{
  let now=1000000;const key='passive-recovery-test',game=createClassroomServer({teacherKey:key,studentHours:false,clock:()=>now}),{port}=await game.listen();
  const sockets=[];t.after(async()=>{sockets.forEach(s=>s.disconnect());await game.close();});
  const connect=async()=>{const s=io(`http://127.0.0.1:${port}`,{transports:['websocket'],reconnection:false});sockets.push(s);await new Promise((resolve,reject)=>{s.once('connect',resolve);s.once('connect_error',reject);});return s;};
  const call=(s,event,data={})=>s.timeout(3000).emitWithAck(event,data);
  const teacher=await connect(),student=await connect(),created=await call(teacher,'room:create',{teacherKey:key,allowedNames:['회복검사']});
  const joined=await call(student,'room:join',{code:created.room.code,nickname:'회복검사'}),p=game.store.rooms.get(created.room.code).players.get(joined.selfId);
  p.avatar.level=4;const value=ensureVitals(p);value.hp=10;value.mp=0;
  await new Promise(resolve=>setTimeout(resolve,120));
  const update=new Promise((resolve,reject)=>{const timeout=setTimeout(()=>reject(Error('자동 회복 전송 없음')),2000);student.on('combat:vitals',data=>{if(data.playerId===p.id&&data.vitals.hp.current===16){clearTimeout(timeout);resolve(data);}});});
  now+=10000;const result=await update;
  assert.deepEqual([result.vitals.hp.current,result.vitals.mp.current],[16,4]);
});
