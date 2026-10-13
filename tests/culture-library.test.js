import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {io} from 'socket.io-client';
import {createClassroomServer} from '../server/app.js';
import {toRecord,fromRecord} from '../server/persistent-rooms.js';
import {cultureDay,validateCultureReading} from '../server/culture-library.js';
import {CULTURE_STORIES} from '../shared/culture-stories.js';
import {STREET,PLAZA_ID} from '../shared/config.js';

const ids=CULTURE_STORIES.map(story=>story.id),station=STREET.objects.find(o=>o.kind==='culture-station');
const call=(socket,event,data={})=>socket.timeout(4000).emitWithAck(event,data);
const ok=r=>{assert.equal(r.ok,true,r.error);return r;};
const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function until(fn){for(let i=0;i<100&&!fn();i++)await wait(20);assert(fn(),'connection did not settle');}

async function fixture(t){
  const directory=fs.mkdtempSync(path.join(os.tmpdir(),'culture-library-')),key='culture-library-test-key',sockets=[];
  let game,url,teacher,student,other,code,id,otherId,token,closed=true,now=Date.parse('2026-10-13T14:59:59.000Z');
  const start=async()=>{
    game=createClassroomServer({teacherKey:key,dataDir:directory,teacherManagedAccounts:false,studentHours:false,clock:()=>now});
    url=`http://127.0.0.1:${(await game.listen()).port}`;closed=false;
  };
  const connect=async()=>{
    const socket=io(url,{transports:['websocket'],forceNew:true,reconnection:false});sockets.push(socket);
    await new Promise((resolve,reject)=>{socket.once('connect',resolve);socket.once('connect_error',reject);});return socket;
  };
  const join=async()=>{
    student=await connect();const joined=ok(await call(student,'room:join',{code,nickname:'하나',pin:'1234'}));id=joined.selfId;token=joined.token;
    other=await connect();otherId=ok(await call(other,'room:join',{code,nickname:'둘',pin:'1234'})).selfId;
  };
  t.after(async()=>{
    for(const socket of sockets)socket.disconnect();if(!closed)await game.close();
    assert(path.resolve(directory).startsWith(path.resolve(os.tmpdir())+path.sep)&&path.basename(directory).startsWith('culture-library-'));
    fs.rmSync(directory,{recursive:true,force:true});
  });
  await start();teacher=await connect();code=ok(await call(teacher,'room:create',{teacherKey:key,title:'교양 독서 검사',allowedNames:['하나','둘']})).room.code;await join();
  const f={
    get game(){return game;},get room(){return game.store.rooms.get(code);},get p(){return f.room.players.get(id);},get q(){return f.room.players.get(otherId);},
    get teacher(){return teacher;},get student(){return student;},get other(){return other;},get now(){return now;},get token(){return token;},
    get teacherPlayer(){return [...f.room.players.values()].find(p=>p.role==='teacher');},connect,
    advance(ms){now+=ms;},at(p=f.p){Object.assign(p,{mapId:STREET.id,x:station.x,y:station.y+120,input:{x:0,y:0,at:0}});},
    mutate(work){return game.store.transact(()=>work(f.p,f.room));},
    async open(storyId=ids[0],socket=student){return ok(await call(socket,'culture:open',{storyId}));},
    async claim(storyId=ids[0],socket=student,extra={}){return ok(await call(socket,'culture:claim',{storyId,...extra}));},
    async status(socket=student){return ok(await call(socket,'culture:status'));},
    async restart(){
      for(const socket of sockets)socket.disconnect();await game.close();closed=true;
      await start();teacher=await connect();ok(await call(teacher,'room:open',{teacherKey:key,code}));await join();f.at();f.at(f.q);
    },
    async reconnect(){
      student.disconnect();await until(()=>!f.p.connected);student=await connect();
      ok(await call(student,'session:resume',{token}));return student;
    },
    async fail(work){const save=game.store.files.save.bind(game.store.files);game.store.files.save=()=>{throw Error('culture disk failure');};try{await work();}finally{game.store.files.save=save;}}
  };
  f.at();f.at(f.q);f.at(f.teacherPlayer);return f;
}

test('culture save schema accepts legacy absence and rejects malformed dates, unknown/duplicate IDs and excessive claims',()=>{
  assert(ids.length>=11&&new Set(ids).size===ids.length);
  assert.equal(cultureDay(Date.parse('2026-10-13T14:59:59.999Z')),'2026-10-13');
  assert.equal(cultureDay(Date.parse('2026-10-13T15:00:00.000Z')),'2026-10-14');
  assert.deepEqual(validateCultureReading(undefined),{day:null,claimedIds:[]});
  const valid={day:'2026-10-13',claimedIds:ids.slice(0,10)};
  const copy=validateCultureReading(valid);copy.claimedIds.pop();assert.equal(valid.claimedIds.length,10);
  for(const value of [null,[],{}, {day:null,claimedIds:[ids[0]]}, {day:'2026-02-30',claimedIds:[]},
    {day:'2026-1-01',claimedIds:[]},{day:3,claimedIds:[]},{day:'2026-10-13',claimedIds:['unknown']},
    {day:'2026-10-13',claimedIds:[ids[0],ids[0]]},{day:'2026-10-13',claimedIds:ids.slice(0,11)}])assert.throws(()=>validateCultureReading(value));
});

