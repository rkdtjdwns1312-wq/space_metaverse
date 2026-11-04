import test from 'node:test';
import assert from 'node:assert/strict';
import {readingFixture,call,ok} from './helpers/reading-fixture.js';
import {MAP,STREET} from '../shared/config.js';
import {INTERACTION_SAVE_ACTIONS} from '../server/interaction-save-scope.js';
test('audited interaction reads save only their classroom while retaining journey persistence',async t=>{
 const f=await readingFixture(t),store=f.game.store;
 const foreign=store.transact(()=>store.create({title:'다른 교실',allowedNames:['셋']},'foreign')).room;
 foreign.liveOnlyCallback=()=>{};
 const trans=store.transact.bind(store),scopes=[];store.transact=(work,scope)=>{scopes.push(scope);return trans(work,scope);};
 t.after(()=>{delete foreign.liveOnlyCallback;store.transact=trans;});
 for(const [event,object,data]of [
  ['temple:read',MAP.objects.find(o=>o.id==='pillar-notice'),{objectId:'pillar-notice'}],
  ['assignment:read',MAP.objects.find(o=>o.kind==='andromeda'),{}],
  ['mission:board:read',MAP.objects.find(o=>o.kind==='mission-board'),{}],
  ['arcade:open',STREET.objects.find(o=>o.kind==='arcade'),null]
 ]){
  Object.assign(f.p,{mapId:event==='arcade:open'?STREET.id:MAP.id,x:object.x,y:object.y+object.radius+25});
  ok(await call(f.student,event,data??{objectId:object.id}));assert.equal(scopes.at(-1),f.room);assert(INTERACTION_SAVE_ACTIONS.includes(event));
 }
 assert.equal(foreign.liveOnlyCallback instanceof Function,true);
 delete foreign.liveOnlyCallback;store.transact=trans;
 f.at('science');const before=structuredClone(f.p.scienceReading);await f.fail(async()=>assert.equal((await call(f.student,'science:open')).ok,false));assert.deepEqual(f.p.scienceReading,before);
 const opened=ok(await call(f.student,'science:open'));const energy=f.p.cosmicEnergy;await f.fail(async()=>assert.equal((await call(f.student,'science:claim',{factId:opened.factId})).ok,false));assert.equal(f.p.cosmicEnergy,energy);
 ok(await call(f.student,'science:claim',{factId:opened.factId}));await f.restart();assert(f.p.cosmicEnergy>energy);
});
