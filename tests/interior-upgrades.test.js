import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {io} from 'socket.io-client';
import {createClassroomServer} from '../server/app.js';
import {addPlanet} from '../server/world.js';
import {toRecord,fromRecord} from '../server/persistent-rooms.js';
import {validateInteriorUnlocks} from '../server/interior-decor.js';
import {INTERIOR,PLAZA_ID,interiorIdOf} from '../shared/config.js';
import {departmentSlots} from '../shared/plaza-layout.js';
import {INTERIOR_DECOR_TARGETS} from '../shared/interior-decor.js';

const UNLOCK='planet:interior-decor:unlock',SET='planet:interior-decor:set';
const call=(socket,event,data={})=>socket.timeout(4000).emitWithAck(event,data);
const ok=result=>{assert.equal(result.ok,true,result.error);return result;};
const machine=INTERIOR.objects.find(o=>o.id==='department-control-machine');

async function fixture(t){
  const directory=await mkdtemp(path.join(tmpdir(),'interior-upgrades-')),key='interior-upgrades-test',sockets=[];
  let game,url,teacher,students=[],code,planetId,otherId,closed=true;
  const start=async()=>{
    game=createClassroomServer({teacherKey:key,dataDir:directory,teacherManagedAccounts:false,studentHours:false});
    url=`http://127.0.0.1:${(await game.listen()).port}`;closed=false;
  };
  const connect=async()=>{
    const socket=io(url,{transports:['websocket'],reconnection:false,forceNew:true});sockets.push(socket);
    await new Promise((resolve,reject)=>{socket.once('connect',resolve);socket.once('connect_error',reject);});return socket;
  };
  const join=async()=>{
    students=[];
    for(const nickname of ['하나','둘','밖']){
      const socket=await connect(),result=ok(await call(socket,'room:join',{code,nickname,pin:'1234'}));
      students.push({socket,id:result.selfId,nickname});
    }
  };
  t.after(async()=>{
    sockets.forEach(socket=>socket.disconnect());if(!closed)await game.close();
    assert(path.resolve(directory).startsWith(path.resolve(tmpdir())+path.sep)&&path.basename(directory).startsWith('interior-upgrades-'));
    await rm(directory,{recursive:true,force:true});
  });
  await start();teacher=await connect();code=ok(await call(teacher,'room:create',{teacherKey:key,title:'부서 꾸미기 검사',allowedNames:['하나','둘','밖']})).room.code;
  await join();
  const f={
    get game(){return game;},get room(){return game.store.rooms.get(code);},get teacher(){return teacher;},
    get teacherPlayer(){return [...f.room.players.values()].find(p=>p.socketId===teacher.id);},
    get students(){return students;},player(index){return f.room.players.get(students[index].id);},
    get planet(){return f.room.planets.get(planetId);},get otherPlanet(){return f.room.planets.get(otherId);},
    data(objectId='room',shapeId='tier1',extra={}){return {planetId,controlId:machine.id,objectId,shapeId,colorId:'mint',...extra};},
    mutate(work){return game.store.transact(()=>work(f.room));},
    at(player,selected=planetId){Object.assign(player,{mapId:interiorIdOf(selected),x:machine.x,y:machine.y+machine.radius+20,input:{x:0,y:0,at:0}});},
    state(){return {balances:students.map((_,i)=>f.player(i).starShards),unlocks:structuredClone(f.planet.interiorUnlocks||{}),decor:structuredClone(f.planet.interiorDecor||{}),otherUnlocks:structuredClone(f.otherPlanet.interiorUnlocks||{})};},
    async fail(work){const save=game.store.files.save.bind(game.store.files);game.store.files.save=()=>{throw Error('interior upgrade disk failure');};try{await work();}finally{game.store.files.save=save;}},
    async restart(){sockets.forEach(socket=>socket.disconnect());await game.close();closed=true;await start();teacher=await connect();ok(await call(teacher,'room:open',{teacherKey:key,code}));await join();}
  };
  f.mutate(room=>{
    const sites=departmentSlots();
    planetId=addPlanet(room,{name:'공유행성',description:'',x:sites[0].x,y:sites[0].y,color:'#c5c9f7',rules:[]}).id;
    otherId=addPlanet(room,{name:'다른행성',description:'',x:sites[1].x,y:sites[1].y,color:'#c5c9f7',rules:[]}).id;
    for(let i=0;i<3;i++){const p=f.player(i);p.starShards=100;p.avatar.departmentId=i===2?otherId:planetId;}
  });
  f.at(f.player(0));f.at(f.player(1));f.at(f.player(2),otherId);return f;
}

