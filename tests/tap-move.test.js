import test from 'node:test';
import assert from 'node:assert/strict';
import {createTapMove} from '../client/tap-move.js';
const player={mapId:'space-plaza',x:100,y:100};
test('tap movement follows a point and stops on arrival or overshoot',()=>{
 const move=createTapMove();move.start({x:200,y:100},player,0);
 assert.deepEqual(move.steer(player,80),{x:1,y:0});
 assert.deepEqual(move.steer({...player,x:193},160),{x:0,y:0});
 move.start({x:200,y:100},player,200);move.steer(player,240);
 assert.deepEqual(move.steer({...player,x:230},320),{x:0,y:0});
});
test('tap movement cancels when blocked, changed maps, defeated, timed out or manually stopped',()=>{
 for(const [next,at] of [[player,901],[{...player,mapId:'elsewhere'},80],[{...player,vitals:{defeated:true}},80],[player,20000]]){
  const move=createTapMove();move.start({x:200,y:100},player,0);assert.deepEqual(move.steer(next,at),{x:0,y:0});
 }
 const move=createTapMove();move.start({x:200,y:100},player,0);move.cancel();assert.deepEqual(move.steer(player,80),{x:0,y:0});
 move.start({x:NaN,y:100},player,0);assert.deepEqual(move.steer(player,80),{x:0,y:0});
});