test('claims award current server Lv1-5 rewards 1/2/5/30/100 once, ignore forged reward/identity, and teachers read without reward',async t=>{
  const f=await fixture(t);let total=0;
  for(let level=1;level<=5;level++){
    f.mutate(p=>{p.avatar.level=1;});await f.open(ids[level-1]);
    f.mutate(p=>{p.avatar.level=level;});
    const result=await f.claim(ids[level-1],f.student,{reward:999,amount:999,level:5,playerId:f.q.id,day:'1900-01-01'});
    const amount=[0,1,2,5,30,100][level];total+=amount;assert.equal(result.awarded,true);assert.equal(result.amount,amount);assert.equal(result.reward,amount);
    assert.equal(result.count,level);assert.equal(result.limit,10);assert.equal(f.p.cosmicEnergy,total);assert.equal(f.q.cosmicEnergy,0);
    const duplicate=await f.claim(ids[level-1]);assert.equal(duplicate.awarded,false);assert.equal(duplicate.amount,0);assert.equal(f.p.cosmicEnergy,total);
  }
  const before=f.teacherPlayer.cosmicEnergy,opened=await f.open(ids[0],f.teacher);
  assert.equal(opened.reward,0);assert.match(opened.message,/선생님/);
  const result=await f.claim(ids[0],f.teacher);assert.equal(result.awarded,false);assert.equal(result.amount,0);assert.match(result.message,/보상/);
  assert.equal(f.teacherPlayer.cosmicEnergy,before);assert.equal(result.count,0);assert.equal(f.teacherPlayer.cultureReading,undefined);
});

test('only the authenticated nearby active player can open or claim their latest selected valid book',async t=>{
  const f=await fixture(t),guest=await f.connect();
  for(const event of ['culture:status','culture:open','culture:claim'])assert.equal((await call(guest,event,{storyId:ids[0]})).ok,false);
  assert.equal((await call(f.student,'culture:claim',{storyId:ids[0]})).ok,false);
  for(const storyId of ['unknown',null,{},1])assert.equal((await call(f.student,'culture:open',{storyId})).ok,false);
  await f.open(ids[0]);await f.open(ids[1]);assert.equal((await call(f.student,'culture:claim',{storyId:ids[0]})).ok,false);
  assert.equal((await call(f.other,'culture:claim',{storyId:ids[1],playerId:f.p.id})).ok,false);
  const denied=async()=>{for(const event of ['culture:status','culture:open','culture:claim'])assert.equal((await call(f.student,event,{storyId:ids[1]})).ok,false,event);};
  f.p.mapId=PLAZA_ID;await denied();f.at();f.p.x=station.x-400;await denied();f.at();
  f.p.away=true;await denied();f.p.away=false;
  const originalSocket=f.p.socketId;f.p.socketId='stale-socket';await denied();f.p.socketId=originalSocket;
  f.p.connected=false;await denied();f.p.connected=true;
  assert.equal(f.p.cosmicEnergy,0);assert.equal((await f.claim(ids[1])).awarded,true);
});

test('simultaneous duplicates pay once and the tenth-book race cannot cross the KST daily limit',async t=>{
  const f=await fixture(t);await f.open();
  const replies=await Promise.all(Array.from({length:8},()=>call(f.student,'culture:claim',{storyId:ids[0]})));
  replies.forEach(ok);assert.equal(replies.filter(r=>r.awarded).length,1);assert.equal(f.p.cosmicEnergy,1);
  for(const id of ids.slice(1,9)){await f.open(id);await f.claim(id);}
  const pending=[];
  for(const id of ids.slice(9,11)){pending.push(call(f.student,'culture:open',{storyId:id}));pending.push(call(f.student,'culture:claim',{storyId:id}));}
  const results=await Promise.all(pending);results.forEach(ok);
  assert.equal(results.filter(r=>r.awarded).length,1);assert.equal(f.p.cosmicEnergy,10);
  const status=await f.status();assert.equal(status.count,10);assert.equal(new Set(status.claimedIds).size,10);
  await f.open(ids[11]);const capped=await f.claim(ids[11]);assert.equal(capped.awarded,false);assert.equal(capped.amount,0);assert.match(capped.message,/10권/);
  f.advance(999);assert.equal((await f.status()).count,10);
  f.advance(1);const reset=await f.status();assert.equal(reset.day,'2026-10-14');assert.deepEqual(reset.claimedIds,[]);
  // An already open story may be completed after midnight; no invented reading timer.
  assert.equal((await f.claim(ids[11])).awarded,true);await f.open(ids[0]);assert.equal((await f.claim()).awarded,true);
  assert.equal(f.p.cosmicEnergy,12);assert.equal((await f.status()).count,2);
});

