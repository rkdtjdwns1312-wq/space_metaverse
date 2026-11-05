import test from 'node:test';
import assert from 'node:assert/strict';
import {STREET} from '../shared/config.js';
import {validateCozyActivities} from '../server/cozy-activities.js';
import {readingFixture,call,ok} from './helpers/reading-fixture.js';
const near=p=>{const obj=STREET.objects.find(o=>o.kind==='cozy-room');Object.assign(p,{mapId:STREET.id,x:obj.x,y:obj.y});};
const layout=[{id:'bed',x:3.24,y:2.11,scale:1.34,rotation:1,palette:3,space:'room'}];
const visit=(socket,id)=>call(socket,'cozy:room-visit',{id});
const add=(socket,id,revision,text,extra)=>call(socket,'cozy:room-note',{id,revision,text,...extra});
const erase=(socket,id,noteId)=>call(socket,'cozy:room-note-delete',{id,noteId});

test('class visit uses current session, proximity, saved student rooms and read-only layout',async t=>{
 const f=await readingFixture(t);
 near(f.p);near(f.q);near(f.teacherPlayer);
 ok(await call(f.student,'cozy:act',{kind:'room',action:'save',theme:'study',layout}));
 const energy=f.q.cosmicEnergy,own=f.q.cozyActivities;
 assert.deepEqual(ok(await call(f.other,'cozy:room-list')).rooms,[{id:f.p.id,nickname:f.p.nickname}]);
 assert.deepEqual(ok(await visit(f.other,f.p.id)).layout,layout);
 assert.equal(f.q.cosmicEnergy,energy);assert.deepEqual(f.q.cozyActivities,own);
 assert.deepEqual(ok(await call(f.student,'cozy:room-list')).rooms,[]);
 assert.equal((await call(f.other,'cozy:act',{kind:'room',action:'save',theme:'moon',id:f.p.id,layout:[]})).ok,false);
 const guest=await f.connect();
 for(const socket of [guest,f.other]){
  if(socket===f.other)f.q.mapId='plaza';
  for(const [event,data] of [['cozy:room-list',{}],['cozy:room-visit',{id:f.p.id}],['cozy:room-note',{id:f.p.id,revision:0,text:'안녕'}],['cozy:room-note-delete',{id:f.p.id,noteId:1}]])
   assert.equal((await call(socket,event,data)).ok,false);
 }
 near(f.q);assert.equal((await visit(f.other,'other-class-id')).ok,false);
 f.student.disconnect();for(let i=0;i<100&&f.p.connected;i++)await new Promise(resolve=>setTimeout(resolve,10));
 assert.equal(f.p.connected,false);assert.deepEqual(ok(await visit(f.teacher,f.p.id)).layout,layout);
 const old=validateCozyActivities();delete old.room.guestbook;delete old.room.saved;assert.equal(validateCozyActivities(old).room.saved,false);
 old.room.layout=layout;assert.equal(validateCozyActivities(old).room.saved,true);
});

test('guestbook persists, filters, truncates history, rolls back, and retries without reposting deleted notes',async t=>{
 const f=await readingFixture(t);near(f.p);near(f.q);near(f.teacherPlayer);
 ok(await call(f.student,'cozy:act',{kind:'room',action:'save',theme:'moon',layout:[]}));
 const id=f.p.id;
 assert.equal((await add(f.student,id,0,'내 방')).ok,false);
 for(const text of ['','a'.repeat(101),'x\ny'])assert.equal((await add(f.other,id,0,text)).ok,false);
 f.q.muted=true;assert.equal((await add(f.other,id,0,'안녕')).ok,false);f.q.muted=false;
 const post=()=>add(f.other,id,0,'<b>바.보</b>',{nickname:'위조'});
 await f.fail(async()=>assert.equal((await post()).ok,false));
 assert.equal(ok(await visit(f.other,id)).guestbook.notes.length,0);
 const book=ok(await post()).guestbook;assert.deepEqual(book.notes,[{id:1,nickname:'둘',text:'<b>○○○</b>'}]);
 assert.deepEqual(ok(await post()).guestbook,book);
 assert.equal((await erase(f.other,id,1)).ok,false);
 assert.deepEqual(ok(await erase(f.teacher,id,1)).guestbook.notes,[]);
 assert.equal(ok(await post()).stale,true);
 for(let revision=2;revision<34;revision++)ok(await add(f.other,id,revision,'메모 '+revision));
 let notes=ok(await visit(f.student,id)).guestbook.notes;assert.equal(notes.length,30);assert.equal(notes[0].id,5);
 ok(await erase(f.student,id,5));await f.restart();near(f.p);near(f.q);
 notes=ok(await visit(f.other,id)).guestbook.notes;assert.equal(notes.length,29);assert.equal(notes[0].id,6);
 assert.deepEqual(ok(await call(f.other,'cozy:room-list')).rooms,[{id,nickname:'하나'}]);
});
