import test from 'node:test';
import assert from 'node:assert/strict';
import {MAP,STAR_STATION} from '../shared/config.js';
import {toRecord,fromRecord} from '../server/persistent-rooms.js';
import {readingFixture,call,ok} from './helpers/reading-fixture.js';
const at=(f,p=f.p)=>{const o=MAP.objects.find(o=>o.kind==='starlight-archive');assert(o);Object.assign(p,{mapId:MAP.id,x:o.x,y:o.y+80,input:{x:0,y:0,at:0}});};
const draft=(extra={})=>({kind:'diary',requestId:'request-socket-001',date:'2026-10-30',title:'나의 하루',body:'비밀 기록 <b>평문</b>',...extra});
for(const kind of ['diary','reading'])test(kind+' reply notifications are owner-only, durable through reconnect/restart and transactional read failures',async t=>{
 const f=await readingFixture(t);at(f);at(f,f.q);at(f,f.teacherPlayer);
 const e=ok(await call(f.student,'archive:save',draft({kind,bookTitle:'읽은 책'}))).entry;
 const reply=ok(await call(f.teacher,'archive:reply',{kind,studentId:f.p.id,id:e.id,revision:e.revision,text:'선생님 답글'})).entry;
 const unread=()=>f.game.store.snapshot(f.room,f.p,f.now).players.find(p=>p.id===f.p.id).archiveReplyUnread;
 assert.equal(unread(),true);
 for(const viewer of [f.q,f.teacherPlayer,null])assert.equal(f.game.store.snapshot(f.room,viewer,f.now).players.find(p=>p.id===f.p.id).archiveReplyUnread,undefined);
 ok(await call(f.student,'archive:read',{kind}));ok(await call(f.student,'archive:get',{kind,id:e.id}));assert.equal(unread(),true);
 const ack={kind,id:e.id,replyVersion:reply.reply.version};
 for(const actor of [f.other,f.teacher])assert.equal((await call(actor,'archive:reply:read',{...ack,studentId:f.p.id})).ok,false);
 f.p.x=0;assert.equal((await call(f.student,'archive:reply:read',ack)).ok,false);at(f);
 await f.fail(async()=>assert.equal((await call(f.student,'archive:reply:read',ack)).ok,false));assert.equal(unread(),true);
 await f.reconnect();assert.equal(unread(),true);await f.restart();at(f);at(f,f.teacherPlayer);assert.equal(unread(),true);
 ok(await call(f.student,'archive:reply:read',ack));assert.equal(unread(),false);await f.restart();at(f);at(f,f.teacherPlayer);assert.equal(unread(),false);
 const next=ok(await call(f.teacher,'archive:reply',{kind,studentId:f.p.id,id:e.id,revision:reply.revision,text:'수정된 선생님 답글'})).entry;
 assert.equal(unread(),true);assert.equal(ok(await call(f.student,'archive:reply:read',ack)).acknowledged,false);assert.equal(unread(),true);
 ok(await call(f.student,'archive:reply:read',{...ack,replyVersion:next.reply.version}));assert.equal(unread(),false);
});

