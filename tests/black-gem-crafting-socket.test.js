import test from 'node:test';
import assert from 'node:assert/strict';
import {STREET} from '../shared/config.js';
import {readingFixture,call,ok} from './helpers/reading-fixture.js';
const ingredients=[{id:'black-gem',quantity:1}],output='primordial-star-sigil';
test('black gem public crafting works without private recipes or learning; missing costs and duplicate requests preserve balances',async t=>{
 const f=await readingFixture(t,{craftingRecipes:[]}),machine=STREET.objects.find(o=>o.kind==='crafting');
 const at=()=>Object.assign(f.p,{mapId:STREET.id,x:machine.x,y:machine.y+80,input:{x:0,y:0,at:0}});at();
 assert.equal(ok(await call(f.student,'crafting:open')).configured,false);assert.deepEqual(ok(await call(f.student,'recipes:learned')).recipes,[]);
 f.mutate(p=>Object.assign(p,{inventory:[],starShards:0,cosmicEnergy:10000}));at();
 assert.match((await call(f.student,'crafting:combine',{ingredients})).error,/재료가 부족/);assert.equal(f.p.cosmicEnergy,10000);
 f.mutate(p=>Object.assign(p,{inventory:structuredClone(ingredients),cosmicEnergy:9999}));at();assert.match((await call(f.student,'crafting:combine',{ingredients})).error,/우주에너지가 부족/);assert.deepEqual(f.p.inventory,ingredients);assert.equal(f.p.cosmicEnergy,9999);
 f.mutate(p=>p.cosmicEnergy=10000);at();const results=await Promise.all([call(f.student,'crafting:combine',{ingredients}),call(f.student,'crafting:combine',{ingredients})]);assert.equal(results.filter(r=>r.ok&&r.success).length,1);assert.equal(f.p.cosmicEnergy,0);assert.equal(f.p.starShards,0);assert.deepEqual(f.p.inventory,[{id:output,quantity:1}]);assert.ok(ok(await call(f.student,'recipes:learned')).recipes.some(r=>r.output.id===output));
});
