import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {io} from 'socket.io-client';
import {createClassroomServer} from '../server/app.js';
import {MAP,STREET,PLAZA_ID,STREET_ID,GARDEN_ID} from '../shared/config.js';
const key='temple-test-private-not-real-key';
test('five arcade machines require an authenticated player on the correct map and nearby',async()=>{
 const game=createClassroomServer({teacherKey:key,studentHours:false}),address=await game.listen();
 const socket=io('http://127.0.0.1:'+address.port,{transports:['websocket'],reconnection:false});
 const call=(event,data={})=>new Promise((r,j)=>socket.timeout(3000).emit(event,data,(e,v)=>e?j(e):r(v)));
 try{
  await new Promise((r,j)=>{socket.once('connect',r);socket.once('connect_error',j);});
  assert.equal((await call('arcade:open',{objectId:'arcade-memory'})).ok,false);
  const created=await call('room:create',{teacherKey:key,title:'오락기 검사',allowedNames:['1']});const room=game.store.rooms.get(created.room.code),p=room.players.get(created.selfId);
  assert.equal((await call('arcade:open',{objectId:'arcade-memory'})).ok,false);
  const machines=STREET.objects.filter(o=>o.kind==='arcade');assert.equal(machines.length,5);
  for(const machine of machines){Object.assign(p,{mapId:STREET_ID,x:machine.x,y:machine.y+65});const r=await call('arcade:open',{objectId:machine.id});assert.equal(r.gameId,machine.gameId);}
  assert.equal((await call('arcade:open',{objectId:'made-up-game'})).ok,false);assert.equal(p.starShards,0);
 }finally{socket.disconnect();await game.close();}
});
test('temple enforces proximity and teacher permissions, preserves daily notices and actual weekly grants on restart',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'temple-check-')),sockets=[];let game;
 const call=(s,event,data={})=>new Promise((resolve,reject)=>s.timeout(3000).emit(event,data,(e,r)=>e?reject(e):resolve(r)));
 async function start(){game=createClassroomServer({teacherKey:key,dataDir:dir,studentHours:false});return await game.listen();}
 async function connect(port){const s=io('http://127.0.0.1:'+port,{transports:['websocket'],forceNew:true,reconnection:false});sockets.push(s);await new Promise((resolve,reject)=>{s.once('connect',resolve);s.once('connect_error',reject);});return s;}
 try{
  const a=await start(),teacher=await connect(a.port),student=await connect(a.port);
  const made=await call(teacher,'room:create',{teacherKey:key,title:'신전 검사',allowedNames:['1','2']});assert.equal(made.ok,true);
  const joined=await call(student,'room:join',{code:made.room.code,nickname:'1',pin:made.credentials.find(c=>c.nickname==='1').pin});assert.equal(joined.ok,true);
  let room=game.store.rooms.get(made.room.code),t=room.players.get(made.selfId),p=room.players.get(joined.selfId);
  const refresh=()=>{room=game.store.rooms.get(made.room.code);t=room.players.get(made.selfId);p=room.players.get(joined.selfId);};
  const approach=(who,id)=>{const o=MAP.objects.find(o=>o.id===id);const current=game.store.rooms.get(made.room.code).players.get(who.id);Object.assign(current,{mapId:PLAZA_ID,x:o.x+65,y:o.y});};
  assert.equal((await call(student,'temple:read',{objectId:'pillar-notice'})).ok,false);
  for(const [id,text] of [['pillar-notice','내일 색연필을 준비해요.']]){
   approach(t,id);approach(p,id);assert.equal((await call(student,'temple:save',{objectId:id,text:'위조'})).ok,false);
   assert.equal((await call(teacher,'temple:save',{objectId:id,text})).ok,true);
   const viewed=await call(student,'temple:read',{objectId:id});assert.equal(viewed.text,text);assert.equal(viewed.canEdit,false);
   assert.equal((await call(teacher,'temple:save',{objectId:id,text:'가'.repeat(2001)})).ok,false);
  }
  approach(t,'pillar-timetable');approach(p,'pillar-timetable');
  const cells=Array.from({length:6},()=>Array(5).fill(''));cells[0][0]='국어';cells[5][4]='체육';
  assert.equal((await call(student,'temple:timetable:save',{objectId:'pillar-timetable',cells})).ok,false);
  assert.equal((await call(teacher,'temple:save',{objectId:'pillar-timetable',text:'옛 메모'})).ok,false);
  assert.deepEqual((await call(teacher,'temple:timetable:save',{objectId:'pillar-timetable',cells})).cells,cells);
  const timetable=await call(student,'temple:read',{objectId:'pillar-timetable'});assert.deepEqual(timetable.cells,cells);assert.equal(timetable.canEdit,false);
  assert.equal((await call(teacher,'temple:timetable:save',{objectId:'pillar-timetable',cells:[['국어']]})).ok,false);
  refresh();p.starShards=9998;await call(teacher,'shards:give',{playerId:p.id,amount:5});await call(teacher,'shards:give',{playerId:p.id,amount:-2});await call(teacher,'shards:give',{playerId:'all',amount:3});
  // 상한까지 1개, 회수 뒤 상한까지 2개를 실제로 받았습니다. 다른 학생은 3개입니다.
  approach(p,'pillar-weekly');const weekly=await call(student,'temple:read',{objectId:'pillar-weekly'});assert.equal(weekly.rows.find(r=>r.playerId===p.id).total,3);assert.equal(weekly.rows.find(r=>r.nickname==='2').total,3);assert.equal(JSON.stringify(weekly).includes('starShards'),false);
  p.effects=[{itemId:'space-snack',icon:'★',label:'반짝임',style:'sparkle',until:Date.now()+10000,fromId:t.id,fromNickname:'비밀발신',secret:true}];approach(p,'pillar-effects');
  const active=await call(student,'temple:read',{objectId:'pillar-effects'});assert.equal(active.rows.length,1);assert.equal(JSON.stringify(active).includes('비밀발신'),false);
  p.mapId=GARDEN_ID;assert.equal((await call(student,'temple:read',{objectId:'pillar-effects'})).ok,false);
  for(const s of sockets)s.disconnect();await game.close();game=null;
  const b=await start(),returning=await connect(b.port);const resumed=await call(returning,'room:join',{code:made.room.code,nickname:'1',pin:made.credentials.find(c=>c.nickname==='1').pin});assert.equal(resumed.selfId,p.id);
  const restored=game.store.rooms.get(made.room.code),rp=restored.players.get(p.id);approach(rp,'pillar-notice');assert.equal((await call(returning,'temple:read',{objectId:'pillar-notice'})).text,'내일 색연필을 준비해요.');
  approach(rp,'pillar-timetable');assert.deepEqual((await call(returning,'temple:read',{objectId:'pillar-timetable'})).cells,cells);
  approach(rp,'pillar-weekly');assert.equal((await call(returning,'temple:read',{objectId:'pillar-weekly'})).rows.find(r=>r.playerId===p.id).total,3);
 }finally{for(const s of sockets)s.disconnect();if(game)await game.close();await rm(dir,{recursive:true,force:true});}
});
