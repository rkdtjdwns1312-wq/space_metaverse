import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {io} from 'socket.io-client';
import {createClassroomServer} from '../server/app.js';
import {decryptTeacherCode,encryptTeacherCode,isEncryptedTeacherCode,matchesTeacherCode,teacherCodeDigest} from '../server/teacher-access.js';

const master='owner-test-key-for-teacher-scope';
const adminPassword='owner-test-password-separate';
const call=(socket,event,data={})=>socket.timeout(5000).emitWithAck(event,data);

test('새 코드는 8자리이고 기존 긴 코드는 재발급 전까지 계속 유효하다',()=>{
  const legacy='T-abcdefghijklmnopqrst';
  const access={digest:teacherCodeDigest(master,legacy)};
  assert.equal(matchesTeacherCode(master,legacy,access),true);
  assert.equal(matchesTeacherCode(master,legacy.slice(0,-1)+'x',access),false);
});

test('teacher code encryption is authenticated, master-key derived, and tamper resistant',()=>{
  const code='abCD2!@x',encrypted=encryptTeacherCode(master,code);
  assert.equal(isEncryptedTeacherCode(encrypted),true);
  assert.equal(decryptTeacherCode(master,encrypted),code);
  assert.throws(()=>decryptTeacherCode('a-different-master-key',encrypted));
  assert.throws(()=>decryptTeacherCode(master,{...encrypted,tag:Buffer.alloc(16).toString('base64')}));
  assert.equal(isEncryptedTeacherCode({...encrypted,iv:'not-base64'}),false);
});

test('owner issues per-room teacher codes, isolates classrooms, and rotation revokes an active teacher',async t=>{
  const dir=await mkdtemp(join(tmpdir(),'teacher-access-'));
  let game=createClassroomServer({teacherKey:master,adminPassword,dataDir:dir,studentHours:false,unattended:false});
  let {port}=await game.listen();const sockets=[];
  t.after(async()=>{for(const socket of sockets)socket.disconnect();await game.close();await rm(dir,{recursive:true,force:true});});
  async function connect(){const socket=io('http://127.0.0.1:'+port,{transports:['websocket'],reconnection:false});sockets.push(socket);await new Promise((resolve,reject)=>{socket.once('connect',resolve);socket.once('connect_error',reject);});return socket;}
  const owner=await connect(),stranger=await connect();
  assert.equal((await call(stranger,'admin:list')).ok,false);
  assert.equal((await call(stranger,'admin:login',{key:'incorrect-owner-key'})).ok,false);
  assert.equal((await call(stranger,'admin:login',{key:master})).ok,false);
  assert.equal((await call(stranger,'room:create',{teacherKey:master,title:'빈교실위조',allowedNames:[],allowEmpty:true})).ok,false);
  assert.ok((await call(owner,'admin:login',{key:adminPassword})).ok);
  const a=await call(owner,'admin:create',{title:'별빛반',teacherName:'별빛 선생님'});
  assert.ok(a.ok,a.error);
  assert.match(a.teacherCode,/^(?=.*[a-z])(?=.*[A-Z])(?=.*[2-9])(?=.*[!@])[A-Za-z2-9!@]{8}$/);
  assert.equal(game.store.records.get(a.code).allowedNames.length,0);
  assert.equal((await call(owner,'admin:list')).classes.find(item=>item.code===a.code).teacherCode,a.teacherCode);
  const b=await call(owner,'admin:create',{title:'달빛반',teacherName:'달빛 선생님'});
  assert.ok(b.ok,b.error);assert.notEqual(a.code,b.code);
  const recordText=await readFile(join(dir,a.code+'.json'),'utf8');
  assert.equal(recordText.includes(a.teacherCode),false);
  assert.equal(recordText.includes(master),false);
  const storedAccess=JSON.parse(recordText).teacherAccess;
  assert.equal(isEncryptedTeacherCode(storedAccess.encryptedCode),true);
  assert.equal(decryptTeacherCode(master,storedAccess.encryptedCode),a.teacherCode);
  assert.equal((await call(stranger,'admin:list')).ok,false);
  const teacher=await connect();
  const list=await call(teacher,'room:list',{teacherKey:a.teacherCode});
  assert.deepEqual(list.classes.map(c=>c.code),[a.code]);
  assert.equal((await call(teacher,'room:open',{teacherKey:a.teacherCode,code:b.code})).ok,false);
  assert.equal((await call(teacher,'room:create',{teacherKey:a.teacherCode,title:'못만드는교실',allowedNames:['1']})).ok,false);
  const opened=await call(teacher,'room:open',{teacherKey:a.teacherCode,code:a.code});assert.ok(opened.ok,opened.error);
  const openedText=JSON.stringify(opened.room);
  assert.equal(openedText.includes(a.teacherCode),false);
  assert.equal(openedText.includes(JSON.stringify(storedAccess.encryptedCode)),false);
  assert.equal((await call(teacher,'student:create',{nickname:'별이',pin:'1234'})).ok,true);
  const rotated=await call(owner,'admin:grant',{code:a.code,teacherName:'새 선생님'});assert.ok(rotated.ok,rotated.error);
  assert.notEqual(rotated.teacherCode,a.teacherCode);
  assert.equal((await call(owner,'admin:list')).classes.find(item=>item.code===a.code).teacherCode,rotated.teacherCode);
  assert.equal((await call(teacher,'student:create',{nickname:'막힘',pin:'5678'})).ok,false);
  assert.equal((await call(await connect(),'session:resume',{token:opened.token})).ok,false);
  assert.equal((await call(await connect(),'room:list',{teacherKey:a.teacherCode})).ok,false);
  const newTeacher=await connect();
  assert.ok((await call(newTeacher,'room:open',{teacherKey:rotated.teacherCode,code:a.code})).ok);
  assert.equal((await call(owner,'admin:revoke',{code:a.code})).ok,true);
  assert.equal((await call(await connect(),'room:list',{teacherKey:rotated.teacherCode})).ok,false);
  assert.equal((await call(newTeacher,'student:create',{nickname:'또막힘',pin:'5678'})).ok,false);
  await game.close();game=createClassroomServer({teacherKey:master,adminPassword,dataDir:dir,studentHours:false,unattended:false});({port}=await game.listen());
  const back=await connect();assert.ok((await call(back,'admin:login',{key:adminPassword})).ok);
  assert.ok((await call(back,'admin:list')).classes.some(c=>c.code===a.code&&!c.assigned));
  assert.equal((await call(back,'admin:list')).classes.find(c=>c.code===b.code).teacherCode,b.teacherCode);
  assert.equal((await call(await connect(),'room:list',{teacherKey:b.teacherCode})).classes[0].code,b.code);
});

