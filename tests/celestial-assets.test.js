import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {CONSTELLATIONS,constellationOf} from '../shared/constellations.js';
test('16 celestial originals are unique RGBA PNGs shared by LV5/6 map and profile; abilities stay LV4',()=>{
 const hashes=new Set();
 for(const c of CONSTELLATIONS){
   const stage=constellationOf(c.id,5),trans=constellationOf(c.id,6);
   assert.equal(stage.art,stage.sprite);assert.equal(stage.art,trans.art);assert.equal(stage.celestial,true);
   assert.equal(stage.ability,constellationOf(c.id,4).ability);
   const bytes=readFileSync('client'+stage.art);assert.equal(bytes.subarray(1,4).toString(),'PNG');assert.equal(bytes[25],6);
   hashes.add(createHash('sha256').update(bytes).digest('hex'));
 }
 assert.equal(hashes.size,16);
});
