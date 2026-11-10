import test from 'node:test';
import assert from 'node:assert/strict';
import {validateArchive,saveArchive,signArchive,replyArchive,getArchive,readArchive,acknowledgeArchiveReply} from '../server/starlight-archive.js';
import {hasUnreadArchiveReplies} from '../shared/starlight-archive.js';
const setup=()=>{const p={id:'student-one',role:'student',nickname:'하나'},q={id:'student-two',role:'student',nickname:'둘'},t={id:'teacher-one',role:'teacher',nickname:'선생님'};return {p,q,t,room:{allowedNames:new Set(['둘','하나']),players:new Map([p,q,t].map(p=>[p.id,p]))}};};
const data=(extra={})=>({kind:'diary',requestId:'request-001',date:'2026-10-30',title:'오늘의 발견',body:'<script>평문으로 보관</script>\n즐거웠어요.',...extra});
test('reply alerts require each visible reply version, survive list/get/student edits, and reject foreign acknowledgement',()=>{
 const {p,q,t,room}=setup(),first=saveArchive(p,data(),100).entry,second=saveArchive(p,data({requestId:'request-002'}),100).entry;
 const reply=e=>replyArchive(room,t,{kind:'diary',studentId:p.id,id:e.id,revision:e.revision,text:'답글'},110).entry;
 const a=reply(first),b=reply(second),ack={kind:'diary',id:a.id,replyVersion:1};
 assert.equal(hasUnreadArchiveReplies(p.starlightArchive),true);assert.equal(readArchive(room,p,{kind:'diary'}).records.every(e=>e.replyUnread),true);
 getArchive(room,p,{kind:'diary',id:a.id});getArchive(room,t,{kind:'diary',studentId:p.id,id:a.id});assert.equal(hasUnreadArchiveReplies(p.starlightArchive),true);
 for(const actor of [q,t])assert.throws(()=>acknowledgeArchiveReply(room,actor,{...ack,studentId:p.id}));
 assert.equal(acknowledgeArchiveReply(room,p,ack).acknowledged,true);assert.equal(hasUnreadArchiveReplies(p.starlightArchive),true);
 acknowledgeArchiveReply(room,p,{...ack,id:b.id});assert.equal(hasUnreadArchiveReplies(p.starlightArchive),false);
 const edited=saveArchive(p,data({id:a.id,revision:a.revision,body:'학생이 고친 일기'}),120).entry;assert.equal(edited.replyUnread,false);
 const next=replyArchive(room,t,{kind:'diary',studentId:p.id,id:a.id,revision:edited.revision,text:'수정한 답글'},110).entry;
 assert.equal(next.reply.version,2);assert.equal(next.replyUnread,true);
 assert.equal(acknowledgeArchiveReply(room,p,ack).acknowledged,false);assert.equal(hasUnreadArchiveReplies(p.starlightArchive),true);
 acknowledgeArchiveReply(room,p,{...ack,replyVersion:2});assert.equal(hasUnreadArchiveReplies(p.starlightArchive),false);
 const same=replyArchive(room,t,{kind:'diary',studentId:p.id,id:a.id,revision:next.revision,text:'수정한 답글'},130).entry;assert.equal(same.reply.version,2);assert.equal(same.replyUnread,false);
});
test('legacy replies migrate unread and persisted reply acknowledgement metadata is validated',()=>{
 const {p,t,room}=setup(),e=saveArchive(p,data(),100).entry;replyArchive(room,t,{kind:'diary',studentId:p.id,id:e.id,revision:1,text:'답글'},110);
 const legacy=structuredClone(p.starlightArchive);delete legacy.diary[0].reply.version;delete legacy.diary[0].replySeenVersion;
 const migrated=validateArchive(legacy);assert.equal(migrated.diary[0].reply.version,1);assert.equal(migrated.diary[0].replySeenVersion,0);assert.equal(hasUnreadArchiveReplies(migrated),true);
 for(const change of [e=>e.reply.version=0,e=>e.reply.version=1.2,e=>e.replySeenVersion=2,e=>e.replySeenVersion=-1,e=>{e.reply=null;e.replySeenVersion=1;}]){const corrupt=structuredClone(migrated);change(corrupt.diary[0]);assert.throws(()=>validateArchive(corrupt));}
});
test('archive entries are private, ordered, paginated, and teacher roster follows roster order',()=>{
 const {p,q,t,room}=setup();for(let i=0;i<25;i++)saveArchive(p,data({requestId:'request-'+String(i).padStart(3,'0')}),100+i);
 const read=readArchive(room,p,{kind:'diary'});assert.equal(read.total,25);assert.equal(read.records.length,20);assert.equal(read.records[0].createdAt,124);assert.equal(read.records[0].body,undefined);assert.equal(read.records[0].requestId,undefined);assert.equal(read.roster,undefined);assert.equal(readArchive(room,p,{kind:'diary',page:1}).records.length,5);
 assert.deepEqual(readArchive(room,t,{kind:'diary'}).roster.map(p=>[p.number,p.nickname]),[[1,'둘'],[2,'하나']]);assert.equal(readArchive(room,t,{kind:'diary'}).studentId,q.id);
 assert.throws(()=>readArchive(room,q,{kind:'diary',studentId:p.id}));assert.throws(()=>getArchive(room,q,{kind:'diary',studentId:p.id,id:read.records[0].id}));assert.throws(()=>readArchive(room,t,{kind:'diary',studentId:'foreign-student'}));assert.equal(getArchive(room,t,{kind:'diary',studentId:p.id,id:read.records[0].id}).entry.body,data().body);
});
test('archive creation retries are idempotent; revision protects signs/edits and edits invalidate stamp only when content changes',()=>{
 const {p,q,t,room}=setup(),first=saveArchive(p,data(),100).entry;assert.deepEqual(saveArchive(p,data(),200).entry,first);assert.equal(p.starlightArchive.diary.length,1);
 assert.equal(readArchive(room,t,{kind:'diary'}).roster.find(student=>student.id===p.id).hasNew,true);
 assert.equal(readArchive(room,t,{kind:'reading'}).roster.find(student=>student.id===p.id).hasNew,false);
 assert.throws(()=>saveArchive(t,data(),200));assert.throws(()=>signArchive(room,q,{kind:'diary',studentId:p.id,id:first.id,revision:1},200));
 const signed=signArchive(room,t,{kind:'diary',studentId:p.id,id:first.id,revision:1},200).entry;assert.equal(signed.revision,2);assert.equal(signed.stamp.text,'참 잘했어요');
 assert.equal(readArchive(room,t,{kind:'reading'}).roster.find(student=>student.id===p.id).hasNew,false);
 assert.throws(()=>saveArchive(p,data({id:first.id,revision:1}),201));assert.throws(()=>signArchive(room,t,{kind:'diary',studentId:p.id,id:first.id,revision:1},201));
 const unchanged=saveArchive(p,data({id:first.id,revision:2,requestId:undefined}),202).entry;assert.deepEqual(unchanged,signed);
 const edited=saveArchive(p,data({id:first.id,revision:2,body:'새 내용',requestId:undefined}),203).entry;assert.equal(edited.revision,3);assert.equal(edited.stamp,null);assert.equal(edited.createdAt,100);assert.equal(edited.updatedAt,203);
 assert.equal(readArchive(room,t,{kind:'diary'}).roster.find(student=>student.id===p.id).hasNew,true);
 assert.equal(readArchive(room,t,{kind:'reading'}).roster.find(student=>student.id===p.id).hasNew,false);
 p.accountKind='master';assert.equal(saveArchive(p,data({kind:'reading',bookTitle:'별 이야기',author:'글쓴이'}),204).entry.bookTitle,'별 이야기');
 assert.equal(readArchive(room,t,{kind:'reading'}).roster.find(student=>student.id===p.id).hasNew,true);
});
test('teacher reply stays private, survives student edits, and rejects student, stale, reading, and oversized submissions',()=>{
 const {p,q,t,room}=setup(),first=saveArchive(p,data(),100).entry;
 assert.throws(()=>replyArchive(room,p,{kind:'diary',studentId:p.id,id:first.id,revision:1,text:'위조'},110));
 assert.throws(()=>replyArchive(room,q,{kind:'diary',studentId:p.id,id:first.id,revision:1,text:'위조'},110));
 assert.throws(()=>replyArchive(room,t,{kind:'diary',studentId:p.id,id:first.id,revision:1,text:'x'.repeat(501)},110));
 assert.throws(()=>replyArchive(room,t,{kind:'reading',studentId:p.id,id:first.id,revision:1,text:'답글'},110));
 const replied=replyArchive(room,t,{kind:'diary',studentId:p.id,id:first.id,revision:1,text:'  오늘도 멋졌어요!  '},110).entry;
 assert.equal(replied.reply.text,'오늘도 멋졌어요!');assert.equal(replied.reply.teacherName,'선생님');assert.equal(replied.revision,2);
 assert.equal(getArchive(room,p,{kind:'diary',id:first.id}).entry.reply.text,'오늘도 멋졌어요!');
 assert.throws(()=>replyArchive(room,t,{kind:'diary',studentId:p.id,id:first.id,revision:1,text:'오래된 답글'},111));
 const same=replyArchive(room,t,{kind:'diary',studentId:p.id,id:first.id,revision:2,text:'오늘도 멋졌어요!'},111).entry;assert.equal(same.revision,2);
 const edited=saveArchive(p,data({id:first.id,revision:2,requestId:undefined,body:'새로운 이야기',reply:{text:'학생 답글 위조'}}),120).entry;
 assert.equal(edited.reply.text,'오늘도 멋졌어요!');assert.equal(edited.revision,3);
 const legacy=structuredClone(p.starlightArchive);delete legacy.diary[0].reply;assert.equal(validateArchive(legacy).diary[0].reply,null);
});
test('archive validates dates, limits, corrupt persisted records, controls, and retains all valid history',()=>{
 const {p}=setup();for(const extra of [{date:'2026-02-30'},{title:''},{body:'a'.repeat(10001)},{kind:'reading',bookTitle:''},{kind:'other'},{requestId:'x'}])assert.throws(()=>saveArchive(p,data(extra),100));
 const e=saveArchive(p,data({body:'  가\u0000\u202e\r\n나  '}),100).entry;assert.equal(e.body,'가\n나');assert.equal(validateArchive(p.starlightArchive).diary.length,1);assert.deepEqual(validateArchive(),{diary:[],reading:[]});
 for(const change of [e=>e.revision=0,e=>e.date='bad',e=>e.body+='\u0000',e=>e.stamp={text:'forged'},e=>e.updatedAt=0]){const copy=structuredClone(p.starlightArchive);change(copy.diary[0]);assert.throws(()=>validateArchive(copy));}
 const duplicate=structuredClone(p.starlightArchive);duplicate.diary.push({...duplicate.diary[0]});assert.throws(()=>validateArchive(duplicate));
});
test('archive capacity rejects only new entries without deleting history; existing entries remain editable',()=>{
 const {p}=setup(),e=saveArchive(p,data(),100).entry;
 p.starlightArchive.diary=Array.from({length:1000},(_,i)=>({...e,id:'record-'+String(i).padStart(4,'0'),requestId:'request-'+String(i).padStart(4,'0')}));
 const before=structuredClone(p.starlightArchive);assert.throws(()=>saveArchive(p,data({requestId:'new-request-overflow'}),200),/가득/);assert.deepEqual(p.starlightArchive,before);
 const edited=saveArchive(p,data({id:before.diary[999].id,revision:1,body:'마지막 글 수정'}),201).entry;assert.equal(edited.body,'마지막 글 수정');assert.equal(p.starlightArchive.diary.length,1000);
});
