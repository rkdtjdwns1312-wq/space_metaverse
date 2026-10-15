import test from 'node:test';
import assert from 'node:assert/strict';
import {readingFixture,call,ok} from './helpers/reading-fixture.js';
import {validateCardMarkers} from '../server/item-cards.js';
import {templeItemRows} from '../server/temple-items.js';
test('alien choice is required and validated before consumption; diary/reading remain distinct after restart',async t=>{
 const f=await readingFixture(t);f.mutate(p=>{p.inventory=[{id:'alien-card',quantity:3}];});
 for(const exemption of [undefined,'','all','__proto__','constructor',{},['diary']]){const r=await call(f.student,'item:use',{itemId:'alien-card',targetId:f.p.id,exemption});assert.equal(r.ok,false);assert.equal(f.p.inventory[0].quantity,3);}
 for(const exemption of ['diary','reading']){f.mutate(p=>{p.lastItemUseAt=0;});ok(await call(f.student,'item:use',{itemId:'alien-card',targetId:f.p.id,exemption}));}
 assert.deepEqual(f.p.cardMarkers.map(m=>m.exemption),['diary','reading']);
 for(const viewer of [f.p,f.q,f.teacherPlayer])assert.deepEqual(templeItemRows(f.room,viewer).filter(r=>r.itemId==='alien-card').map(r=>r.exemption),['diary','reading']);
 await f.restart();assert.deepEqual(f.p.cardMarkers.map(m=>m.exemption),['diary','reading']);assert.equal(f.p.inventory[0].quantity,1);
 const legacy={...f.p.cardMarkers[0]};delete legacy.exemption;assert.doesNotThrow(()=>validateCardMarkers([legacy]));
 assert.throws(()=>validateCardMarkers([{...legacy,exemption:'invalid'}]));assert.throws(()=>validateCardMarkers([{...legacy,itemId:'space-food-card',exemption:'diary'}]));
});
test('failed alien save restores inventory, chosen marker and cooldown for safe retry',async t=>{
 const f=await readingFixture(t);f.mutate(p=>{p.inventory=[{id:'alien-card',quantity:1}];});const before=f.p.lastItemUseAt;
 await f.fail(async()=>assert.equal((await call(f.student,'item:use',{itemId:'alien-card',targetId:f.p.id,exemption:'reading'})).ok,false));
 assert.equal(f.p.inventory[0].quantity,1);assert.equal(f.p.cardMarkers?.length??0,0);assert.equal(f.p.lastItemUseAt,before);
 ok(await call(f.student,'item:use',{itemId:'alien-card',targetId:f.p.id,exemption:'reading'}));assert.equal(f.p.cardMarkers[0].exemption,'reading');
});
