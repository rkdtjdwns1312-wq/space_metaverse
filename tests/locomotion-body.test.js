import test from 'node:test';
import assert from 'node:assert/strict';
import {createBodyMotion} from '../client/locomotion-body.js';
test('몸 움직임은 이동속도에 따라 빨라지지 않고 정지 후 부드럽게 사라진다',()=>{
 const a=createBodyMotion(),b=createBodyMotion();let pose;
 for(let t=0;t<=1000;t+=20){pose=a.sample('p','map',t*.02,0,t);assert.deepEqual(pose,b.sample('p','map',t*.2,0,t));assert(Math.abs(pose.angle)<.02);assert(Math.abs(pose.y)<2);}
 const before=pose;pose=a.sample('p','map',20,0,1020);assert(Math.abs(before.y-pose.y)<.3);
 for(let t=1040;t<=1600;t+=20)pose=a.sample('p','map',20,0,t);
 assert.equal(pose.weight,0);assert.equal(pose.angle,0);assert.equal(Math.abs(pose.y),0);
});
test('맵 전환·순간이동·움직임 줄이기에서는 이전 몸 움직임이 남지 않는다',()=>{
 const clock=createBodyMotion();clock.sample('p','a',0,0,0);clock.sample('p','a',1,0,50);
 assert.equal(clock.sample('p','a',600,0,70).weight,0);
 assert.equal(clock.sample('p','b',601,0,100).weight,0);
 assert.equal(clock.sample('p','b',602,0,120,true).weight,0);
});
