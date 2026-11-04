import test from 'node:test';
import assert from 'node:assert/strict';
import {ART_TEACHER_OWNER} from '../shared/art-studio.js';
import {toRecord,fromRecord} from '../server/persistent-rooms.js';
import {readingFixture,call,ok} from './helpers/reading-fixture.js';
// Keep the test avatar safely inside the northern island, beyond the building collision.
const at=(f,p=f.p)=>{f.at('art',p);p.y-=40;};
const draft=n=>({requestId:`teacher-art-${n}`,title:`선생님 작품 ${n}`,drawing:{version:1,background:'#ffffff',strokes:[{tool:'brush',color:'#123456',width:10,points:[[30,40],[500,300]]}]}});

test('teacher owns ten classroom drawings; students view/download but nobody edits another owner; save failures roll back',async t=>{
 const f=await readingFixture(t);for(const p of [f.p,f.q,f.teacherPlayer])at(f,p);
 await f.fail(async()=>assert.equal((await call(f.teacher,'art:save',draft(0))).ok,false));assert.equal(f.room.teacherArtStudio?.length??0,0);
 const [a,b]=await Promise.all([call(f.teacher,'art:save',draft(0)),call(f.teacher,'art:save',draft(0))]);ok(a);ok(b);assert.equal(a.work.id,b.work.id);assert.equal(f.room.teacherArtStudio.length,1);
 const id=a.work.id,list=ok(await call(f.teacher,'art:list'));assert.equal(list.ownerId,ART_TEACHER_OWNER);assert(list.canEdit);assert.equal(list.works[0].drawing,undefined);
 for(const socket of [f.student,f.other]){
  const peers=ok(await call(socket,'art:list',{ownerId:ART_TEACHER_OWNER}));assert.equal(peers.canEdit,false);assert(peers.roster.some(p=>p.id===ART_TEACHER_OWNER&&p.nickname==='선생님'));
  assert.deepEqual(ok(await call(socket,'art:get',{ownerId:ART_TEACHER_OWNER,id})).work.drawing,draft(0).drawing);
  for(const event of ['art:save','art:delete'])for(const ownerId of [ART_TEACHER_OWNER,undefined])assert.equal((await call(socket,event,{...draft(1),ownerId,id,revision:1})).ok,false);
 }
 const student=ok(await call(f.student,'art:save',draft('student'))).work;
 for(const event of ['art:save','art:delete'])for(const ownerId of [f.p.id,undefined])assert.equal((await call(f.teacher,event,{...draft(1),ownerId,id:student.id,revision:1})).ok,false);
 await f.fail(async()=>assert.equal((await call(f.teacher,'art:save',{...draft(1),id,revision:1})).ok,false));assert.equal(f.room.teacherArtStudio[0].title,draft(0).title);
 const updated=ok(await call(f.teacher,'art:save',{...draft(1),id,revision:1})).work;assert.equal(updated.revision,2);
 for(let n=1;n<10;n++)ok(await call(f.teacher,'art:save',draft(n)));assert.equal((await call(f.teacher,'art:save',draft(10))).ok,false);
 await f.fail(async()=>assert.equal((await call(f.teacher,'art:delete',{id,revision:2})).ok,false));assert.equal(f.room.teacherArtStudio.length,10);
 assert.equal((await call(f.teacher,'art:delete',{id,revision:1})).ok,false);ok(await call(f.teacher,'art:delete',{id,revision:2}));assert.equal(f.room.teacherArtStudio.length,9);assert.equal(f.p.artStudio.length,1);
 for(const viewer of [f.p,f.teacherPlayer]){const snapshot=JSON.stringify(f.game.store.snapshot(f.room,viewer,f.now));assert(!snapshot.includes('teacherArtStudio'));assert(!snapshot.includes('선생님 작품'));}
 const foreign=await f.connect();ok(await call(foreign,'room:create',{teacherKey:'reading-rewards-test',allowedNames:['외부']}));const otherSession=f.game.io.sockets.sockets.get(foreign.id).data.session;at(f,otherSession.player);
 assert.equal((await call(foreign,'art:get',{ownerId:ART_TEACHER_OWNER,id:f.room.teacherArtStudio[0].id})).ok,false);
});

test('teacher artwork survives a new teacher session and restart; legacy records default empty and corrupt teacher drawings reject',async t=>{
 const f=await readingFixture(t);at(f,f.teacherPlayer);const work=ok(await call(f.teacher,'art:save',draft(0))).work,oldId=f.teacherPlayer.id,code=f.room.code;
 f.teacher.disconnect();for(let i=0;i<100&&f.teacherPlayer.connected;i++)await new Promise(r=>setTimeout(r,10));
 const replacement=await f.connect();ok(await call(replacement,'room:open',{teacherKey:'reading-rewards-test',code}));assert.notEqual(f.teacherPlayer.id,oldId);at(f,f.teacherPlayer);
 assert.equal(ok(await call(replacement,'art:list')).works[0].id,work.id);
 ok(await call(replacement,'art:save',{...draft(0),title:'재입장 수정',id:work.id,revision:1}));
 await f.restart();at(f,f.teacherPlayer);at(f,f.p);
 const loaded=ok(await call(f.teacher,'art:get',{ownerId:ART_TEACHER_OWNER,id:work.id}));assert.equal(loaded.work.title,'재입장 수정');assert.equal(loaded.work.revision,2);assert(loaded.canEdit);
 assert.deepEqual(ok(await call(f.student,'art:get',{ownerId:ART_TEACHER_OWNER,id:work.id})).work.drawing,draft(0).drawing);
 const record=toRecord(f.room);assert.equal(record.teacherArtStudio[0].drawing.encoding,'deflate-json-v1');delete record.teacherArtStudio;assert.deepEqual(fromRecord(record).teacherArtStudio,[]);
 record.teacherArtStudio=[{}];assert.throws(()=>fromRecord(record));
});
