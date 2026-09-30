import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync,readFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,dirname,resolve} from 'node:path';
import {io} from 'socket.io-client';
import {createClassroomServer} from '../server/app.js';

test('LV1~4 모든 대상 아이템: 미접속 지정, 보호·레벨·중복거부, 저장 실패 복원·재시작·로그인',async t=>{
  const root=resolve(tmpdir()),dir=mkdtempSync(join(root,'class-offline-item-')),key='offline-item-test-key';
  let now=Date.now()+10000,game,sockets=[],code;
  const start=async()=>{game=createClassroomServer({teacherKey:key,studentHours:false,unattended:true,dataDir:dir,clock:()=>now});await game.listen();};
  const connect=async()=>{const s=io(`http://127.0.0.1:${game.http.address().port}`,{transports:['websocket'],reconnection:false,autoConnect:false});sockets.push(s);await new Promise((r,j)=>{s.once('connect',r);s.once('connect_error',j);s.connect();});return s;};
  const call=(s,event,data={})=>s.timeout(4000).emitWithAck(event,data);
  t.after(async()=>{sockets.forEach(s=>s.disconnect());await game?.close();assert.equal(dirname(resolve(dir)),root);rmSync(dir,{recursive:true,force:true});});
  await start();const teacher=await connect();const made=await call(teacher,'room:create',{teacherKey:key,studentAccounts:['사용자','미접속1','미접속2','미접속3'].map(nickname=>({nickname,pin:'1234'}))});assert.ok(made.ok,made.error);code=made.room.code;
  const a=await connect(),joined=await call(a,'room:join',{code,nickname:'사용자',pin:'1234'});assert.ok(joined.ok);
  const room=()=>game.store.rooms.get(code),actor=()=>room().players.get(joined.selfId),friends=()=>[...room().players.values()].filter(p=>p.role==='student'&&p.id!==joined.selfId);
  game.store.transact(()=>{actor().avatar.level=2;actor().inventory=[{id:'sun-card',quantity:1},{id:'space-food-card',quantity:1},{id:'little-sun-card',quantity:1}];});
  assert.equal(friends().length,3);assert.ok(friends().every(p=>!p.connected));const ids=friends().map(p=>p.id);
  assert.equal((await call(a,'item:use',{itemId:'little-sun-card',targetId:'unknown-student'})).ok,false);
  assert.equal((await call(a,'item:use',{itemId:'sun-card',targetIds:[ids[0],ids[0],ids[2]]})).ok,false);
  assert.equal((await call(a,'item:use',{itemId:'sun-card',targetIds:[...ids.slice(0,2),'unknown-student']})).ok,false);
  const target=()=>room().players.get(ids[0]);target().avatar.level=3;
  assert.equal((await call(a,'item:use',{itemId:'sun-card',targetIds:ids})).ok,false);target().avatar.level=1;
  target().cardMarkers=[{id:'test-moon',itemId:'little-moon-card',fromId:target().id,fromNickname:target().nickname,until:now+3600000}];
  assert.equal((await call(a,'item:use',{itemId:'space-food-card',targetId:ids[0]})).ok,false);target().cardMarkers=[];
  const food=await call(a,'item:use',{itemId:'space-food-card',targetId:ids[0]});assert.ok(food.ok,food.error);assert.ok(target().cardMarkers.some(m=>m.itemId==='space-food-card'&&m.until===null));
  now+=2100;
  const save=game.store.files.save.bind(game.store.files);game.store.files.save=()=>{throw Error('offline-item-test write failure');};
  try{assert.equal((await call(a,'item:use',{itemId:'sun-card',targetIds:ids})).ok,false);}finally{game.store.files.save=save;}
  assert.ok(actor().inventory.some(i=>i.id==='sun-card'));assert.ok(friends().every(p=>!p.cardMarkers.some(m=>m.itemId==='sun-card')));
  const sun=await call(a,'item:use',{itemId:'sun-card',targetIds:ids});assert.ok(sun.ok,sun.error);assert.ok(friends().every(p=>p.cardMarkers.some(m=>m.itemId==='sun-card')));
  assert.ok(!actor().inventory.some(i=>i.id==='sun-card'||i.id==='space-food-card'));
  // 일반/두 명/본인+두 명/LV4 전용 UI 경로도 오프라인 대상에게 동일하게 저장합니다.
  actor().avatar.level=4;
  for(const [itemId,data] of [
    ['space-suit-card',{targetId:ids[0],secondTargetId:ids[1]}],
    ['satellite-card',{targetIds:ids.slice(0,2)}],
    ['space-station-card',{targetIds:ids.slice(0,2)}],
    ['great-spaceship-card',{targetIds:ids.slice(0,2)}],
    ['total-eclipse-card',{targetIds:ids}]
  ]){
    now+=2100;actor().inventory.push({id:itemId,quantity:1});
    const used=await call(a,'item:use',{itemId,...data});assert.ok(used.ok,`${itemId}: ${used.error}`);
    assert.ok(target().cardMarkers.some(m=>m.itemId===itemId),itemId);
  }
  const options=await call(a,'lv4:info');assert.ok(options.ok,options.error);
  assert.ok(ids.every(id=>options.players.some(p=>p.id===id&&p.connected===false)));
  const record=JSON.parse(readFileSync(join(dir,code+'.json'),'utf8'));assert.ok(record.students.find(p=>p.id===ids[0]).cardMarkers.some(m=>m.itemId==='space-food-card'));
  sockets.forEach(s=>s.disconnect());await game.close();await start();const teacher2=await connect();assert.ok((await call(teacher2,'room:open',{teacherKey:key,code})).ok);
  const b=await connect(),back=await call(b,'room:join',{code,nickname:'미접속1',pin:'1234'});assert.ok(back.ok,back.error);
  const restored=room().players.get(ids[0]);assert.ok(restored.connected);assert.ok(restored.cardMarkers.some(m=>m.itemId==='sun-card'));assert.ok(restored.cardMarkers.some(m=>m.itemId==='space-food-card'));
  for(const itemId of ['space-suit-card','satellite-card','space-station-card','great-spaceship-card','total-eclipse-card'])assert.ok(restored.cardMarkers.some(m=>m.itemId===itemId),itemId);
});
