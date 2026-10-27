import test from 'node:test';
import assert from 'node:assert/strict';
import {createBlankPlanetDesign,normalizePlanetDesign,drawPlanetDesign,PLANET_DESIGN_LIMITS} from '../shared/planet-design.js';

const brush=(overrides={})=>({tool:'brush',color:'#123ABC',width:8,points:[[0,0],[128,64],[256,256]],...overrides});
const shape=(tool='star',overrides={})=>({tool,color:'#Ffeebb',width:5,fill:true,x:12,y:15,w:100,h:110,...overrides});
const design=(marks=[],overrides={})=>({...createBlankPlanetDesign(),marks,...overrides});

test('planet design canonicalizes all supported marks and makes an independent snapshot',()=>{
  const input=design([brush(),shape('circle'),shape('rect'),shape('star')],{background:'#AAbbCC'});
  const actual=normalizePlanetDesign(input);
  assert.equal(actual.background,'#aabbcc');assert.equal(actual.marks[0].color,'#123abc');
  assert.deepEqual(normalizePlanetDesign(JSON.parse(JSON.stringify(actual))),actual);
  input.marks[0].points[0][0]=190;assert.equal(actual.marks[0].points[0][0],0);
  assert.ok(normalizePlanetDesign(design()));
});

test('planet design rejects markup, images, unknown fields and unsupported versions',()=>{
  const invalid=[null,[],{},design([],{version:2}),design([],{image:'https://example.com/a.png'}),design([],{background:'url(x)'}),design([],{background:'#fff'}),design([brush({color:'<svg onload=alert(1)>'})]),design([brush({tool:'image'})]),design([brush({src:'data:image/svg+xml,x'})]),design([shape('svg')]),design([shape('circle',{fill:'true'})])];
  for(const value of invalid)assert.equal(normalizePlanetDesign(value),null);
});

test('planet design bounds coordinates, dimensions, brush widths and finite values',()=>{
  for(const n of [-1,257,NaN,Infinity,'2',null])assert.equal(normalizePlanetDesign(design([brush({points:[[n,0]]})])),null);
  for(const width of [0,41,Infinity,'8'])assert.equal(normalizePlanetDesign(design([brush({width})])),null);
  for(const points of [[],[[0]],[[0,0,1]],['0,0']])assert.equal(normalizePlanetDesign(design([brush({points})])),null);
  for(const overrides of [{x:200,w:57},{y:200,h:57},{w:0},{h:-1},{w:.001},{x:NaN}])assert.equal(normalizePlanetDesign(design([shape('rect',overrides)])),null);
  assert.ok(normalizePlanetDesign(design([shape('rect',{x:0,y:0,w:256,h:256}),brush({width:40,points:[[256,0]]})])));
});

test('planet design limits mark count, individual strokes, total points and encoded size',()=>{
  assert.ok(normalizePlanetDesign(design(Array.from({length:120},()=>shape()))));
  assert.equal(normalizePlanetDesign(design(Array.from({length:121},()=>shape()))),null);
  const points=Array.from({length:256},()=>[1,2]);
  assert.ok(normalizePlanetDesign(design([brush({points})])));
  assert.equal(normalizePlanetDesign(design([brush({points:[...points,[3,4]]})])),null);
  assert.ok(normalizePlanetDesign(design(Array.from({length:16},()=>brush({points})))));
  assert.equal(normalizePlanetDesign(design([...Array.from({length:16},()=>brush({points})),brush({points:[[1,2]]})])),null);
  const largePoints=Array.from({length:256},()=>[123.45,234.56]);
  assert.equal(normalizePlanetDesign(design(Array.from({length:16},()=>brush({points:largePoints})))),null);
  assert.equal(PLANET_DESIGN_LIMITS.bytes,65536);
});

test('planet design rounding preserves shape endpoints and refuses degenerate tiny shapes',()=>{
  const actual=normalizePlanetDesign(design([shape('rect',{x:200.123,y:200.234,w:55.877,h:55.766})]));
  assert.ok(actual);assert.equal(actual.marks[0].x+actual.marks[0].w,256);assert.equal(actual.marks[0].y+actual.marks[0].h,256);
  assert.deepEqual(normalizePlanetDesign(actual),actual);
});

test('planet native renderer clips, balances canvas state and rejects invalid data before drawing',()=>{
  const calls=[],context=new Proxy({createRadialGradient(){return {addColorStop(){}};}},{get(target,key){return target[key]??((...args)=>calls.push([key,...args]));},set(target,key,value){target[key]=value;return true;}});
  assert.equal(drawPlanetDesign(context,design([brush(),brush({points:[[128,128]]}),shape('rect'),shape('circle'),shape('star')]),0,0,128),true);
  assert.equal(calls[0][0],'save');assert.equal(calls.at(-1)[0],'restore');assert.ok(calls.some(call=>call[0]==='clip'));
  assert.equal(calls.filter(call=>call[0]==='ellipse').length,1);
  const count=calls.length;
  assert.equal(drawPlanetDesign(context,design([],{background:'javascript:evil'}),0,0,128),false);
  assert.equal(drawPlanetDesign(context,design(),0,0,0),false);assert.equal(calls.length,count);
});