test('5/10/15 unlock costs debit only the requesting student and the department shares each object unlock',async t=>{
  const f=await fixture(t),a=f.students[0].socket,b=f.students[1].socket;
  ok(await call(a,SET,f.data('room','default')));assert.deepEqual(f.state().balances,[100,100,100]);
  for(const [shapeId,price,index] of [['tier1',5,0],['tier2',10,1],['tier3',15,0]]){
    const payer=f.students[index].socket,other=f.students[1-index].socket,before=f.state().balances;
    assert.equal((await call(other,SET,f.data('room',shapeId))).ok,false,'selection is gated until paid');
    const result=ok(await call(payer,UNLOCK,f.data('room',shapeId,{price:0,playerId:f.player(2).id,payerId:f.player(2).id})));
    assert.equal(result.price,price);assert.deepEqual(f.state().balances,before.map((n,i)=>n-(i===index?price:0)));
    assert.equal(f.planet.interiorDecor.room.shapeId,shapeId==='tier1'?'default':shapeId==='tier2'?'tier1':'tier2','unlock does not silently select a style');
    ok(await call(other,SET,f.data('room',shapeId)));assert.equal(f.planet.interiorDecor.room.shapeId,shapeId);
    const view=f.game.store.snapshot(f.room,f.player(1-index)).planets.find(p=>p.id===f.planet.id);
    assert(view.interiorUnlocks.room.includes(shapeId));assert.equal(view.interiorDecor.room.shapeId,shapeId);
    assert.equal((await call(a,SET,f.data('board',shapeId))).ok,false,'one object unlock cannot unlock a different object');
  }
  assert.deepEqual(f.state().balances,[80,90,100]);assert.deepEqual(f.otherPlanet.interiorUnlocks||{},{});
  for(const objectId of INTERIOR_DECOR_TARGETS.filter(id=>id!=='room')){
    ok(await call(a,UNLOCK,f.data(objectId,'tier1')));ok(await call(b,SET,f.data(objectId,'tier1')));
  }
  assert.equal(f.player(0).starShards,60);assert.equal(f.player(1).starShards,90);
  // The roster's nested unlock data is a copy, never a live mutable reference.
  const publicPlanet=f.game.store.snapshot(f.room,f.player(1)).planets.find(p=>p.id===f.planet.id);
  publicPlanet.interiorUnlocks.room.push('forged');assert(!f.planet.interiorUnlocks.room.includes('forged'));
});

test('outsiders, other interiors, distance, forged controller/target and teacher free unlock bypasses are denied',async t=>{
  const f=await fixture(t),a=f.students[0].socket,outsider=f.students[2].socket,before=f.state();
  f.at(f.player(2));
  for(const event of [UNLOCK,SET])assert.equal((await call(outsider,event,f.data())).ok,false);
  f.at(f.player(0),f.otherPlanet.id);
  for(const event of [UNLOCK,SET])assert.equal((await call(a,event,f.data())).ok,false);
  f.at(f.player(0));f.player(0).mapId=PLAZA_ID;
  for(const event of [UNLOCK,SET])assert.equal((await call(a,event,f.data())).ok,false);
  f.at(f.player(0));Object.assign(f.player(0),{x:machine.x-400,y:machine.y-250});
  for(const event of [UNLOCK,SET])assert.equal((await call(a,event,f.data())).ok,false);
  f.at(f.player(0));
  for(const extra of [{controlId:'forged'},{controlId:'warning-rock'},{objectId:'door'},{objectId:'unknown'},{shapeId:'tier4'},{planetId:'outside-room'}]){
    for(const event of [UNLOCK,SET])assert.equal((await call(a,event,f.data('room','tier1',extra))).ok,false);
  }
  f.at(f.teacherPlayer);
  assert.equal((await call(f.teacher,UNLOCK,f.data())).ok,false,'teacher cannot bypass the student shard charge');
  assert.deepEqual(f.state(),before);
});

test('teacher selects all interior tiers free without granting student unlocks',async t=>{
  const f=await fixture(t);f.at(f.teacherPlayer);
  const before=f.state();
  for(const objectId of INTERIOR_DECOR_TARGETS){
    for(const shapeId of ['tier1','tier2','tier3'])ok(await call(f.teacher,SET,f.data(objectId,shapeId)));
    assert.equal(f.planet.interiorDecor[objectId].shapeId,'tier3');
  }
  assert.deepEqual(f.state().balances,before.balances);
  assert.deepEqual(f.planet.interiorUnlocks||{},{});
  assert.equal((await call(f.students[0].socket,SET,f.data('room','tier3',{role:'teacher'}))).ok,false);
  const saved=f.state();await f.restart();assert.deepEqual(f.state(),saved);
});

test('concurrent duplicate unlocks by two members charge exactly one payer once',async t=>{
  const f=await fixture(t),a=f.students[0].socket,b=f.students[1].socket;
  const results=await Promise.all([call(a,UNLOCK,f.data()),call(b,UNLOCK,f.data())]);
  results.forEach(ok);assert.equal(results.filter(r=>r.alreadyUnlocked===true).length,1);assert.equal(results.filter(r=>r.price===5).length,1);
  const winningIndex=results.findIndex(r=>r.price===5);
  assert.deepEqual(f.state().balances,[0,1,2].map(i=>100-(i===winningIndex?5:0)));
  assert.deepEqual(f.planet.interiorUnlocks.room,['tier1']);
  const before=f.state();
  const repeated=await Promise.all([call(a,UNLOCK,f.data()),call(a,UNLOCK,f.data()),call(b,UNLOCK,f.data())]);
  assert(repeated.every(r=>r.ok&&r.alreadyUnlocked));assert.deepEqual(f.state(),before);
});

