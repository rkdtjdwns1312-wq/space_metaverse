import test from 'node:test';
import assert from 'node:assert/strict';
import {existsSync} from 'node:fs';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {io} from 'socket.io-client';
import {createClassroomServer} from '../server/app.js';
import {RoomStore} from '../server/rooms.js';
import {configuredAdminPassword} from '../server/admin-password.js';

const master='classroom-delete-owner-only-key';
const adminPassword='delete-owner-separate-password';
const call=(socket,event,data={})=>socket.timeout(5000).emitWithAck(event,data);

test('only owner deletes the confirmed classroom; active users leave and other classrooms persist',async t=>{
  const dir=await mkdtemp(join(tmpdir(),'admin-delete-'));
  let game=createClassroomServer({teacherKey:master,adminPassword,dataDir:dir,studentHours:false,maxActiveRooms:1});
  let {port}=await game.listen();const sockets=[];
  t.after(async()=>{for(const socket of sockets)socket.disconnect();await game.close();await rm(dir,{recursive:true,force:true});});
  async function connect(){const socket=io('http://127.0.0.1:'+port,{transports:['websocket'],reconnection:false});sockets.push(socket);await new Promise((resolve,reject)=>{socket.once('connect',resolve);socket.once('connect_error',reject);});return socket;}
  const owner=await connect(),stranger=await connect();
  assert.equal((await call(stranger,'admin:login',{key:master})).ok,false);
  assert.ok((await call(owner,'admin:login',{key:adminPassword})).ok);
  const a=await call(owner,'admin:create',{title:'별빛반',teacherName:'별빛 선생님'});assert.ok(a.ok,a.error);
  const teacher=await connect(),opened=await call(teacher,'room:open',{teacherKey:a.teacherCode,code:a.code});assert.ok(opened.ok,opened.error);
  const studentAccount=await call(teacher,'student:create',{nickname:'별이',pin:'1234'});assert.ok(studentAccount.ok,studentAccount.error);
  const student=await connect(),joined=await call(student,'room:join',{code:a.code,nickname:'별이',pin:'1234'});assert.ok(joined.ok,joined.error);
  // 저장된 교실 생성은 활성 교실 수 제한에 걸리지 않는다.
  const b=await call(owner,'admin:create',{title:'달빛반',teacherName:'달빛 선생님'});assert.ok(b.ok,b.error);
  assert.equal((await call(await connect(),'room:open',{teacherKey:b.teacherCode,code:b.code})).ok,false);
  assert.equal((await call(stranger,'admin:delete',{code:a.code,confirmCode:a.code})).ok,false);
  assert.equal((await call(teacher,'admin:delete',{code:a.code,confirmCode:a.code})).ok,false);
  assert.equal((await call(owner,'admin:delete',{code:a.code,confirmCode:b.code})).ok,false);
  assert.equal(existsSync(join(dir,a.code+'.json')),true);

  const originalRemove=game.store.files.remove.bind(game.store.files);
  game.store.files.remove=()=>{throw new Error('disk failure');};
  const failed=await call(owner,'admin:delete',{code:a.code,confirmCode:a.code});
  assert.equal(failed.ok,false);
  assert.equal(existsSync(join(dir,a.code+'.json')),true);
  assert.equal(game.store.rooms.has(a.code),true);
  assert.equal((await call(teacher,'student:create',{nickname:'달이',pin:'5678'})).ok,true);
  game.store.files.remove=originalRemove;

  const teacherClosed=new Promise(resolve=>teacher.once('room:closed',resolve));
  const studentClosed=new Promise(resolve=>student.once('room:closed',resolve));
  const deleted=await call(owner,'admin:delete',{code:a.code,confirmCode:a.code});assert.ok(deleted.ok,deleted.error);
  await Promise.all([teacherClosed,studentClosed]);
  assert.deepEqual(deleted.classes.map(c=>c.code),[b.code]);
  assert.equal(existsSync(join(dir,a.code+'.json')),false);
  assert.equal(game.store.rooms.has(a.code),false);
  assert.equal(game.store.sessions.has(opened.token),false);
  assert.equal(game.store.sessions.has(joined.token),false);
  assert.equal((await call(await connect(),'session:resume',{token:joined.token})).ok,false);
  assert.equal((await call(await connect(),'room:open',{teacherKey:a.teacherCode,code:a.code})).ok,false);
  assert.equal((await call(teacher,'student:create',{nickname:'수정불가',pin:'5678'})).ok,false);
  assert.equal((await call(owner,'admin:delete',{code:a.code,confirmCode:a.code})).ok,false);
  assert.ok((await call(await connect(),'room:open',{teacherKey:b.teacherCode,code:b.code})).ok);

  await game.close();game=createClassroomServer({teacherKey:master,adminPassword,dataDir:dir,studentHours:false,maxActiveRooms:1});({port}=await game.listen());
  const nextOwner=await connect();assert.ok((await call(nextOwner,'admin:login',{key:adminPassword})).ok);
  assert.deepEqual((await call(nextOwner,'admin:list')).classes.map(c=>c.code),[b.code]);
});

test('active classroom limit rejects invalid values',()=>{
  for(const maxActiveRooms of [0,1.5,41,NaN])assert.throws(()=>createClassroomServer({teacherKey:master,maxActiveRooms}),/MAX_ACTIVE_ROOMS/);
  const store=new RoomStore({maxActiveRooms:11});
  for(let i=0;i<11;i++)store.create({title:'시험교실',allowedNames:['별이']},'socket-'+i);
  assert.equal(store.rooms.size,11);
  assert.throws(()=>store.create({title:'추가교실',allowedNames:['별이']},'socket-12'),/교실이 가득/);
});

test('administrator password must be separately configured and may not use the public example',()=>{
  for(const value of [undefined,'','short','replace-with-a-separate-private-password'])
    assert.throws(()=>configuredAdminPassword(value),/ADMIN_PASSWORD/);
  assert.equal(configuredAdminPassword(adminPassword),adminPassword);
});