test('cross-socket login/resume cannot reuse a book selection or award a second copy',async t=>{
  const f=await fixture(t);await f.open();await f.claim();await f.open(ids[1]);
  const competing=await f.connect();assert.equal((await call(competing,'session:resume',{token:f.token})).ok,false);
  assert.equal((await call(competing,'room:join',{code:f.room.code,nickname:'하나',pin:'1234'})).ok,false);
  assert.equal((await call(competing,'culture:claim',{storyId:ids[1]})).ok,false);
  await f.reconnect();assert.equal((await call(f.student,'culture:claim',{storyId:ids[1]})).ok,false);
  await f.open();assert.equal((await f.claim()).awarded,false);await f.open(ids[1]);assert.equal((await f.claim(ids[1])).awarded,true);
  assert.equal(f.p.cosmicEnergy,2);
  // A different login on the same socket must not inherit its old selection.
  await f.open(ids[2]);ok(await call(f.student,'room:leave'));
  const returned=ok(await call(f.student,'room:join',{code:f.room.code,nickname:'하나',pin:'1234'}));assert.notEqual(returned.token,f.token);f.at();
  assert.equal((await call(f.student,'culture:claim',{storyId:ids[2]})).ok,false);
});

test('cold restart preserves daily rewards and midnight reset, but never an open-book selection',async t=>{
  const f=await fixture(t);await f.open();await f.claim();await f.open(ids[1]);
  const before=await f.status(),studentId=f.p.id;await f.restart();assert.equal(f.p.id,studentId);
  assert.deepEqual(await f.status(),before);assert.equal(f.p.cosmicEnergy,1);
  assert.equal((await call(f.student,'culture:claim',{storyId:ids[1]})).ok,false);
  await f.open();assert.equal((await f.claim()).awarded,false);
  f.advance(1000);assert.equal((await f.status()).count,0);await f.open();await f.claim();
  await f.restart();assert.equal((await f.status()).count,1);assert.equal((await f.status()).day,'2026-10-14');assert.equal(f.p.cosmicEnergy,2);
  const record=toRecord(f.room),saved=record.students.find(p=>p.id===studentId);
  assert.deepEqual(saved.cultureReading,{day:'2026-10-14',claimedIds:[ids[0]]});assert.equal(saved.selected,undefined);
  delete saved.cultureReading;assert.deepEqual(fromRecord(record).players.get(studentId).cultureReading,{day:null,claimedIds:[]});
  saved.cultureReading={day:'2026-10-14',claimedIds:[ids[0],ids[0]]};assert.throws(()=>fromRecord(record));
});

test('disk failure atomically rolls back energy and claims, publishes nothing, and permits retry',async t=>{
  const f=await fixture(t);await f.open();const seen=[];
  f.student.on('room:state',state=>seen.push(state.players.find(p=>p.id===f.p.id)?.cosmicEnergy));
  const record=structuredClone(f.game.store.records.get(f.room.code));
  await f.fail(async()=>assert.equal((await call(f.student,'culture:claim',{storyId:ids[0]})).ok,false));
  assert.equal(f.p.cosmicEnergy,0);assert.equal((await f.status()).count,0);assert.deepEqual(f.game.store.records.get(f.room.code),record);
  await wait(80);assert(!seen.some(energy=>energy>0));
  assert.equal((await f.claim()).awarded,true);assert.equal(f.p.cosmicEnergy,1);assert.equal((await f.status()).count,1);
  f.advance(1000);await f.open();
  await f.fail(async()=>assert.equal((await call(f.student,'culture:claim',{storyId:ids[0]})).ok,false));
  assert.equal(f.p.cosmicEnergy,1);assert.equal(f.p.cultureReading.day,'2026-10-13');assert.equal((await f.status()).count,0);
  assert.equal((await f.claim()).awarded,true);await f.restart();assert.equal(f.p.cosmicEnergy,2);assert.equal((await f.status()).count,1);
});

test('reading history stays private and an energy overflow never consumes the daily book',async t=>{
  const f=await fixture(t);await f.open();await f.claim();
  assert.deepEqual((await f.status(f.other)).claimedIds,[]);
  for(const viewer of [f.q,f.teacherPlayer]){
    const snapshot=f.game.store.snapshot(f.room,viewer,f.now),p=snapshot.players.find(p=>p.id===f.p.id);
    assert.equal(p.cultureReading,undefined);assert.equal(p.claimedIds,undefined);assert.equal(p.selected,undefined);
  }
  f.mutate(p=>{p.cosmicEnergy=Number.MAX_SAFE_INTEGER;});await f.open(ids[1]);
  assert.equal((await call(f.student,'culture:claim',{storyId:ids[1]})).ok,false);
  assert.equal(f.p.cosmicEnergy,Number.MAX_SAFE_INTEGER);assert.deepEqual((await f.status()).claimedIds,[ids[0]]);
  f.mutate(p=>{p.cosmicEnergy=0;});assert.equal((await f.claim(ids[1])).awarded,true);
});
