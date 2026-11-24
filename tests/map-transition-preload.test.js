import test from 'node:test';
import assert from 'node:assert/strict';
import {createMapTransitionPreload} from '../client/map-transition-preload.js';

const settle=()=>new Promise(resolve=>setImmediate(resolve));
function fixture(){
  const jobs=new Map(),calls=[];let id=0,network={};
  const map={id:'a',objects:[{kind:'gate',target:'b',x:500,y:0},{kind:'gate',target:'c',x:1500,y:0}]};
  let finish;
  const loader=createMapTransitionPreload({mapOf:id=>({id}),connection:()=>network,isHidden:()=>!!network.hidden,
    prepare:map=>{calls.push(map.id);return {promise:new Promise(resolve=>{finish=resolve;})};},
    schedule:fn=>{jobs.set(++id,fn);return id;},cancel:id=>jobs.delete(id)});
  const update=(extra={})=>loader.update({map,player:{x:0,y:0},ready:true,time:1000,...extra});
  const run=async()=>{for(const [id,fn] of jobs){jobs.delete(id);fn();}await settle();};
  return {loader,update,run,calls,jobs,map,network,finish:async()=>{finish();await settle();}};
}
test('prefetch nearest gate only, reuse once, and cap concurrency',async()=>{
  const f=fixture();f.update();assert.equal(f.jobs.size,1);await f.run();assert.deepEqual(f.calls,['b']);
  f.update({player:{x:1500,y:0},time:1500});assert.equal(f.jobs.size,0);
  await f.finish();f.update({player:{x:1500,y:0},time:2000});await f.run();assert.deepEqual(f.calls,['b','c']);
  await f.finish();f.update({time:2500});assert.equal(f.jobs.size,0);
});
test('no speculative work when far away, foreground loading, hidden, or data saver',()=>{
  const f=fixture();
  for(const extra of [{player:{x:4000,y:0}},{ready:false},{hidden:true},{player:null}]){f.update(extra);assert.equal(f.jobs.size,0);}
  f.network.saveData=true;f.update({time:2000});assert.equal(f.jobs.size,0);
  f.network.saveData=false;f.network.effectiveType='2g';f.update({time:2500});assert.equal(f.jobs.size,0);
});
test('walking away, leaving the map or hiding cancels queued work',async()=>{
  for(const next of [{player:{x:4000,y:0}},{map:{id:'new',objects:[]}},{hidden:true}]){
    const f=fixture();f.update();f.update({...next,time:1400});await f.run();assert.deepEqual(f.calls,[]);
  }
  const f=fixture();f.update();f.loader.cancel();await f.run();assert.deepEqual(f.calls,[]);
});
test('a hidden tab or changed data-saver setting cancels at dispatch even without another frame',async()=>{
  for(const key of ['hidden','saveData']){
    const f=fixture();f.update();f.network[key]=true;await f.run();assert.deepEqual(f.calls,[]);
  }
});
test('failed speculative preparation releases its slot and does not throw',async()=>{
  let calls=0;const loader=createMapTransitionPreload({mapOf:id=>({id}),prepare:()=>{calls++;throw Error('offline');},schedule:fn=>setTimeout(fn,0)});
  const update=(target,time)=>loader.update({map:{id:'a',objects:[{kind:'gate',target,x:0,y:0}]},player:{x:0,y:0},ready:true,time});
  update('b',0);await new Promise(r=>setTimeout(r,20));update('c',1000);await new Promise(r=>setTimeout(r,20));assert.equal(calls,2);
});
