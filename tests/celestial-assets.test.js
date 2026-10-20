import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {CONSTELLATIONS,constellationOf} from '../shared/constellations.js';
test('16 celestial originals are unique RGBA PNGs shared by the LV5 map and profile; Libra, Pisces, Sagittarius have LV5 abilities',()=>{
 const hashes=new Set();
 for(const c of CONSTELLATIONS){
   const stage=constellationOf(c.id,5);
   assert.equal(stage.art,stage.sprite);assert.equal(stage.celestial,true);
   if(c.id==='sagittarius'){
     assert.equal(stage.ability.mode,'black-star-two-or-department');
     assert.match(stage.ability.description,/2회/);
   }else if(c.id==='pisces'){
     assert.equal(stage.ability.mode,'pair');
     assert.match(stage.ability.description,/5일/);
   }else if(c.id==='libra'){
     assert.equal(stage.ability.mode,'dice-triple');
     assert.match(stage.ability.description,/3번/);
   }else if(c.id==='corona-borealis'){
     assert.equal(stage.ability.mode,'priority');
     assert.match(stage.ability.description,/우선권/);
   }else if(c.id==='cygnus'){
     assert.equal(stage.ability.mode,'daily-calm');
     assert.match(stage.ability.description,/월~목/);
   }else if(c.id==='aries'){
     assert.equal(stage.ability.mode,'sleep');
     assert.match(stage.ability.description,/10명/);
   }else if(c.id==='cancer'){
     assert.equal(stage.ability.mode,'duel');
     assert.match(stage.ability.description,/홀짝/);
   }else assert.equal(stage.ability,constellationOf(c.id,4).ability);
   const bytes=readFileSync('client'+stage.art);assert.equal(bytes.subarray(1,4).toString(),'PNG');assert.equal(bytes[25],6);
   hashes.add(createHash('sha256').update(bytes).digest('hex'));
 }
 assert.equal(hashes.size,16);
});
