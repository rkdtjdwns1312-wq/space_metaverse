import test from 'node:test';
import assert from 'node:assert/strict';
import {createRenderQuality,renderQualityMode,intersectsView} from '../client/render-quality.js';

function drive(quality,{start=0,seconds=5,refresh=60,cost=3}={}){
  let draws=0;
  for(let frame=0;frame<seconds*refresh;frame++)if(quality.shouldRender(start+frame*1000/refresh)){
    quality.recordRender(cost);draws++;
  }
  return draws;
}
test('manual low draws thirty frames at common display refresh rates',()=>{
  for(const refresh of [60,90,120,144]){
    const q=createRenderQuality({mode:'low'}),count=drive(q,{seconds:10,refresh});
    assert.ok(Math.abs(count-300)<=1,`${refresh}Hz drew ${count}`);
    assert.equal(q.dpr(3),1);assert.equal(q.dpr(.75),1);
  }
});
test('manual medium and high preserve sixty frames under load at common refresh rates',()=>{
  for(const mode of ['medium','high','normal'])for(const refresh of [60,90,120,144]){
    const q=createRenderQuality({mode});
    assert.ok(Math.abs(drive(q,{seconds:10,refresh,cost:40})-600)<=1);
    assert.equal(q.stats().quality,mode==='normal'?'high':mode);
    assert.equal(q.dpr(3),mode==='medium'?1.5:2);assert.equal(q.dpr(1.25),1.25);
    assert.equal(q.reducedEffects,mode==='medium');assert.equal(q.effectQuality,mode==='medium'?'medium':'full');
  }
});
test('auto tolerates a transient stall then reduces detail before frame cadence',()=>{
  const q=createRenderQuality();
  drive(q,{seconds:2,cost:40});assert.equal(q.stats().quality,'high');
  drive(q,{start:2000,seconds:3,cost:40});assert.equal(q.stats().quality,'medium');assert.equal(q.stats().fps,60);
  drive(q,{start:5000,seconds:3,cost:40});assert.equal(q.stats().quality,'low');
  assert.equal(q.dpr(2),1);
});
test('auto detects missed display frames even when draw CPU timing is small',()=>{
  const q=createRenderQuality();drive(q,{seconds:8,refresh:30,cost:4});
  assert.equal(q.stats().quality,'low');
});
test('auto recovery needs sustained headroom, manual override responds immediately',()=>{
  const q=createRenderQuality();drive(q,{seconds:8,cost:30});
  drive(q,{start:8000,seconds:10,cost:2});assert.equal(q.stats().quality,'low');
  drive(q,{start:18000,seconds:15,cost:2});assert.equal(q.stats().quality,'medium');
  drive(q,{start:33000,seconds:20,cost:2});assert.equal(q.stats().quality,'high');
  q.setMode('low');assert.equal(q.stats().quality,'low');assert.equal(q.shouldRender(53001),true);
  q.setMode('normal');assert.equal(q.stats().quality,'high');assert.equal(q.stats().mode,'high');assert.equal(q.shouldRender(53002),true);
});
test('hidden/suspended time does not become slow performance and no catch-up burst occurs',()=>{
  const q=createRenderQuality();drive(q,{seconds:2,cost:30});q.pause();
  drive(q,{start:100000,seconds:2,cost:30});assert.equal(q.stats().quality,'high');
  q.setMode('low');assert.equal(q.shouldRender(200000),true);
  assert.equal(q.shouldRender(200000),false);assert.equal(q.shouldRender(200001),false);
  assert.equal(q.shouldRender(300000),true);assert.equal(q.shouldRender(300001),false);
});
test('unsupported persisted modes fall back to auto and low-power hint is auto-only',()=>{
  assert.equal(renderQualityMode('broken'),'auto');
  assert.equal(createRenderQuality({mode:'broken',lowPower:true}).stats().quality,'low');
  assert.equal(createRenderQuality({mode:'normal',lowPower:true}).stats().quality,'high');
  const lowDevice=createRenderQuality({mode:'high',lowPower:true});lowDevice.setMode('auto');
  assert.equal(lowDevice.stats().quality,'low');assert.equal(lowDevice.effectQuality,'low');
  assert.equal(renderQualityMode('normal'),'high');assert.equal(renderQualityMode('medium'),'medium');
  assert.equal(createRenderQuality().shouldRender(NaN),false);
});
test('culling includes touching edges, padded roofs and unknown bounds',()=>{
  const view={x:100,y:100,width:500,height:300};
  assert.equal(intersectsView(view,{x:600,y:150,width:200,height:200}),true);
  assert.equal(intersectsView(view,{x:601,y:150,width:200,height:200}),false);
  assert.equal(intersectsView(view,{x:650,y:450,width:30,height:30},100),true);
  assert.equal(intersectsView(view,{x:700,y:500,width:30,height:30},50),false);
  assert.equal(intersectsView(view,{x:NaN,y:0,width:20,height:20}),true);
  assert.equal(intersectsView({},{}),true);
});
