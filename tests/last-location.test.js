import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {PersistentRoomStore,toRecord,fromRecord} from '../server/persistent-rooms.js';
import {validateLastLocation,rememberStudentLocation,studentReturnPosition} from '../server/last-location.js';
import {spawnInside,isFree} from '../server/world.js';
import {PLAZA_ID,STREET_ID,BLACK_HOLE_ID,WHALE_STOMACH_ID,mapOf,interiorIdOf} from '../shared/config.js';
import {chargeHuntingStation} from '../server/hunting-time.js';
import {huntingResetAt} from '../shared/hunting-time.js';
import {readingFixture,call,ok} from './helpers/reading-fixture.js';

function fixture(t){
 const dir=mkdtempSync(join(tmpdir(),'last-location-')),store=new PersistentRoomStore(dir,{unattended:true});
 t.after(()=>{store.close();rmSync(dir,{recursive:true,force:true});});
 const make=()=>{
  const {room}=store.transact(()=>store.create({title:'위치 검사',allowedNames:['1']},'teacher'));
  const {player:p}=store.transact(()=>store.join({code:room.code,nickname:'1',pin:'1234'},'student'));
  return {room,p};
 };
 return {store,make,...make()};
}

test('explicit leave, PIN login and server restart restore the server-recorded map and position',async t=>{
 const f=await readingFixture(t);
 const location={...spawnInside(f.room,STREET_ID,f.p),mapId:STREET_ID};Object.assign(f.p,location);
 ok(await call(f.student,'room:leave'));
 assert.deepEqual(f.p.lastLocation,location);
 assert.equal((await call(f.student,'room:join',{code:f.room.code,nickname:'하나',pin:'9999'})).ok,false);
 ok(await call(f.student,'room:join',{code:f.room.code,nickname:'하나',pin:'1234',lastLocation:{mapId:'sleeping-stars-4',x:500,y:500}}));
 assert.deepEqual({mapId:f.p.mapId,x:f.p.x,y:f.p.y},location);
 await f.restart();assert.deepEqual({mapId:f.p.mapId,x:f.p.x,y:f.p.y},location);
 assert.equal(f.game.store.snapshot(f.room,f.q,f.now).players.find(p=>p.id===f.p.id).lastLocation,undefined);
});

test('resume retains current location but an expired hunting cycle returns the student to the shelter',async t=>{
 const f=await readingFixture(t);f.p.avatar.level=5;chargeHuntingStation(f.p,'math',f.now);
 Object.assign(f.p,spawnInside(f.room,'star-origin-1',f.p),{mapId:'star-origin-1'});
 await f.reconnect();assert.equal(f.p.mapId,'star-origin-1');
 f.advance(huntingResetAt(f.now)-f.now+1);
 await f.reconnect();assert.equal(f.p.mapId,STREET_ID);
});

test('capture is explicit and serialization remains stable while multiple classrooms move',t=>{
 const {store,room,p,make}=fixture(t),b=make();
 const beforeB=JSON.stringify(toRecord(b.room));
 p.x+=30;b.p.x+=70;
 assert.equal(JSON.stringify(toRecord(b.room)),beforeB);
 store.transact(()=>{rememberStudentLocation(p);p.starShards=1;});
 assert.equal(JSON.stringify(toRecord(b.room)),beforeB);
 const saved=toRecord(room),restored=fromRecord(saved);
 assert.deepEqual(restored.players.get(p.id).lastLocation,p.lastLocation);
 const old=structuredClone(saved);delete old.students[0].lastLocation;
 assert.equal(fromRecord(old).players.get(p.id).lastLocation,null);
 old.students[0].lastLocation={mapId:STREET_ID,x:'bad',y:0};
 assert.equal(fromRecord(old).players.get(p.id).lastLocation,null);
 const prior=structuredClone(p.lastLocation),save=store.files.save.bind(store.files);
 store.files.save=()=>{throw Error('location save failure');};p.x+=50;
 assert.throws(()=>store.transact(()=>store.remove(room,p)),/location save failure/);store.files.save=save;
 assert.deepEqual(p.lastLocation,prior);assert(p.connected);
});

test('saved map access is rechecked and confinement takes precedence over logout location',t=>{
 const {room,p}=fixture(t),now=Date.now();
 p.lastLocation={mapId:'missing-map',x:500,y:500};assert.equal(studentReturnPosition(room,p,now).mapId,PLAZA_ID);
 p.lastLocation={mapId:interiorIdOf('deleted'),x:500,y:500};assert.equal(studentReturnPosition(room,p,now).mapId,PLAZA_ID);
 room.planets.set('department',{id:'department',name:'부서',x:500,y:500,radius:20});
 p.lastLocation={mapId:interiorIdOf('department'),x:500,y:500};assert.equal(studentReturnPosition(room,p,now).mapId,PLAZA_ID);
 p.avatar.departmentId='department';assert.equal(studentReturnPosition(room,p,now).mapId,interiorIdOf('department'));
 p.lastLocation={mapId:'sleeping-stars-4',x:500,y:500};assert.equal(studentReturnPosition(room,p,now).mapId,PLAZA_ID);
 p.lastLocation={mapId:'star-origin-1',x:500,y:500};assert.equal(studentReturnPosition(room,p,now).mapId,STREET_ID);
 p.avatar.blackStar={};assert.equal(studentReturnPosition(room,p,now).mapId,BLACK_HOLE_ID);
 p.avatar.blackStar=null;p.constellationAbilityState={cetusStomach:{endsAt:now+1000}};
 assert.equal(studentReturnPosition(room,p,now).mapId,WHALE_STOMACH_ID);
 p.lastLocation={mapId:WHALE_STOMACH_ID,x:500,y:500};assert.equal(studentReturnPosition(room,p,now+1001).mapId,PLAZA_ID);
 p.constellationAbilityState={};p.lastLocation={mapId:BLACK_HOLE_ID,x:500,y:500};assert.equal(studentReturnPosition(room,p,now).mapId,PLAZA_ID);
 assert.equal(validateLastLocation({mapId:STREET_ID,x:Infinity,y:0}),null);
});

test('blocked or out-of-bounds saved coordinates use a nearby free point in the same map',t=>{
 const {room,p}=fixture(t),map=mapOf(STREET_ID);
 p.lastLocation={mapId:STREET_ID,x:map.width+500,y:map.height/2};
 const result=studentReturnPosition(room,p,Date.now());
 assert.equal(result.mapId,STREET_ID);assert.notEqual(result.x,p.lastLocation.x);
 assert(isFree(room,result.x,result.y,p.id,result.mapId,true,p));
});