test('culture station lets students submit their own reading logs, while diary and teacher permissions stay at archive',async t=>{
 const f=await readingFixture(t),o=STAR_STATION.objects.find(o=>o.kind==='culture-station');
 for(const p of [f.p,f.q,f.teacherPlayer])Object.assign(p,{mapId:STAR_STATION.id,x:o.x,y:o.y+100,input:{x:0,y:0,at:0}});
 const data=draft({kind:'reading',bookTitle:'작은 별 이야기',author:''}),e=ok(await call(f.student,'archive:save',data)).entry;
 assert.equal(ok(await call(f.student,'archive:read',{kind:'reading'})).records.length,1);
 assert.equal(ok(await call(f.student,'archive:get',{kind:'reading',id:e.id})).entry.bookTitle,data.bookTitle);
 assert.equal(ok(await call(f.student,'archive:save',data)).entry.id,e.id);
 assert.equal((await call(f.student,'archive:save',draft())).ok,false);
 assert.equal((await call(f.student,'archive:read',{kind:'diary'})).ok,false);
 assert.equal((await call(f.other,'archive:get',{kind:'reading',studentId:f.p.id,id:e.id})).ok,false);
 assert.equal((await call(f.other,'archive:save',{...data,studentId:f.p.id})).ok,false);
 assert.equal((await call(f.teacher,'archive:sign',{kind:'reading',studentId:f.p.id,id:e.id,revision:1})).ok,false);
 f.p.x=900;f.p.y=1000;assert.equal((await call(f.student,'archive:save',{...data,requestId:'culture-too-far'})).ok,false);
 at(f);at(f,f.teacherPlayer);
 assert.equal(ok(await call(f.student,'archive:get',{kind:'reading',id:e.id})).entry.body,data.body);
 assert.equal(ok(await call(f.teacher,'archive:get',{kind:'reading',studentId:f.p.id,id:e.id})).entry.bookTitle,data.bookTitle);
 assert(ok(await call(f.teacher,'archive:sign',{kind:'reading',studentId:f.p.id,id:e.id,revision:1})).entry.stamp);
 const reply=ok(await call(f.teacher,'archive:reply',{kind:'reading',studentId:f.p.id,id:e.id,revision:2,text:'독서록 답글'})).entry;
 Object.assign(f.p,{mapId:STAR_STATION.id,x:o.x,y:o.y+100,input:{x:0,y:0,at:0}});
 assert.equal(ok(await call(f.student,'archive:reply:read',{kind:'reading',id:e.id,replyVersion:reply.reply.version})).acknowledged,true);
 assert.equal((await call(f.student,'archive:reply:read',{kind:'diary',id:e.id,replyVersion:1})).ok,false);

});
test('archive sockets reject guests, other students/classes, stale and distant sessions; teacher access stays private',async t=>{
 const f=await readingFixture(t),guest=await f.connect();at(f);at(f,f.q);at(f,f.teacherPlayer);
 for(const event of ['archive:read','archive:get','archive:save','archive:sign','archive:reply'])assert.equal((await call(guest,event,draft())).ok,false);
 const e=ok(await call(f.student,'archive:save',draft())).entry;
 assert.equal((await call(f.other,'archive:read',{kind:'diary',studentId:f.p.id})).ok,false);
 assert.equal((await call(f.other,'archive:get',{kind:'diary',studentId:f.p.id,id:e.id})).ok,false);
 assert.equal((await call(f.other,'archive:save',draft({studentId:f.p.id}))).ok,false);
 assert.equal((await call(f.other,'archive:sign',{kind:'diary',studentId:f.p.id,id:e.id,revision:1})).ok,false);
 assert.equal((await call(f.teacher,'archive:save',draft())).ok,false);
 const teacherRead=ok(await call(f.teacher,'archive:read',{kind:'diary',studentId:f.p.id}));assert.equal(teacherRead.records.length,1);assert.equal(teacherRead.records[0].body,undefined);assert.equal(teacherRead.roster.length,2);assert.equal(ok(await call(f.teacher,'archive:get',{kind:'diary',studentId:f.p.id,id:e.id})).entry.body,draft().body);
 assert.equal((await call(f.teacher,'archive:get',{kind:'diary',studentId:'foreign-room-id',id:e.id})).ok,false);
 for(const viewer of [f.p,f.q,f.teacherPlayer]){const snapshot=JSON.stringify(f.game.store.snapshot(f.room,viewer,f.now));assert.equal(snapshot.includes('비밀 기록'),false);assert.equal(snapshot.includes('starlightArchive'),false);}
 const foreignTeacher=await f.connect();const foreign=ok(await call(foreignTeacher,'room:create',{teacherKey:'reading-rewards-test',allowedNames:['다른학생']}));const otherRoom=f.game.store.rooms.get(foreign.room.code),otherTeacher=[...otherRoom.players.values()].find(p=>p.role==='teacher');at(f,otherTeacher);assert.equal((await call(foreignTeacher,'archive:get',{kind:'diary',studentId:f.p.id,id:e.id})).ok,false);
 for(const mutate of [p=>p.mapId='star-street',p=>p.x=0,p=>p.away=true,p=>p.socketId='stale',p=>p.battleVitals={level:p.avatar.level,role:p.role,hp:0,mp:0,defeatedAt:f.now}]){
  const before={mapId:f.p.mapId,x:f.p.x,away:f.p.away,socketId:f.p.socketId,battleVitals:structuredClone(f.p.battleVitals)};mutate(f.p);
  for(const event of ['archive:read','archive:get','archive:save'])assert.equal((await call(f.student,event,draft({id:e.id,revision:e.revision}))).ok,false,event);Object.assign(f.p,before);
 }
});
test('archive saves and teacher stamps persist, reject stale races, and rollback on disk failures without duplicate retries',async t=>{
 const f=await readingFixture(t);at(f);at(f,f.teacherPlayer);
 await f.fail(async()=>assert.equal((await call(f.student,'archive:save',draft())).ok,false));assert.equal(f.p.starlightArchive?.diary.length??0,0);
 const results=await Promise.all(Array.from({length:4},()=>call(f.student,'archive:save',draft())));results.forEach(ok);assert.equal(new Set(results.map(r=>r.entry.id)).size,1);assert.equal(f.p.starlightArchive.diary.length,1);const e=results[0].entry;
 await f.fail(async()=>assert.equal((await call(f.teacher,'archive:sign',{kind:'diary',studentId:f.p.id,id:e.id,revision:1})).ok,false));assert.equal(f.p.starlightArchive.diary[0].stamp,null);assert.equal(f.p.starlightArchive.diary[0].revision,1);
 const signed=ok(await call(f.teacher,'archive:sign',{kind:'diary',studentId:f.p.id,id:e.id,revision:1})).entry;assert.equal(signed.revision,2);
 assert.equal((await call(f.student,'archive:save',draft({id:e.id,revision:1,body:'오래된 편집'}))).ok,false);
 const before=structuredClone(f.p.starlightArchive);await f.fail(async()=>assert.equal((await call(f.student,'archive:save',draft({id:e.id,revision:2,body:'변경'}))).ok,false));assert.deepEqual(f.p.starlightArchive,before);
 assert.deepEqual(ok(await call(f.student,'archive:save',draft({id:e.id,revision:2}))).entry,signed);
 const edited=ok(await call(f.student,'archive:save',draft({id:e.id,revision:2,body:'수정한 글'}))).entry;assert.equal(edited.stamp,null);assert.equal(edited.revision,3);
 assert.equal((await call(f.teacher,'archive:sign',{kind:'diary',studentId:f.p.id,id:e.id,revision:2})).ok,false);
 const replyData={kind:'diary',studentId:f.p.id,id:e.id,revision:3,text:'오늘도 잘했어요!'};
 assert.equal((await call(f.student,'archive:reply',replyData)).ok,false);
 assert.equal((await call(f.teacher,'archive:reply',{...replyData,kind:'reading'})).ok,false);
 await f.fail(async()=>assert.equal((await call(f.teacher,'archive:reply',replyData)).ok,false));assert.equal(f.p.starlightArchive.diary[0].reply,null);
 const replied=ok(await call(f.teacher,'archive:reply',replyData)).entry;assert.equal(replied.revision,4);assert.equal(replied.reply.text,replyData.text);
 assert.equal((await call(f.teacher,'archive:reply',replyData)).ok,false);
 assert.equal(ok(await call(f.student,'archive:get',{kind:'diary',id:e.id})).entry.reply.text,replyData.text);
 f.p.accountKind='master';const book=ok(await call(f.student,'archive:save',draft({kind:'reading',bookTitle:'작은 별',author:'작가'}))).entry;ok(await call(f.teacher,'archive:sign',{kind:'reading',studentId:f.p.id,id:book.id,revision:1}));
 const saved=structuredClone(f.p.starlightArchive);await f.restart();at(f);at(f,f.teacherPlayer);assert.deepEqual(f.p.starlightArchive,saved);assert.equal(ok(await call(f.student,'archive:save',draft())).entry.id,e.id);assert.equal(f.p.starlightArchive.diary.length,1);
 const record=toRecord(f.room),student=record.students.find(p=>p.id===f.p.id);delete student.starlightArchive;assert.deepEqual(fromRecord(record).players.get(f.p.id).starlightArchive,{diary:[],reading:[]});student.starlightArchive={diary:'bad',reading:[]};assert.throws(()=>fromRecord(record));
});
