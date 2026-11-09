import test,{before,after} from 'node:test';
import assert from 'node:assert/strict';
import {mapImage,startMapImage,mapImageReady,decodeMapImages} from '../client/map-image.js';

class TestImage{
  static failures=0;
  constructor(){this.failures=TestImage.failures;this.urls=[];this.complete=false;this.naturalWidth=0;this.decodes=0;}
  set src(value){this.urls.push(value);this.complete=false;this.naturalWidth=0;}
  get src(){return this.urls.at(-1);}
  async decode(){this.decodes++;this.complete=true;if(this.failures-->0)throw Error('temporary image failure');this.naturalWidth=100;this.onload?.();}
}
const originalImage=globalThis.Image;
before(()=>{globalThis.Image=TestImage;});
after(()=>{if(originalImage===undefined)delete globalThis.Image;else globalThis.Image=originalImage;});

test('map images defer loading and share successful decode work',async t=>{
  TestImage.failures=0;let loaded=0;
  const image=mapImage('/example.png',()=>loaded++);
  assert.equal(image.urls.length,0);
  startMapImage(image);startMapImage(image);
  await Promise.all([decodeMapImages([image]),decodeMapImages([image])]);
  assert.deepEqual(image.urls,['/example.png']);assert.equal(image.decodes,1);assert.equal(loaded,1);assert.equal(mapImageReady(image),true);
});

test('one failed load recovers once for concurrent renderer and preload callers',async t=>{
  TestImage.failures=1;const image=mapImage('/example.png?v=2#part');
  await Promise.all([decodeMapImages([image]),decodeMapImages([image])]);
  assert.deepEqual(image.urls,['/example.png?v=2#part','/example.png?v=2&mapRetry=1#part']);
  assert.equal(image.decodes,2);assert.equal(mapImageReady(image),true);
});

test('permanent failure stops after three attempts even across repeated frames',async t=>{
  TestImage.failures=100;const image=mapImage('/missing.png');
  await assert.rejects(decodeMapImages([image]),/temporary/);
  for(let frame=0;frame<100;frame++)assert.equal(mapImageReady(image),false);
  await assert.rejects(decodeMapImages([image]),/temporary/);
  assert.equal(image.urls.length,3);assert.equal(image.decodes,3);
});

test('a failed image first noticed during drawing also recovers',async t=>{
  TestImage.failures=1;const image=mapImage('/draw-only.png');startMapImage(image);image.complete=true;
  assert.equal(mapImageReady(image),false);
  await decodeMapImages([image]);assert.equal(mapImageReady(image),true);assert.equal(image.urls.length,2);
});
