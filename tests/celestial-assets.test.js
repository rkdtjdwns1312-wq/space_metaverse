import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {CONSTELLATIONS,constellationOf} from '../shared/constellations.js';
test('16 celestial originals are unique RGBA PNGs shared by the LV5 map and profile; Libra has its own LV5 ability',()=>{
 const hashes=new Set();
 for(const c of CONSTELLATIONS){
   const stage=constellationOf(c.id,5);
   assert.equal(stage.art,stage.sprite);assert.equal(stage.celestial,true);
   if(c.id==='libra'){
     assert.equal(stage.ability.mode,'dice-triple');
     assert.match(stage.ability.description,/3번/);
   }else assert.equal(stage.ability,constellationOf(c.id,4).ability);
   const bytes=readFileSync('client'+stage.art);assert.equal(bytes.subarray(1,4).toString(),'PNG');assert.equal(bytes[25],6);
   hashes.add(createHash('sha256').update(bytes).digest('hex'));
 }
 assert.equal(hashes.size,16);
});
