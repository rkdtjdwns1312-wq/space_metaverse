import test from 'node:test';
import assert from 'node:assert/strict';
import {DEFAULT_CONTROL_KEYS,validateControlKeys} from '../shared/control-keys.js';
import {STREET,interactionReach,interactionDistance,RULES,INTERACT} from '../shared/config.js';
import {isNear} from '../server/world.js';
test('saved keys allow top-row 1–6 and reject duplicate, movement, reroll and malformed settings',()=>{
  assert(validateControlKeys(DEFAULT_CONTROL_KEYS));assert(validateControlKeys({attack:'KeyJ',skill:'KeyK',interact:'KeyL'}));
  assert(validateControlKeys({attack:'Digit1',skill:'Digit3',interact:'Digit6'}));
  for(const bad of [null,[],{}, {...DEFAULT_CONTROL_KEYS,attack:'KeyF'},...['KeyW','KeyA','KeyS','KeyD','KeyR','Digit7','Numpad1','F5','Enter','Escape'].map(attack=>({...DEFAULT_CONTROL_KEYS,attack})),{...DEFAULT_CONTROL_KEYS,other:'KeyJ'}])assert.equal(validateControlKeys(bad),false);
});
test('energy shop reach increases by 80 with the same server/client boundary and unchanged collision',()=>{
 const shop=STREET.objects.find(o=>o.kind==='energy-shop'),old=RULES.radius+INTERACT.radius+shop.radius;
 assert.equal(shop.radius,84);assert.equal(interactionReach(shop),old+80);
 assert(isNear({x:shop.x+old+60,y:shop.y},shop));assert(isNear({x:shop.x,y:shop.y+old+80},shop));
 assert.equal(isNear({x:shop.x+old+81,y:shop.y},shop),false);assert.equal(interactionDistance({x:shop.x+200,y:shop.y},shop),200);
 const crafting=STREET.objects.find(o=>o.kind==='crafting');assert.equal(interactionReach(crafting),RULES.radius+INTERACT.radius+crafting.radius);
});
