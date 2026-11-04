import test from 'node:test';
import assert from 'node:assert/strict';
import {createConnectionHealth} from '../server/connection-health.js';
test('connection metrics aggregate bounded reasons and action timings without identity or payload',()=>{
 const logs=[],health=createConnectionHealth({enabled:true,log:s=>logs.push(s)});
 try{health.connected();health.disconnected('ping timeout');health.disconnected('student-name-secret');health.action('temple:read',320);health.action('private payload',500,true);health.action('chat:send',2);const r=health.flush();assert.equal(r.connected,1);assert.equal(r.actions,3);assert.equal(r.failures,1);assert.deepEqual(r.disconnected,{'ping timeout':1,other:1});assert.deepEqual(r.slowActions,{'temple:read':1,other:1});assert.equal(r.maxActionMs,500);assert(!logs[0].includes('student-name-secret'));assert(!logs[0].includes('private payload'));assert.equal(health.flush().actions,0);}finally{health.stop();}
});
test('disabled metrics have no timers or output',()=>{let logged=false;const h=createConnectionHealth({log:()=>logged=true});h.connected();h.disconnected('ping timeout');h.action('x',400);h.flush();h.stop();assert.equal(logged,false);});
