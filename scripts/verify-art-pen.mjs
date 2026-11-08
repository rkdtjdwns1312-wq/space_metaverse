import assert from 'node:assert/strict';
import {readFileSync,mkdirSync} from 'node:fs';
import {chromium} from 'playwright';
import {createClassroomServer} from '../server/app.js';
const game=createClassroomServer({teacherKey:'isolated-pen-check',studentHours:false}),{port}=await game.listen();
const origin='http://127.0.0.1:'+port,css=readFileSync('client/index.html','utf8').match(/<link[^>]*rel="stylesheet"[^>]*>/g).join('');
const browser=await chromium.launch({headless:true,...(process.platform==='win32'?{channel:'msedge'}:{}),args:['--no-proxy-server']});
mkdirSync('.local/art-pen',{recursive:true});
try{
 const page=await browser.newPage({viewport:{width:1024,height:768},hasTouch:true}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/__art_test__',r=>r.fulfill({contentType:'text/html',body:`<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1">${css}<body class="joined"></body>`}));
 await page.goto(origin+'/__art_test__');
 await page.evaluate(async()=>{
  const {createArtStudioUI}=await import('/art-studio-ui.js');window.saved=[];
  window.art=createArtStudioUI({stop:()=>{},getPlayer:()=>({id:'test-student',role:'student'}),request:async(name,data)=>{
   if(name==='art:list')return {ownerId:'test-student',roster:[],works:[]};
   if(name==='art:save'){window.saved.push(structuredClone(data));return {work:{...data,id:'test-art',revision:window.saved.length}};}throw Error(name);
  }});await window.art.open();
 });
 const field=name=>page.locator(`#art-studio-dialog [data-art="${name}"]`),canvas=field('canvas');
 await page.locator('[data-art-tab=mine]').click();await field('color').fill('#ff0000');await field('width').fill('18');
 const cdp=await page.context().newCDPSession(page);
 const position=async(x,y)=>{const b=await canvas.boundingBox();return {x:b.x+b.width*x/600,y:b.y+b.height*y/400};};
 const pen=async(type,x,y)=>{const p=await position(x,y);await cdp.send('Input.dispatchMouseEvent',{type,...p,button:type==='mouseMoved'?'none':'left',buttons:type==='mouseReleased'?0:1,pointerType:'pen',force:type==='mouseReleased'?0:.5,clickCount:type==='mouseMoved'?0:1});};
 const frame=()=>page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
 const pixel=(x,y)=>canvas.evaluate((c,p)=>[...c.getContext('2d').getImageData(...p,1,1).data],[x,y]);
 const clear=async()=>{if(!await field('clear').isDisabled()){page.once('dialog',d=>d.accept());await field('clear').click();await frame();}};
 await canvas.scrollIntoViewIfNeeded();
 // A non-active palm loses capture while a real pen is still drawing.
 await pen('mousePressed',160,200);await pen('mouseMoved',260,200);
 await canvas.evaluate(c=>c.dispatchEvent(new PointerEvent('lostpointercapture',{pointerId:999,pointerType:'touch',bubbles:true})));
 await pen('mouseMoved',440,200);await pen('mouseReleased',440,200);await frame();
 assert.deepEqual(await pixel(350,200),[255,0,0,255],'palm capture loss must not erase/cancel the pen stroke across the center');
 await field('title').fill('펜 검사');await field('save').click();await page.waitForFunction(()=>window.saved.length===1);
 assert.equal(await page.evaluate(()=>window.saved[0].drawing.strokes.length),1);
 console.log('PASS unrelated palm capture loss preserves pen and saved stroke');
 // A real touch starts before the pen; only the unfinished palm trace is discarded.
 await clear();await canvas.scrollIntoViewIfNeeded();const palm=await position(80,320);
 await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{...palm,id:5,radiusX:20,radiusY:20}]});
 await pen('mousePressed',120,200);await pen('mouseMoved',300,200);
 await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
 await pen('mouseMoved',480,200);await pen('mouseReleased',480,200);await frame();
 assert.deepEqual(await pixel(350,200),[255,0,0,255]);assert.deepEqual(await pixel(80,320),[255,255,255,255]);
 console.log('PASS real touch before pen yields to pen; palm release does not interrupt');
 for(const [width,height]of [[1024,768],[768,1024]]){
  await clear();await page.setViewportSize({width,height});await canvas.scrollIntoViewIfNeeded();
  for(const y of [70,200,330])for(const x of [80,300,520]){
   const target=await position(x,y);assert(await page.evaluate(p=>document.elementFromPoint(p.x,p.y)?.matches('[data-art=canvas]'),target),'canvas center/edges cannot be covered by another element');
   await pen('mousePressed',x-15,y);await pen('mouseMoved',x+15,y);await pen('mouseReleased',x+15,y);await frame();assert.deepEqual(await pixel(x,y),[255,0,0,255]);
  }
  const selection=await canvas.evaluate(c=>({select:getComputedStyle(c).webkitUserSelect||getComputedStyle(c).userSelect,tap:getComputedStyle(c).webkitTapHighlightColor,selection:!window.getSelection()?.isCollapsed,
   nativeAllowed:['selectstart','dragstart','contextmenu'].map(name=>c.dispatchEvent(new Event(name,{cancelable:true,bubbles:true})))}));
  assert.equal(selection.select,'none');assert.equal(selection.tap,'rgba(0, 0, 0, 0)');assert.equal(selection.selection,false);assert.deepEqual(selection.nativeAllowed,[false,false,false]);
  await page.screenshot({path:`.local/art-pen/tablet-${width}.png`});
 }
 await field('title').fill('제목 편집 가능');await field('title').evaluate(e=>{e.focus();e.select();});assert.equal(await field('title').evaluate(e=>e.selectionEnd-e.selectionStart),8);
 // Own cancellation must still discard a partial line and permit the next stroke.
 await clear();await canvas.scrollIntoViewIfNeeded();await pen('mousePressed',60,120);
 await canvas.evaluate(c=>{c.addEventListener('pointermove',e=>c.dispatchEvent(new PointerEvent('pointercancel',{pointerId:e.pointerId,pointerType:'pen'})),{once:true});});
 await pen('mouseMoved',150,120);await pen('mouseReleased',150,120);await frame();assert.deepEqual(await pixel(100,120),[255,255,255,255]);
 const p=await position(300,200);await page.touchscreen.tap(p.x,p.y);await frame();assert.deepEqual(await pixel(300,200),[255,0,0,255]);
 await field('title').fill('수정 후 펜');await field('save').click();await page.waitForFunction(()=>window.saved.length===2);assert.equal(await page.evaluate(()=>window.saved[1].drawing.strokes.length),1);
 assert.deepEqual(errors,[]);console.log('PASS center/edges pen input both tablet orientations, selection guard, title editing, active cancellation, finger input, save, errors0. Emulated pen/touch, not physical iPad.');
}finally{await browser.close();await game.close();}
