import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import express from 'express';
const app=express();app.use(express.static('client'));
const server=app.listen(0,'127.0.0.1');await new Promise(resolve=>server.once('listening',resolve));
const browser=await chromium.launch({headless:true,...(process.platform==='win32'?{channel:'msedge'}:{})});
try{
 const page=await browser.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://127.0.0.1:'+server.address().port+'/dialog-layout.css');
 await page.setContent('<link rel="stylesheet" href="/dialog-layout.css"><style>dialog{box-sizing:border-box;width:min(600px,calc(100vw - 24px));height:400px;max-height:80vh;overflow:auto;padding:20px}section{padding:0} .long{height:1500px}header{display:flex;justify-content:space-between}</style>');
 await page.evaluate(async()=>{
  const {installDialogCloseControls,pinDialogHeader}=await import('/dialog-layout.js');installDialogCloseControls();window.pin=pinDialogHeader;
  window.make=(kind)=>{
   const d=document.createElement('dialog');d.id='test';
   d.innerHTML=kind==='confirm'?'<h2>Confirm</h2><button id="yes">예</button><button id="no">아니오</button><div class="long"></div>':'<header><h2>Editor</h2></header><section id="owned"><div class="long"></div><button id="real" type="button">닫기</button></section>';
   document.body.append(d);window.closed=0;window.confirmed=0;window.cancelled=0;
   if(kind==='confirm'){d.querySelector('#yes').onclick=()=>window.confirmed++;d.addEventListener('cancel',()=>window.cancelled++);}
   else {const button=d.querySelector('#real');button.onclick=()=>{window.closed++;if(!window.dirty)d.close();};if(kind==='pinned')window.pin(d);}
   d.showModal();return d;
  };
 });
 for(const size of [[1280,900],[390,844],[320,740],[844,390]]){
  await page.setViewportSize({width:size[0],height:size[1]});
  for(const kind of ['nested','pinned','confirm']){
   await page.evaluate(kind=>window.make(kind),kind);await page.locator('.dialog-pinned-close').waitFor();
   const before=await page.locator('.dialog-pinned-close').boundingBox();
   await page.evaluate(()=>{const d=document.querySelector('dialog');d.scrollTop=1000;const body=d.querySelector('.dialog-scroll-body');if(body)body.scrollTop=1000;});
   await page.waitForTimeout(50);
   const after=await page.locator('.dialog-pinned-close').boundingBox();assert(Math.abs(after.y-before.y)<2,'close remains fixed while scrolling');
   assert(after.x>=0&&after.x+after.width<=size[0]&&after.y>=0&&after.y+after.height<=size[1]);
   assert(await page.locator('.dialog-pinned-close').evaluate(e=>{const r=e.getBoundingClientRect();return document.elementFromPoint(r.x+r.width/2,r.y+r.height/2)===e;}),'close is not clipped or covered');
   if(kind!=='confirm'){
    assert(await page.locator('#real').evaluate(e=>e.parentElement.id==='owned'),'original selector scope retained');
    await page.evaluate(()=>window.dirty=true);await page.locator('.dialog-pinned-close').click();assert(await page.locator('dialog').evaluate(d=>d.open),'unsaved guard preserved');
    await page.evaluate(()=>window.dirty=false);
   }
   await page.locator('.dialog-pinned-close').click();assert.equal(await page.locator('dialog').evaluate(d=>d.open),false);
   if(kind==='confirm')assert.deepEqual(await page.evaluate(()=>[window.confirmed,window.cancelled]),[0,1]);
   await page.locator('dialog').evaluate(d=>d.remove());
  }
 }
 // Prevented cancellation must stay prevented, including keyboard activation.
 await page.evaluate(()=>{const d=window.make('confirm');d.addEventListener('cancel',e=>e.preventDefault());});
 await page.locator('.dialog-pinned-close').focus();await page.keyboard.press('Enter');assert(await page.locator('dialog').evaluate(d=>d.open));
 await page.locator('dialog').evaluate(d=>d.remove());
 // Replaced contents are rediscovered without moving the new original button.
 await page.evaluate(()=>window.make('nested'));await page.locator('.dialog-pinned-close').waitFor();
 await page.locator('#owned').evaluate(s=>{s.innerHTML='<button id="replacement">닫기</button>';s.firstChild.onclick=()=>s.closest('dialog').close();});
 await page.locator('#replacement.dialog-pinned-close').waitFor();await page.locator('#replacement').click();
 assert.deepEqual(errors,[]);console.log('PASS fixed close: 4 viewports × nested/pinned/confirmation; scrolling, clickability, unsaved guard, cancel veto, replacement and original scope');
}finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
