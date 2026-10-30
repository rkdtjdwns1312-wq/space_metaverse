import test from 'node:test';
import assert from 'node:assert/strict';
import {validateArchive,saveArchive,signArchive,getArchive,readArchive} from '../server/starlight-archive.js';
const setup=()=>{const p={id:'student-one',role:'student',nickname:'하나'},q={id:'student-two',role:'student',nickname:'둘'},t={id:'teacher-one',role:'teacher',nickname:'선생님'};return {p,q,t,room:{allowedNames:new Set(['둘','하나']),players:new Map([p,q,t].map(p=>[p.id,p]))}};};
const data=(extra={})=>({kind:'diary',requestId:'request-001',date:'2026-10-30',title:'오늘의 발견',body:'<script>평문으로 보관</script>\n즐거웠어요.',...extra});
test('archive entries are private, ordered, paginated, and teacher roster follows roster order',()=>{
 const {p,q,t,room}=setup();for(let i=0;i<25;i++)saveArchive(p,data({requestId:'request-'+String(i).padStart(3,'0')}),100+i);
 const read=readArchive(room,p,{kind:'diary'});assert.equal(read.total,25);assert.equal(read.records.length,20);assert.equal(read.records[0].createdAt,124);assert.equal(read.records[0].body,undefined);assert.equal(read.records[0].requestId,undefined);assert.equal(read.roster,undefined);assert.equal(readArchive(room,p,{kind:'diary',page:1}).records.length,5);
 assert.deepEqual(readArchive(room,t,{kind:'diary'}).roster.map(p=>[p.number,p.nickname]),[[1,'둘'],[2,'하나']]);assert.equal(readArchive(room,t,{kind:'diary'}).studentId,q.id);
 assert.throws(()=>readArchive(room,q,{kind:'diary',studentId:p.id}));assert.throws(()=>getArchive(room,q,{kind:'diary',studentId:p.id,id:read.records[0].id}));assert.throws(()=>readArchive(room,t,{kind:'diary',studentId:'foreign-student'}));assert.equal(getArchive(room,t,{kind:'diary',studentId:p.id,id:read.records[0].id}).entry.body,data().body);
});
test('archive creation retries are idempotent; revision protects signs/edits and edits invalidate stamp only when content changes',()=>{
 const {p,q,t,room}=setup(),first=saveArchive(p,data(),100).entry;assert.deepEqual(saveArchive(p,data(),200).entry,first);assert.equal(p.starlightArchive.diary.length,1);
 assert.throws(()=>saveArchive(t,data(),200));assert.throws(()=>signArchive(room,q,{kind:'diary',studentId:p.id,id:first.id,revision:1},200));
 const signed=signArchive(room,t,{kind:'diary',studentId:p.id,id:first.id,revision:1},200).entry;assert.equal(signed.revision,2);assert.equal(signed.stamp.text,'참 잘했어요');
 assert.throws(()=>saveArchive(p,data({id:first.id,revision:1}),201));assert.throws(()=>signArchive(room,t,{kind:'diary',studentId:p.id,id:first.id,revision:1},201));
 const unchanged=saveArchive(p,data({id:first.id,revision:2,requestId:undefined}),202).entry;assert.deepEqual(unchanged,signed);
 const edited=saveArchive(p,data({id:first.id,revision:2,body:'새 내용',requestId:undefined}),203).entry;assert.equal(edited.revision,3);assert.equal(edited.stamp,null);assert.equal(edited.createdAt,100);assert.equal(edited.updatedAt,203);
 p.accountKind='master';assert.equal(saveArchive(p,data({kind:'reading',bookTitle:'별 이야기',author:'글쓴이'}),204).entry.bookTitle,'별 이야기');
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
