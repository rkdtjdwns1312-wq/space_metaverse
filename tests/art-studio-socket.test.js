import test from 'node:test';
import assert from 'node:assert/strict';
import {STREET} from '../shared/config.js';
import {toRecord,fromRecord} from '../server/persistent-rooms.js';
import {readingFixture,call,ok} from './helpers/reading-fixture.js';
const at=(f,p=f.p)=>{const o=STREET.objects.find(o=>o.kind==='art-station');assert(o);Object.assign(p,{mapId:STREET.id,x:o.x,y:o.y+80,input:{x:0,y:0,at:0}});};
const draft=(n=0)=>({requestId:`socket-art-${n}`,title:`검증작품${n}`,drawing:{version:1,background:'#ffffff',strokes:[{tool:'brush',color:'#123456',width:10,points:[[20,20],[400,300]]}]}});
test('art sockets enforce live nearby ownership; selected peer/teacher viewing remains private to request',async t=>{
 const f=await readingFixture(t),guest=await f.connect();at(f);at(f,f.q);at(f,f.teacherPlayer);
 for(const event of ['art:list','art:get','art:save','art:delete'])assert.equal((await call(guest,event,draft())).ok,false);
 const w=ok(await call(f.student,'art:save',draft())).work;
 for(const socket of [f.other,f.teacher]){const list=ok(await call(socket,'art:list',{ownerId:f.p.id}));assert.equal(list.works[0].drawing,undefined);assert.deepEqual(ok(await call(socket,'art:get',{ownerId:f.p.id,id:w.id})).work.drawing,w.drawing);assert.equal((await call(socket,'art:save',{...draft(),ownerId:f.p.id,id:w.id,revision:1})).ok,false);assert.equal((await call(socket,'art:delete',{ownerId:f.p.id,id:w.id,revision:1})).ok,false);}
 for(const viewer of [f.p,f.q,f.teacherPlayer]){const snapshot=JSON.stringify(f.game.store.snapshot(f.room,viewer,f.now));assert(!snapshot.includes('검증작품'));assert(!snapshot.includes('artStudio'));}
 const foreign=await f.connect(),made=ok(await call(foreign,'room:create',{teacherKey:'reading-rewards-test',allowedNames:['다른학생']})),room=f.game.store.rooms.get(made.room.code),teacher=[...room.players.values()].find(p=>p.role==='teacher');at(f,teacher);assert.equal((await call(foreign,'art:get',{ownerId:f.p.id,id:w.id})).ok,false);
 for(const mutate of [p=>p.mapId='space-plaza',p=>p.x=0,p=>p.away=true,p=>p.socketId='stale',p=>p.battleVitals={level:p.avatar.level,role:p.role,hp:0,mp:0,defeatedAt:f.now}]){
  const previous={mapId:f.p.mapId,x:f.p.x,away:f.p.away,socketId:f.p.socketId,battleVitals:structuredClone(f.p.battleVitals)};mutate(f.p);for(const event of ['art:list','art:get','art:save','art:delete'])assert.equal((await call(f.student,event,{...draft(),id:w.id,revision:1})).ok,false,event);Object.assign(f.p,previous);
 }
});
test('art save/delete roll back on disk failure; duplicate requests, revisions, capacity and restart retain drawings',async t=>{
 const f=await readingFixture(t);at(f);
 await f.fail(async()=>assert.equal((await call(f.student,'art:save',draft())).ok,false));assert.equal(f.p.artStudio?.length??0,0);
 const results=await Promise.all([call(f.student,'art:save',draft()),call(f.student,'art:save',draft())]);results.forEach(ok);assert.equal(results[0].work.id,results[1].work.id);assert.equal(f.p.artStudio.length,1);const w=results[0].work;
 await f.fail(async()=>assert.equal((await call(f.student,'art:save',{...draft(),id:w.id,revision:1,title:'실패수정'})).ok,false));assert.equal(f.p.artStudio[0].title,w.title);
 const changed=ok(await call(f.student,'art:save',{...draft(),id:w.id,revision:1,title:'수정작품'})).work;assert.equal(changed.revision,2);assert.equal((await call(f.student,'art:delete',{id:w.id,revision:1})).ok,false);
 await f.fail(async()=>assert.equal((await call(f.student,'art:delete',{id:w.id,revision:2})).ok,false));assert.equal(f.p.artStudio.length,1);
 for(let n=1;n<10;n++)ok(await call(f.student,'art:save',draft(n)));assert.equal((await call(f.student,'art:save',draft(10))).ok,false);
 ok(await call(f.student,'art:delete',{id:w.id,revision:2}));assert.equal(f.p.artStudio.length,9);
 const large=draft(10);large.drawing.strokes=Array.from({length:200},()=>({tool:'brush',color:'#123456',width:40,points:Array.from({length:30},()=>[600,400])}));assert(Buffer.byteLength(JSON.stringify(large))>32768);ok(await call(f.student,'art:save',large));assert.equal(f.p.artStudio.length,10);
 const saved=structuredClone(f.p.artStudio);await f.restart();at(f);assert.deepEqual(f.p.artStudio,saved);assert.equal(ok(await call(f.student,'art:list')).total,10);assert.equal(ok(await call(f.student,'art:get',{id:saved.at(-1).id})).work.drawing.strokes.length,200);
 const record=toRecord(f.room),student=record.students.find(p=>p.id===f.p.id);delete student.artStudio;assert.deepEqual(fromRecord(record).players.get(f.p.id).artStudio,[]);student.artStudio=[{}];assert.throws(()=>fromRecord(record));
});
