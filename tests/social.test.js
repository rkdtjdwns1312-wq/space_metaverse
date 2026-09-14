import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { io } from 'socket.io-client';
import { createClassroomServer } from '../server/app.js';
import { toRecord, fromRecord } from '../server/persistent-rooms.js';
import { PLAZA_ID, MAP, SHOP, interiorIdOf } from '../shared/config.js';
import {requestSummon,SOCIAL} from '../server/social.js';
import {studentAccessOpen} from '../server/access-hours.js';

const key='social-test-secret-123456789';
const call=(s,e,d={})=>s.timeout(3000).emitWithAck(e,d);
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function fixture(t,options={}){
  const game=createClassroomServer({teacherKey:key,studentHours:false,unattended:false,teacherManagedAccounts:false,...options});
  const address=await game.listen(), url=`http://127.0.0.1:${address.port}`, sockets=[];
  let closed=false;const close=async()=>{if(closed)return;closed=true;for(const s of sockets)s.disconnect();await game.close();};
  t.after(close);
  const connect=async()=>{const s=io(url,{transports:['websocket'],forceNew:true,reconnection:false});sockets.push(s);await new Promise((r,j)=>{s.once('connect',r);s.once('connect_error',j);});return s;};
  return {game,connect,close};
}
async function roomWithStudents(t,options={}){
  const f=await fixture(t,options),teacher=await f.connect(),created=await call(teacher,'room:create',{teacherKey:key,title:'social',allowedNames:['1','2','3','4']});
  const a=await f.connect(),b=await f.connect(),c=await f.connect();
  const ja=await call(a,'room:join',{code:created.room.code,nickname:'1',pin:'1234'}),jb=await call(b,'room:join',{code:created.room.code,nickname:'2',pin:'2345'}),jc=await call(c,'room:join',{code:created.room.code,nickname:'3',pin:'3456'});
  for(const joined of [ja,jb,jc])assert.ok(joined.ok,joined.error);
  return {...f,teacher,room:f.game.store.rooms.get(created.room.code),a,b,c,ja,jb,jc};
}

test('studentHours false keeps the existing flow and true follows UTC Korean boundaries with teacher exception',async t=>{
  const f=await fixture(t,{studentHours:false}),teacher=await f.connect();
  assert.equal((await call(teacher,'room:create',{teacherKey:key,title:'x',allowedNames:['1']})).ok,true);
  const times=[['06:59',Date.UTC(2026,0,1,21,59)],['07:00',Date.UTC(2026,0,1,22,0)],['20:59',Date.UTC(2026,0,2,11,59)],['21:00',Date.UTC(2026,0,2,12,0)]];
  for(const [label,now] of times){const g=await fixture(t,{studentHours:true,clock:()=>now}),teacher2=await g.connect();const r=await call(teacher2,'room:create',{teacherKey:key,title:'시간검사',allowedNames:['1']});assert.equal(r.ok,true,r.error);const s=await g.connect();const j=await call(s,'room:join',{code:r.room.code,nickname:'1'});assert.equal(j.ok,label==='07:00'||label==='20:59',label);if(label==='21:00')assert.match(j.error,/오전 7시/);}
});

test('21시에는 접속 학생도 나가고 토큰과 이동 요청이 차단된다',async t=>{
  let clock=Date.UTC(2026,0,2,11,59,59);const f=await roomWithStudents(t,{studentHours:true,clock:()=>clock});
  assert.ok(studentAccessOpen(clock));let closed=false;f.a.on('room:closed',()=>closed=true);
  clock=Date.UTC(2026,0,2,12);await sleep(100);assert.ok(closed);assert.equal(f.game.store.sessions.has(f.ja.token),false);
  assert.equal((await call(f.a,'room:join',{code:f.room.code,nickname:'1'})).ok,false);
  assert.ok((await call(f.teacher,'chat:setEnabled',{enabled:false})).ok);
});

