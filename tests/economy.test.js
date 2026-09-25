import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {io} from 'socket.io-client';
import {PersistentRoomStore,toRecord,fromRecord} from '../server/persistent-rooms.js';
import {createClassroomServer} from '../server/app.js';
import {SHOP,STREET,STREET_ID,itemOf} from '../shared/config.js';
import {formatCurrency} from '../shared/economy.js';

function stored(t){
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'class-two-currencies-'));
  let store=new PersistentRoomStore(dir);
  t.after(()=>{store.close();fs.rmSync(dir,{recursive:true,force:true});});
  const session=store.transact(()=>store.create({title:'두 재화',allowedNames:['1','2']},'teacher'));
  const joined=store.transact(()=>store.join({code:session.room.code,nickname:'1',pin:'1234'},'student'));
  return {get store(){return store;},...session,student:joined.player,
    restart(){store.close();store=new PersistentRoomStore(dir);return store;}};
}

test('기존 저장은 우주에너지0으로 읽고 손상된 신규 잔액은 거부한다',t=>{
  const f=stored(t);f.student.starShards=37;
  const old=toRecord(f.room);delete old.students[0].cosmicEnergy;
  const restored=fromRecord(old).players.get(f.student.id);
  assert.equal(restored.cosmicEnergy,0);assert.equal(restored.starShards,37);
  for(const bad of [-1,1.5,'4',null,Infinity,Number.MAX_SAFE_INTEGER+1]){
    const record=structuredClone(old);record.students[0].cosmicEnergy=bad;
    assert.throws(()=>fromRecord(record),/올바르지/);
  }
});

test('두 재화는 별도로 저장·재시작 복원되며 본인과 교사만 잔액을 본다',t=>{
  const f=stored(t);
  f.store.transact(()=>{f.student.cosmicEnergy=123;f.student.starShards=45;});
  const other=f.store.transact(()=>f.store.join({code:f.room.code,nickname:'2',pin:'2222'},'other')).player;
  const otherView=f.store.snapshot(f.room,other).players.find(p=>p.id===f.student.id);
  assert.equal('cosmicEnergy' in otherView,false);assert.equal('starShards' in otherView,false);
  const teacherView=f.store.snapshot(f.room,f.player).players.find(p=>p.id===f.student.id);
  assert.equal(teacherView.cosmicEnergy,123);
  const code=f.room.code,playerId=f.student.id,store=f.restart();
  store.transact(()=>store.open({code},'new-teacher'));
  const back=store.transact(()=>store.join({code,nickname:'1',pin:'1234'},'new-student')).player;
  assert.equal(back.id,playerId);assert.equal(back.cosmicEnergy,123);assert.equal(back.starShards,45);
  assert.equal(formatCurrency(back,'cosmicEnergy'),'123');
  assert.match(formatCurrency({role:'teacher',cosmicEnergy:0},'cosmicEnergy'),/∞/);
});

test('기존 상점은 별 파편만 차감하고 요청한 우주에너지·통화 위조는 무시한다',async t=>{
  assert.equal(SHOP.currency,'starShards');
  const teacherKey='two-currency-isolated-key',game=createClassroomServer({teacherKey,studentHours:false});
  const {port}=await game.listen(),sockets=[];
  t.after(async()=>{for(const s of sockets)s.disconnect();await game.close();});
  const connect=async()=>{const s=io('http://127.0.0.1:'+port,{transports:['websocket'],forceNew:true,reconnection:false});sockets.push(s);await new Promise((r,j)=>{s.once('connect',r);s.once('connect_error',j);});return s;};
  const call=(s,event,data)=>s.timeout(4000).emitWithAck(event,data);
  const teacher=await connect(),created=await call(teacher,'room:create',{teacherKey,title:'두 재화',allowedNames:['1']});
  const student=await connect(),joined=await call(student,'room:join',{code:created.room.code,nickname:'1',cosmicEnergy:999,starShards:999});
  assert.equal(joined.ok,true);
  const p=game.store.rooms.get(created.room.code).players.get(joined.selfId),shop=STREET.objects.find(o=>o.kind==='shop');
  assert.equal(p.cosmicEnergy,0);assert.equal(p.starShards,0);
  Object.assign(p,{cosmicEnergy:100,starShards:0,mapId:STREET_ID,x:shop.x,y:shop.y});
  const data={itemId:'space-food-card',quantity:2,currency:'cosmicEnergy',cosmicEnergy:999,starShards:999};
  assert.equal((await call(student,'shop:buy',data)).ok,false);assert.equal(p.cosmicEnergy,100);
  p.starShards=10;
  assert.equal((await call(student,'shop:buy',data)).ok,true);
  assert.equal(p.starShards,10-itemOf(data.itemId).price*2);assert.equal(p.cosmicEnergy,100);
});
