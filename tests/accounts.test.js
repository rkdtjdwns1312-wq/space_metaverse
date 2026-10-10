import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {io} from 'socket.io-client';
import {createClassroomServer} from '../server/app.js';
import {RoomStore,GameError} from '../server/rooms.js';
const key='managed-classroom-test-private-key';
const call=(s,event,data={})=>s.timeout(5000).emitWithAck(event,data);
test('새로고침 뒤 학생은 PIN으로 같은 비저장 교실 계정에 다시 입장한다',()=>{
  const store=new RoomStore(),{room}=store.create({title:'별빛교실',allowedNames:['별이']},'teacher-socket');
  const first=store.join({code:room.code,nickname:'별이',pin:'1234'},'student-one').player;
  first.starShards=7;
  const oldToken=first.token;
  first.connected=false;first.expiresAt=Date.now()+60_000;
  assert.throws(()=>store.join({code:room.code,nickname:'별이',pin:'0000'},'student-two'),GameError);
  assert.equal(first.connected,false);
  const second=store.join({code:room.code,nickname:'별이',pin:'1234'},'student-three').player;
  assert.equal(second.id,first.id);
  assert.equal(second.starShards,7);
  assert.equal(store.sessions.has(oldToken),false);
  assert.equal(store.sessions.has(second.token),true);
});
test('PIN 없이 만들었던 임시 계정은 예전 토큰 없이는 인계하지 못한다',()=>{
  const store=new RoomStore(),{room}=store.create({title:'별빛교실',allowedNames:['별이']},'teacher-socket');
  const first=store.join({code:room.code,nickname:'별이'},'student-one').player;
  first.starShards=7;first.connected=false;first.expiresAt=Date.now()+60_000;
  assert.throws(()=>store.join({code:room.code,nickname:'별이',pin:'0000'},'stranger'),GameError);
  assert.equal(first.connected,false);
  const resumed=store.join({code:room.code,nickname:'별이',token:first.token},'student-two').player;
  assert.equal(resumed.id,first.id);assert.equal(resumed.starShards,7);
});
test('teacher creates accounts; students cannot self-enroll; own password and teacher edits persist with stable assets',async t=>{
  const dir=await mkdtemp(join(tmpdir(),'managed-accounts-')),sockets=[];
  let game=createClassroomServer({teacherKey:key,dataDir:dir,studentHours:false}),address=await game.listen();
  t.after(async()=>{for(const s of sockets)s.disconnect();await game.close();await rm(dir,{recursive:true,force:true});});
  async function connect(){const s=io('http://127.0.0.1:'+address.port,{transports:['websocket'],reconnection:false});sockets.push(s);await new Promise((r,j)=>{s.once('connect',r);s.once('connect_error',j);});return s;}
  const teacher=await connect(),created=await call(teacher,'room:create',{teacherKey:key,title:'계정교실',allowedNames:['별이']});
  assert.ok(created.ok,created.error);assert.equal(created.credentials[0].nickname,'별이');
  const code=created.room.code,pin=created.credentials[0].pin,student=await connect();
  const login=await call(student,'room:join',{code,nickname:'별이',pin});assert.ok(login.ok,login.error);
  const room=game.store.rooms.get(code),p=room.players.get(login.selfId);p.starShards=8;
  assert.equal('pin' in login.room.players.find(x=>x.id===p.id),false);
  assert.equal((await call(student,'student:create',{nickname:'위조',pin:'1234'})).ok,false);
  room.allowedNames.add('아직안만듦');
  assert.equal((await call(await connect(),'room:join',{code,nickname:'아직안만듦',pin:'1234'})).ok,false);
  const newPin=pin==='9876'?'8765':'9876';
  const wrong=await call(student,'student:password',{currentPin:pin==='0000'?'1111':'0000',pin:newPin});assert.equal(wrong.ok,false);
  const changed=await call(student,'student:password',{currentPin:pin,pin:newPin,playerId:created.selfId});assert.ok(changed.ok,changed.error);
  assert.notEqual(changed.token,login.token);assert.equal(game.store.sessions.has(login.token),false);
  await call(student,'room:leave');
  assert.equal((await call(student,'room:join',{code,nickname:'별이',pin})).ok,false);
  assert.ok((await call(student,'room:join',{code,nickname:'별이',pin:newPin})).ok);
  const updated=await call(teacher,'student:update',{playerId:p.id,nickname:'달이',pin:'4567'});assert.ok(updated.ok,updated.error);
  assert.equal(game.store.rooms.get(code).players.get(p.id).starShards,8);
  assert.equal((await call(student,'room:join',{code,nickname:'별이',pin:newPin})).ok,false);
  assert.ok((await call(student,'room:join',{code,nickname:'달이',pin:'4567'})).ok);
  assert.equal((await call(student,'student:update',{playerId:p.id,nickname:'해킹',pin:'2222'})).ok,false);
  await game.close();game=createClassroomServer({teacherKey:key,dataDir:dir,studentHours:false});address=await game.listen();
  const back=await call(await connect(),'room:join',{code,nickname:'달이',pin:'4567'});assert.ok(back.ok,back.error);assert.equal(back.selfId,p.id);
  assert.equal(back.room.players.find(x=>x.id===p.id).starShards,8);
});