test('chat scope is server derived, cross map and cross department history never leaks, direct messages reach only two players',async t=>{
  const f=await roomWithStudents(t),{room,a,b,c,ja,jb,jc}=f;
  const planet={id:'dept-a',mapId:'planet-dept-a',name:'A',rules:[]};room.planets.set(planet.id,planet);
  const p1=room.players.get(ja.selfId),p2=room.players.get(jb.selfId),p3=room.players.get(jc.selfId);
  p1.mapId='map-a';p2.mapId='map-a';p3.mapId='map-b';p1.avatar.departmentId=planet.id;p2.avatar.departmentId=planet.id;
  const got=[[],[],[]];[a,b,c].forEach((s,i)=>s.on('chat:message',m=>got[i].push(m)));
  assert.equal((await call(a,'chat:send',{channel:'map',mapId:'map-b',targetId:jc.selfId,text:'map'})).ok,true);
  p1.lastChatAt=p2.lastChatAt=p3.lastChatAt=0;
  assert.equal((await call(a,'chat:send',{channel:'department',departmentId:'other',text:'dept'})).ok,true);
  p1.lastChatAt=0;assert.equal((await call(a,'chat:send',{channel:'direct',targetId:jb.selfId,text:'dm'})).ok,true);
  await sleep(20);assert.ok(got[0].some(m=>m.text==='map'));assert.ok(!got[2].some(m=>m.text==='map'));assert.ok(got[1].some(m=>m.text==='dm'));assert.ok(!got[2].some(m=>m.text==='dm'));
  assert.ok((await call(c,'chat:history')).messages.every(m=>m.text!=='dm'&&m.text!=='map'));
  assert.equal((await call(f.teacher,'chat:setEnabled',{enabled:false})).ok,true);p1.lastChatAt=0;assert.equal((await call(a,'chat:send',{text:'blocked'})).ok,false);
  assert.equal((await call(f.teacher,'chat:mute',{playerId:ja.selfId,muted:true})).ok,true);p1.lastChatAt=0;assert.equal((await call(a,'chat:send',{text:'muted'})).ok,false);
});

test('summon requires current membership, accepts only the target, uses a safe position, and rejects stale or expired requests',async t=>{
  const f=await roomWithStudents(t),{room,a,b,c,ja,jb,jc}=f,p1=room.players.get(ja.selfId),p2=room.players.get(jb.selfId),p3=room.players.get(jc.selfId);
  p1.mapId=PLAZA_ID;p2.mapId=PLAZA_ID;p3.mapId=PLAZA_ID;
  const r=await call(a,'social:summon',{targetId:jb.selfId,mapId:'forged'});assert.equal(r.ok,true);assert.equal((await call(c,'social:respond',{requestId:r.invitation.id,accept:true})).ok,false);assert.equal((await call(b,'social:respond',{requestId:r.invitation.id,accept:true})).ok,true);assert.equal(p2.mapId,p1.mapId);
  p1.lastSummonAt=0;const r2=await call(a,'social:summon',{targetId:jc.selfId});assert.equal(r2.ok,true);assert.equal((await call(c,'social:respond',{requestId:r2.invitation.id,accept:false})).ok,true);p1.lastSummonAt=0;assert.match((await call(a,'social:summon',{targetId:jc.selfId})).error,/24시간/);
  p1.lastSummonAt=0;const r3=await call(a,'social:summon',{targetId:jb.selfId});assert.equal(r3.ok,true);room.summons.get(r3.invitation.id).expiresAt=Date.now()-1;assert.equal((await call(b,'social:respond',{requestId:r3.invitation.id,accept:true})).ok,false);
  p1.mapId=interiorIdOf('joined');p2.mapId=PLAZA_ID;p2.avatar.departmentId='joined';room.planets.set('joined',{id:'joined',rules:[]});p1.lastSummonAt=0;assert.equal((await call(a,'social:summon',{targetId:jb.selfId})).ok,true);p2.avatar.departmentId=null;assert.equal((await call(b,'social:respond',{requestId:[...room.summons.keys()].at(-1),accept:true})).ok,false);
});

test('item discard consumes only the sender item, rejects forged items, and high level use does not consume',async t=>{
  const f=await roomWithStudents(t),{room,a,b,ja,jb}=f,p1=room.players.get(ja.selfId),p2=room.players.get(jb.selfId);
  p1.inventory=[{id:'star-sticker',quantity:2}];p2.inventory=[{id:'firefly-lamp',quantity:2}];
  assert.equal((await call(a,'item:discard',{itemId:'star-sticker',quantity:99})).ok,true);assert.deepEqual(p1.inventory,[{id:'star-sticker',quantity:1}]);assert.deepEqual(p2.inventory,[{id:'firefly-lamp',quantity:2}]);assert.equal((await call(a,'item:discard',{itemId:'forged'})).ok,false);
  const high=SHOP.items.find(x=>x.level>p1.avatar.level);if(high){p1.inventory=[{id:high.id,quantity:1}];p1.lastItemUseAt=0;const before=structuredClone(p1.inventory);assert.equal((await call(a,'item:use',{itemId:high.id,targetId:ja.selfId})).ok,false);assert.deepEqual(p1.inventory,before);}
});

