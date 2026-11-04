import test from 'node:test';
import assert from 'node:assert/strict';
import {createSocketRateLimit,socketRateMiddleware} from '../server/socket-rate-limit.js';
import {readingFixture,call,ok} from './helpers/reading-fixture.js';
test('normal 80/s and short bursts preserve connection, dropped actions acknowledge without executing',()=>{
 let now=0,calls=0,closed=0;const acknowledgements=[];
 const middleware=socketRateMiddleware({disconnect(){closed++;}},{clock:()=>now});
 for(let i=0;i<100;i++)middleware(['operation',{},r=>acknowledgements.push(r)],()=>calls++);
 assert.equal(calls,80);assert.equal(closed,0);assert.equal(acknowledgements.length,20);assert(acknowledgements.every(r=>!r.ok&&r.retryable));
 now=1000;middleware(['operation',{}],()=>calls++);assert.equal(calls,81);
});
test('only three consecutive extreme windows disconnect; quiet window and clock rollback reset history',()=>{
 let now=0;const check=createSocketRateLimit({clock:()=>now});
 for(let window=0;window<2;window++){now=window*1000;for(let i=0;i<500;i++)assert.notEqual(check(),'disconnect');}
 now=2000;for(let i=0;i<400;i++)assert.notEqual(check(),'disconnect');assert.equal(check(),'disconnect');
 now=5000;for(let i=0;i<500;i++)assert.notEqual(check(),'disconnect');now=1000;assert.equal(check(),'allow');
});
test('actual classroom socket remains usable after a 100-request interaction burst',async t=>{
 const f=await readingFixture(t);await new Promise(r=>setTimeout(r,1050));
 const results=await Promise.all(Array.from({length:100},()=>call(f.teacher,'assignment:read')));
 assert(results.some(r=>r.retryable===true));assert(f.teacher.connected);await new Promise(r=>setTimeout(r,1050));ok(await call(f.teacher,'assignment:read'));assert(f.teacher.connected);
});
