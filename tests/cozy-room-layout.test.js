import test from 'node:test';
import assert from 'node:assert/strict';
import {actCozy,cozyView,validateCozyActivities} from '../server/cozy-activities.js';
import {COZY_FURNITURE,COZY_GRID,cozyPreset} from '../shared/cozy-activities.js';
import {STREET} from '../shared/config.js';
import {readingFixture,call,ok} from './helpers/reading-fixture.js';
const now=Date.parse('2026-10-30T03:00:00Z');
const player=()=>({role:'student',avatar:{level:2},cosmicEnergy:0});
const all=()=>COZY_FURNITURE.map((f,i)=>({id:f.id,x:i%6,y:Math.floor(i/6),rotation:i%4,palette:i%4,scale:COZY_GRID.scales[i%3]}));
const save=(p,layout,theme='moon',time=now)=>actCozy(p,{kind:'room',action:'save',theme,layout},time);
test('room preserves old integer layouts with default size and roundtrips all24 pieces with fractional drag positions',()=>{
 const state=validateCozyActivities();state.room.layout=cozyPreset().map(({scale,...p})=>p);
 const restored=validateCozyActivities(JSON.parse(JSON.stringify(state)));
 assert.deepEqual(restored.room.layout,cozyPreset());assert.equal(COZY_FURNITURE.length,24);assert.equal(new Set(COZY_FURNITURE.map(f=>f.id)).size,24);
 const p=player(),layout=all();layout[0].x=.123456;layout[0].y=2.71828;save(p,layout,'study');
 assert.deepEqual(p.cozyActivities.room.layout,layout);assert.deepEqual(validateCozyActivities(JSON.parse(JSON.stringify(p.cozyActivities))),p.cozyActivities);
 assert.equal(cozyView(p,'room',now).catalog.grid.maxItems,24);
});
test('room rejects malformed coordinates, scales, duplicate IDs and anchors atomically',()=>{
 const p=player();save(p,cozyPreset());const before=structuredClone(p),item=cozyPreset()[0];
 const cases=[...[-1,5.01,NaN,Infinity,'2',null].map(x=>[{...item,x}]),...[-.01,3.01,NaN,Infinity,'1',null].map(y=>[{...item,y}]),...[0,.74,1.26,Infinity,NaN,null,'1'].map(scale=>[{...item,scale}]),[{...item,palette:4}],[{...item,rotation:.5}],[{...item,id:'https://example.test/a.png'}],[item,{...item,x:2}],[item,{...item,id:'desk'}],[...all(),{...item,x:.2}]];
 for(const layout of cases){assert.throws(()=>save(p,layout));assert.deepEqual(p,before);}
});
test('size, colors, theme changes and presets cannot reopen daily reward, valid newday rewards only once',()=>{
 const p=player();assert.equal(save(p,all().slice(0,2)).amount,0);assert.equal(save(p,all()).amount,90);
 assert.equal(save(p,all().map(v=>({...v,scale:.75,palette:3})),'cloud').amount,0);
 actCozy(p,{kind:'room',action:'preset',theme:'study'},now);assert.equal(save(p,all(),'study').amount,0);
 assert.equal(save(p,all(),'moon',now+86400000).amount,90);assert.equal(p.cosmicEnergy,180);
 const q=player();q.cosmicEnergy=Number.MAX_SAFE_INTEGER;const before=structuredClone(q);assert.throws(()=>save(q,all()));assert.deepEqual(q,before);
});
test('room socket persists fractional coordinates and sizes, failed save restores layout and reward',async t=>{
 const f=await readingFixture(t);const at=()=>{const o=STREET.objects.find(o=>o.kind==='cozy-room');Object.assign(f.p,{mapId:STREET.id,x:o.x,y:o.y+100,input:{x:0,y:0,at:0}});};at();
 const layout=all();layout[0].x=.42;layout[0].y=1.73;const send=()=>call(f.student,'cozy:act',{kind:'room',action:'save',theme:'cloud',layout});
 const before=structuredClone(f.p.cozyActivities),energy=f.p.cosmicEnergy;
 await f.fail(async()=>assert.equal((await send()).ok,false));assert.deepEqual(f.p.cozyActivities,before);assert.equal(f.p.cosmicEnergy,energy);
 const first=ok(await send());assert(first.amount>0);assert.equal(ok(await send()).amount,0);await f.restart();at();
 assert.deepEqual(f.p.cozyActivities.room.layout,layout);assert.equal(ok(await send()).amount,0);
});