test('rejected summon cooldown survives toRecord/fromRecord and persistent server restart with stable student ids',async t=>{
  const dir=await mkdtemp(`${tmpdir()}\\social-`);
  const f=await roomWithStudents(t,{dataDir:dir,teacherManagedAccounts:false}),{room,a,b,ja,jb}=f,p1=room.players.get(ja.selfId),p2=room.players.get(jb.selfId);p1.mapId=p2.mapId=PLAZA_ID;p1.lastSummonAt=0;const r=await call(a,'social:summon',{targetId:jb.selfId});assert.equal(r.ok,true);await call(b,'social:respond',{requestId:r.invitation.id,accept:false});const record=toRecord(room);assert.ok(record.summonCooldowns);
  const restored=fromRecord(record);assert.equal(restored.summonCooldowns.get(p1.id+':'+p2.id)>Date.now(),true);
  const until=restored.summonCooldowns.get(p1.id+':'+p2.id);
  const cloned=structuredClone(room),cp=cloned.players.get(p1.id);cp.lastSummonAt=0;
  assert.throws(()=>requestSummon(cloned,cp,p2.id,until-1),/24시간/);assert.ok(requestSummon(cloned,cp,p2.id,until));
  await f.close();
  const next=await fixture(t,{dataDir:dir,teacherManagedAccounts:false,unattended:true});t.after(()=>rm(dir,{recursive:true,force:true}));
  const a2=await next.connect(),b2=await next.connect();
  const aj=await call(a2,'room:join',{code:room.code,nickname:'1',pin:'1234'}),bj=await call(b2,'room:join',{code:room.code,nickname:'2',pin:'2345'});
  assert.equal(aj.selfId,p1.id);assert.equal(bj.selfId,p2.id);assert.match((await call(a2,'social:summon',{targetId:bj.selfId})).error,/24시간/);
});

test('unattended persistent room keeps students after teacher leave and restart, while restoring teacher authority',async t=>{
  const dir=await mkdtemp(`${tmpdir()}\\unattended-`);t.after(()=>rm(dir,{recursive:true,force:true}));
  const first=createClassroomServer({teacherKey:key,dataDir:dir,studentHours:false,unattended:true,teacherManagedAccounts:false});
  const address=await first.listen(),url=`http://127.0.0.1:${address.port}`,sockets=[];
  const connect=async()=>{const s=io(url,{transports:['websocket'],forceNew:true,reconnection:false});sockets.push(s);await new Promise((r,j)=>{s.once('connect',r);s.once('connect_error',j);});return s;};
  const teacher=await connect(),created=await call(teacher,'room:create',{teacherKey:key,title:'unattended',allowedNames:['1']});
  const student=await connect(),joined=await call(student,'room:join',{code:created.room.code,nickname:'1',pin:'1234'});assert.equal(joined.ok,true);
  const room=first.store.rooms.get(created.room.code),p=room.players.get(joined.selfId);p.inventory=[{id:'star-sticker',quantity:2}];
  await call(teacher,'room:leave');p.mapId=PLAZA_ID;p.lastChatAt=0;assert.equal((await call(student,'chat:send',{text:'선생님 없어도 저장'})).ok,true);
  const previousX=p.x;student.emit('player:input',{x:1,y:0});await sleep(180);assert.ok(p.x>previousX);
  for(const s of sockets)s.disconnect();await first.close();
  const second=createClassroomServer({teacherKey:key,dataDir:dir,studentHours:false,unattended:true,teacherManagedAccounts:false});const a2=await second.listen(),url2=`http://127.0.0.1:${a2.port}`;
  const s2=io(url2,{transports:['websocket'],forceNew:true,reconnection:false}),t2=io(url2,{transports:['websocket'],forceNew:true,reconnection:false});
  t.after(async()=>{s2.disconnect();t2.disconnect();await second.close();});
  await Promise.all([new Promise((r,j)=>{s2.once('connect',r);s2.once('connect_error',j);}),new Promise((r,j)=>{t2.once('connect',r);t2.once('connect_error',j);})]);
  const resumed=await call(s2,'room:join',{code:created.room.code,nickname:'1',pin:'1234'});assert.equal(resumed.ok,true);assert.equal(resumed.selfId,joined.selfId);assert.equal(resumed.room.players.find(x=>x.id===joined.selfId).inventory[0].quantity,2);
  assert.equal((await call(t2,'room:open',{teacherKey:key,code:created.room.code})).ok,true);
  assert.equal((await call(s2,'room:close')).ok,false);
});
