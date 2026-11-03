import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync,readFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {PersistentRoomStore} from '../server/persistent-rooms.js';

function fixture(t){
 const dir=mkdtempSync(join(tmpdir(),'scoped-persistence-')),store=new PersistentRoomStore(dir);
 t.after(()=>{store.close();rmSync(dir,{recursive:true,force:true});});
 const make=()=>{const {room}=store.transact(()=>store.create({title:'검사',allowedNames:['1','2']},'teacher'));
  const {player:p}=store.transact(()=>store.join({code:room.code,nickname:'1',pin:'1234'},'one'));
  const {player:q}=store.transact(()=>store.join({code:room.code,nickname:'2',pin:'1234'},'two'));
  return {code:room.code,p,q,get room(){return store.rooms.get(room.code);}};};
 const a=make(),b=make(),disk=code=>readFileSync(join(dir,code+'.json'),'utf8');
 return {store,a,b,disk};
}

test('scoped saves persist the entire target classroom atomically without touching another classroom or its live references',t=>{
 const {store,a,b,disk}=fixture(t),foreignRoom=b.room,foreignRecord=store.records.get(b.code),foreignSession=store.sessions.get(b.p.token),foreignDisk=disk(b.code);
 // Nonpersisted live references in another classroom must not be traversed.
 b.room.integrationCallback=()=>{};
 store.transact(()=>{a.p.starShards=8;a.q.starShards=2;a.q.inventory.push({id:'black-gem',quantity:1});},a.room);
 const saved=JSON.parse(disk(a.code));assert.equal(saved.students.find(p=>p.id===a.p.id).starShards,8);
 assert.equal(saved.students.find(p=>p.id===a.q.id).starShards,2);assert(a.q.serenaProgress.bossKills.includes('dark-star'));
 assert.equal(b.room,foreignRoom);assert.equal(store.records.get(b.code),foreignRecord);assert.equal(store.sessions.get(b.p.token),foreignSession);assert.equal(disk(b.code),foreignDisk);
});

test('failed scoped disk save restores balances, consumed inventory/history and session rotation while preserving player identities',t=>{
 const {store,a,b,disk}=fixture(t),p=a.p,q=a.q,token=p.token,foreign=b.room,foreignSession=store.sessions.get(b.p.token),before=disk(a.code);
 const save=store.files.save.bind(store.files);store.files.save=()=>{throw Error('scoped disk failure');};
 assert.throws(()=>store.transact(()=>{
  p.starShards=100;q.starShards=200;p.inventory.push({id:'origin-star-record',quantity:1});
  store.sessions.delete(token);p.token='replacement';store.sessions.set(p.token,{room:a.room,player:p});p.transientFailure='remove me';
 },a.room),/scoped disk failure/);store.files.save=save;
 assert.equal(a.room.players.get(p.id),p);assert.equal(a.room.players.get(q.id),q);assert.equal(p.token,token);
 assert.equal(p.starShards,0);assert.equal(q.starShards,0);assert.deepEqual(p.inventory,[]);assert(!p.serenaProgress?.bossKills.includes('star-record'));assert(!('transientFailure' in p));
 assert(!store.sessions.has('replacement'));assert.equal(store.sessions.get(token).player,p);assert.equal(store.sessions.get(token).room,a.room);
 assert.equal(b.room,foreign);assert.equal(store.sessions.get(b.p.token),foreignSession);assert.equal(disk(a.code),before);
 store.transact(()=>{p.inventory.push({id:'origin-star-record',quantity:1});p.starShards=3;},a.room);
 assert.equal(p.starShards,3);assert(p.serenaProgress.bossKills.includes('star-record'));
});

test('commit-on-error saves authorized state once, but a failed disk write still restores it',t=>{
 const {store,a,disk}=fixture(t),denial=Object.assign(Error('expected denial'),{commitOnError:true});
 assert.throws(()=>store.transact(()=>{a.p.starShards=7;throw denial;},a.room),e=>e===denial);
 assert.equal(a.p.starShards,7);assert.equal(JSON.parse(disk(a.code)).students.find(p=>p.id===a.p.id).starShards,7);
 const save=store.files.save.bind(store.files);store.files.save=()=>{throw Error('disk unavailable');};
 assert.throws(()=>store.transact(()=>{a.p.starShards=9;throw denial;},a.room),/disk unavailable/);store.files.save=save;
 assert.equal(a.p.starShards,7);
});

test('stale scopes are rejected and closing a room cannot silently bypass lifecycle persistence',t=>{
 const {store,a}=fixture(t),original=a.room;
 assert.throws(()=>store.transact(()=>{throw Error('must not run');},{code:a.code}),/저장 범위/);
 assert.throws(()=>store.transact(()=>store.destroy(a.room),a.room),/전체 저장 범위/);
 assert(store.rooms.has(a.code));assert.equal(a.room.players.get(a.p.id),a.p);assert(store.sessions.has(a.p.token));
 assert.notEqual(a.room,original);assert.throws(()=>store.transact(()=>{},original),/저장 범위/);
 store.transact(()=>store.destroy(a.room));assert(!store.rooms.has(a.code));assert(store.records.has(a.code));
});

test('unscoped multi-classroom guard and rollback remain intact',t=>{
 const {store,a,b,disk}=fixture(t),left=disk(a.code),right=disk(b.code);
 assert.throws(()=>store.transact(()=>{a.p.starShards=4;b.p.starShards=6;}),/여러 교실/);
 assert.equal(a.p.starShards,0);assert.equal(b.p.starShards,0);assert.equal(disk(a.code),left);assert.equal(disk(b.code),right);
});
