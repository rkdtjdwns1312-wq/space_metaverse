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
test('manual normal remains normal under load and caps high-density canvas at two',()=>{
  const q=createRenderQuality({mode:'normal'});
  assert.equal(drive(q,{seconds:10,refresh:120,cost:40}),600);
  assert.equal(q.stats().quality,'normal');assert.equal(q.dpr(3),2);assert.equal(q.dpr(1.25),1.25);
});
test('auto tolerates a transient stall then adapts to sustained CPU load',()=>{
  const q=createRenderQuality();
  drive(q,{seconds:2,cost:40});assert.equal(q.stats().quality,'normal');
  drive(q,{start:2000,seconds:4,cost:40});assert.equal(q.stats().quality,'low');
  assert.equal(q.dpr(2),1);
});
test('auto detects missed display frames even when draw CPU timing is small',()=>{
  const q=createRenderQuality();drive(q,{seconds:5,refresh:30,cost:4});
  assert.equal(q.stats().quality,'low');
});
test('auto recovery needs sustained headroom, manual override responds immediately',()=>{
  const q=createRenderQuality();drive(q,{seconds:5,cost:30});
  drive(q,{start:5000,seconds:10,cost:2});assert.equal(q.stats().quality,'low');
  drive(q,{start:15000,seconds:15,cost:2});assert.equal(q.stats().quality,'normal');
  q.setMode('low');assert.equal(q.stats().quality,'low');assert.equal(q.shouldRender(30001),true);
  q.setMode('normal');assert.equal(q.stats().quality,'normal');assert.equal(q.shouldRender(30002),true);
});
test('hidden/suspended time does not become slow performance and no catch-up burst occurs',()=>{
  const q=createRenderQuality();drive(q,{seconds:2,cost:30});q.pause();
  drive(q,{start:100000,seconds:2,cost:30});assert.equal(q.stats().quality,'normal');
  q.setMode('low');assert.equal(q.shouldRender(200000),true);
  assert.equal(q.shouldRender(200000),false);assert.equal(q.shouldRender(200001),false);
  assert.equal(q.shouldRender(300000),true);assert.equal(q.shouldRender(300001),false);
});
test('unsupported persisted modes fall back to auto and low-power hint is auto-only',()=>{
  assert.equal(renderQualityMode('broken'),'auto');
  assert.equal(createRenderQuality({mode:'broken',lowPower:true}).stats().quality,'low');
  assert.equal(createRenderQuality({mode:'normal',lowPower:true}).stats().quality,'normal');
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
