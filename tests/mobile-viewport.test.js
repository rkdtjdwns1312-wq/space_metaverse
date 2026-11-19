import {test} from 'node:test';
import assert from 'node:assert/strict';
import {keyboardViewport} from '../client/mobile-viewport.js';
test('mobile writing viewport accounts for keyboard and its vertical offset',()=>{
 assert.deepEqual(keyboardViewport({height:844,viewportHeight:390,offsetTop:48,mobile:true,editing:true}),{open:true,height:390,top:48});
});
test('zoom, browser chrome, desktop and non-writing controls never trigger keyboard layout',()=>{
 const base={height:844,viewportHeight:390,mobile:true,editing:true};
 for(const override of [{scale:2},{viewportHeight:800},{mobile:false},{editing:false}])assert.equal(keyboardViewport({...base,...override}).open,false);
});
test('missing visual viewport preserves the normal layout',()=>{
 assert.deepEqual(keyboardViewport({height:844,mobile:true,editing:true}),{open:false,height:844,top:0});
});