test('legacy digest-only codes stay unviewable and storage failures roll admin mutations back',async t=>{
  const dir=await mkdtemp(join(tmpdir(),'teacher-access-rollback-'));
  let game=createClassroomServer({teacherKey:master,adminPassword,dataDir:dir,studentHours:false});
  let {port}=await game.listen();const sockets=[];
  t.after(async()=>{for(const socket of sockets)socket.disconnect();await game.close();await rm(dir,{recursive:true,force:true});});
  async function connect(){const socket=io('http://127.0.0.1:'+port,{transports:['websocket'],reconnection:false});sockets.push(socket);await new Promise((resolve,reject)=>{socket.once('connect',resolve);socket.once('connect_error',reject);});return socket;}
  const owner=await connect();assert.ok((await call(owner,'admin:login',{key:adminPassword})).ok);
  const first=await call(owner,'admin:create',{title:'검수반',teacherName:'담당 교사'});assert.ok(first.ok,first.error);
  const original=game.store.records.get(first.code).teacherAccess;
  const save=game.store.files.save.bind(game.store.files);
  game.store.files.save=()=>{throw new Error('disk failure');};
  const failedGrant=await call(owner,'admin:grant',{code:first.code,teacherName:'바뀌면 안 되는 교사'});
  assert.equal(failedGrant.ok,false);
  assert.equal(game.store.records.get(first.code).teacherAccess.digest,original.digest);
  assert.equal((await call(owner,'admin:list')).classes.find(c=>c.code===first.code).teacherCode,first.teacherCode);
  const failedCreate=await call(owner,'admin:create',{title:'저장실패반',teacherName:'저장 실패'});
  assert.equal(failedCreate.ok,false);
  assert.equal(game.store.records.size,1);
  game.store.files.save=save;

  const legacy=game.store.records.get(first.code);
  delete legacy.teacherAccess.encryptedCode;
  save(legacy);
  const legacyTeacher=await connect();
  assert.equal((await call(legacyTeacher,'room:list',{teacherKey:first.teacherCode})).classes[0].code,first.code);
  await game.close();game=createClassroomServer({teacherKey:master,adminPassword,dataDir:dir,studentHours:false});({port}=await game.listen());
  const nextOwner=await connect();assert.ok((await call(nextOwner,'admin:login',{key:adminPassword})).ok);
  const legacyEntry=(await call(nextOwner,'admin:list')).classes.find(c=>c.code===first.code);
  assert.equal(legacyEntry.teacherCode,null);
  assert.equal(legacyEntry.assigned,true);
  assert.equal(game.store.records.get(first.code).teacherAccess.encryptedCode,undefined);
});