test('teacher-chosen student PINs are created with the classroom and remain valid after restart',async t=>{
  const dir=await mkdtemp(join(tmpdir(),'chosen-accounts-')),sockets=[];
  let game=createClassroomServer({teacherKey:key,dataDir:dir,studentHours:false}),address=await game.listen();
  t.after(async()=>{for(const socket of sockets)socket.disconnect();await game.close();await rm(dir,{recursive:true,force:true});});
  async function connect(){const socket=io('http://127.0.0.1:'+address.port,{transports:['websocket'],reconnection:false});sockets.push(socket);await new Promise((resolve,reject)=>{socket.once('connect',resolve);socket.once('connect_error',reject);});return socket;}
  const teacher=await connect();
  const invalid=await call(teacher,'room:create',{teacherKey:key,title:'새 교실',studentAccounts:[
    {nickname:'별이',pin:'1357'},{nickname:'달이',pin:'12'}
  ]});
  assert.equal(invalid.ok,false);assert.equal(game.store.rooms.size,0);assert.equal(game.store.records.size,0);
  const created=await call(teacher,'room:create',{teacherKey:key,title:'새 교실',studentAccounts:[
    {nickname:'별이',pin:'1357'},{nickname:'달이',pin:'2468'}
  ]});
  assert.ok(created.ok,created.error);
  assert.deepEqual(created.credentials,[{nickname:'별이',pin:'1357'},{nickname:'달이',pin:'2468'}]);
  assert.deepEqual([...game.store.rooms.get(created.room.code).allowedNames],['별이','달이']);
  const code=created.room.code,first=await connect(),second=await connect();
  assert.equal((await call(first,'room:join',{code,nickname:'별이',pin:'2468'})).ok,false);
  assert.ok((await call(first,'room:join',{code,nickname:'별이',pin:'1357'})).ok);
  assert.ok((await call(second,'room:join',{code,nickname:'달이',pin:'2468'})).ok);
  assert.equal(JSON.stringify(game.store.records.get(code)).includes('"1357"'),false);
  const extra=await call(teacher,'student:create',{nickname:'해솔',pin:'9876'});assert.ok(extra.ok,extra.error);
  await game.close();game=createClassroomServer({teacherKey:key,dataDir:dir,studentHours:false});address=await game.listen();
  const reopened=await call(await connect(),'room:open',{teacherKey:key,code});assert.ok(reopened.ok,reopened.error);
  assert.ok((await call(await connect(),'room:join',{code,nickname:'해솔',pin:'9876'})).ok);
  assert.ok((await call(await connect(),'room:join',{code,nickname:'별이',pin:'1357'})).ok);
});