test('insufficient personal shards cannot borrow from another member, while an already shared unlock is free',async t=>{
  const f=await fixture(t),a=f.students[0].socket,b=f.students[1].socket;
  for(const [shapeId,price] of [['tier1',5],['tier2',10],['tier3',15]]){
    f.mutate(()=>{f.player(0).starShards=price-1;});const before=f.state();
    assert.equal((await call(a,UNLOCK,f.data('mailbox',shapeId,{payerId:f.player(1).id,price:0}))).ok,false);assert.deepEqual(f.state(),before);
    f.mutate(()=>{f.player(0).starShards=price;});ok(await call(a,UNLOCK,f.data('mailbox',shapeId)));assert.equal(f.player(0).starShards,0);
  }
  assert.equal(f.player(1).starShards,100);
  f.mutate(()=>{f.player(1).starShards=0;});
  assert.equal(ok(await call(b,UNLOCK,f.data('mailbox','tier3'))).alreadyUnlocked,true);
  ok(await call(b,SET,f.data('mailbox','tier3')));assert.equal(f.player(1).starShards,0);
});

test('disk failure rolls back payer balance, shared unlock and style without publishing failed state',async t=>{
  const f=await fixture(t),a=f.students[0].socket,b=f.students[1].socket,published=[];
  b.on('room:state',room=>published.push(room));const before=f.state();
  await f.fail(async()=>assert.equal((await call(a,UNLOCK,f.data('board','tier2'))).ok,false));
  assert.deepEqual(f.state(),before);
  assert(!published.some(room=>room.planets.find(p=>p.id===f.planet.id)?.interiorUnlocks?.board?.includes('tier2')));
  const persistedBefore=f.game.store.records.get(f.room.code).planets.find(p=>p.id===f.planet.id);
  assert(!persistedBefore.interiorUnlocks?.board?.includes('tier2'));
  ok(await call(a,UNLOCK,f.data('board','tier2')));assert.equal(f.player(0).starShards,90);
  const afterUnlock=f.state();published.length=0;
  await f.fail(async()=>assert.equal((await call(b,SET,f.data('board','tier2'))).ok,false));
  assert.deepEqual(f.state(),afterUnlock);
  // A prior successful unlock roster may arrive late on the other socket; only failed selection must never appear.
  assert(!published.some(room=>room.planets.find(p=>p.id===f.planet.id)?.interiorDecor?.board?.shapeId==='tier2'));
  ok(await call(b,SET,f.data('board','tier2')));assert.equal(f.planet.interiorDecor.board.shapeId,'tier2');
  assert.equal(f.player(1).starShards,100);
});

test('cold restart preserves paid unlocks and selected appearance; returning to default never relocks or charges',async t=>{
  const f=await fixture(t),a=f.students[0].socket;
  for(const shapeId of ['tier1','tier2','tier3'])ok(await call(a,UNLOCK,f.data('warning-rock',shapeId)));
  ok(await call(a,SET,f.data('warning-rock','tier3')));const before=f.state(),memberId=f.player(1).id,planetId=f.planet.id;
  await f.restart();assert.deepEqual(f.state(),before);assert.equal(f.player(1).id,memberId);assert.equal(f.player(1).avatar.departmentId,planetId);
  f.at(f.player(1));ok(await call(f.students[1].socket,SET,f.data('warning-rock','default')));
  assert.deepEqual(f.planet.interiorUnlocks['warning-rock'],['tier1','tier2','tier3']);assert.deepEqual(f.state().balances,before.balances);
  assert.equal(ok(await call(f.students[1].socket,UNLOCK,f.data('warning-rock','tier3'))).alreadyUnlocked,true);
  ok(await call(f.students[1].socket,SET,f.data('warning-rock','tier3',{colorId:'rose'})));
  await f.restart();assert.deepEqual(f.planet.interiorDecor['warning-rock'],{colorId:'rose',shapeId:'tier3'});assert.deepEqual(f.state().balances,before.balances);
  assert.deepEqual(f.otherPlanet.interiorUnlocks||{},{});
});

test('legacy records restore with no paid unlocks and malformed unlock records fail closed',async t=>{
  const f=await fixture(t),record=toRecord(f.room),saved=record.planets.find(p=>p.id===f.planet.id);delete saved.interiorUnlocks;
  assert.deepEqual(fromRecord(record).planets.get(f.planet.id).interiorUnlocks,{});
  for(const invalid of [null,[],{room:'tier1'},{room:['tier4']},{room:['tier1','tier1']},{door:['tier1']},{unknown:['tier1']}]){
    assert.throws(()=>validateInteriorUnlocks(invalid));
    const bad=structuredClone(record);bad.planets.find(p=>p.id===f.planet.id).interiorUnlocks=invalid;assert.throws(()=>fromRecord(bad));
  }
});
