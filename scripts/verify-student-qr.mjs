import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { chromium } from 'playwright';

const origin='https://classroom-qr.test';
const studentUrl='https://public.example/?class=ABC123';
const ids=['student-setup-fields','legacy-names-fields','account-result','credentials-text','password-offer-dialog','password-dialog','student-qr-dialog'];
const inputs=['allowed-names','join-code','nickname','account-target','account-name','account-pin','password-new','password-current','password-confirm','password-error','pin-help','names-help'];
const buttons=['account-save','account-add','credentials-download','password-offer-no','password-offer-yes','my-password','password-save','copy-student-link','copy-student-qr','student-qr-copy','student-qr-download'];
const fixture=`<!doctype html><meta charset="utf-8"><label for="join-code"></label><label for="nickname"></label>
  ${ids.map(id=>id==='student-qr-dialog'?`<dialog id="${id}"><canvas id="student-qr-canvas"></canvas><p id="student-qr-link"></p></dialog>`:`<div id="${id}"></div>`).join('')}
  ${inputs.map(id=>`<input id="${id}">`).join('')}${buttons.map(id=>`<button id="${id}">${id}</button>`).join('')}
  <form id="password-form"></form><script type="module" src="/fixture.js"></script>`;
const fixtureScript=`import {createAccountsUI} from '/accounts-ui.js';
  window.testLink='${studentUrl}';window.toasts=[];
  const ui=createAccountsUI({getRoom:()=>({players:[{id:'teacher-1',role:'teacher'}]}),getSelfId:()=> 'teacher-1',
    request:async()=>{await new Promise(resolve=>setTimeout(resolve,120));return {url:window.testLink};},
    toast:value=>window.toasts.push(value),saveToken:()=>{}});
  await ui.ready;window.fixtureReady=true;`;
const browser=await chromium.launch({channel:'msedge',headless:true});
try{
  const context=await browser.newContext();
  await context.grantPermissions(['clipboard-read','clipboard-write'],{origin});
  const page=await context.newPage();
  await page.route(`${origin}/**`,route=>{
    const path=new URL(route.request().url()).pathname;
    if(path==='/')return route.fulfill({status:200,contentType:'text/html',body:fixture});
    if(path==='/fixture.js')return route.fulfill({status:200,contentType:'application/javascript',body:fixtureScript});
    if(path==='/api/public-config')return route.fulfill({status:200,contentType:'application/json',body:'{"managedAccounts":false}'});
    if(['/accounts-ui.js','/student-qr.js','/vendor/qrcode.mjs'].includes(path))return route.fulfill({status:200,contentType:'application/javascript',body:readFileSync(resolve('client',path.slice(1)))});
    return route.fulfill({status:404,body:'Not found'});
  });
  await page.goto(origin);
  await page.waitForFunction(()=>window.fixtureReady);
  await page.evaluate(()=>{
    const menu=document.createElement('dialog');menu.id='menu-dialog';
    menu.append(document.querySelector('#copy-student-link'),document.querySelector('#copy-student-qr'));
    document.body.append(menu);menu.showModal();
  });
  await page.locator('#copy-student-link').click();
  await page.waitForFunction(()=>window.toasts.includes('학생 입장 링크를 복사했어요.'));
  assert.equal(await page.evaluate(()=>navigator.clipboard.readText()),studentUrl);
  await page.locator('#copy-student-qr').click();
  await page.locator('#student-qr-dialog').waitFor({state:'visible'});
  assert.equal(await page.locator('#student-qr-link').textContent(),studentUrl);
  assert.ok(await page.locator('#student-qr-canvas').evaluate(canvas=>canvas.width>200&&canvas.height===canvas.width));
  await page.waitForFunction(()=>window.toasts.includes('학생 입장 QR 코드를 복사했어요.'));
  const imageBytes=await page.evaluate(async()=>{
    const item=(await navigator.clipboard.read())[0];
    return (await item.getType('image/png')).size;
  });
  assert.ok(imageBytes>1000);
  const decoded=await page.evaluate(async()=>{
    if(!('BarcodeDetector' in window))return null;
    const detector=new BarcodeDetector({formats:['qr_code']});
    const results=await detector.detect(document.querySelector('#student-qr-canvas'));
    return results[0]?.rawValue||'';
  });
  if(decoded!==null)assert.equal(decoded,studentUrl);

  await page.locator('#student-qr-dialog').evaluate(dialog=>dialog.close());
  await page.evaluate(()=>{window.testLink='http://127.0.0.1:3000/?class=ABC123';});
  await page.locator('#copy-student-qr').click();
  await page.waitForFunction(()=>window.toasts.some(message=>message.includes('외부 접속 주소')));
  assert.equal(await page.locator('#student-qr-dialog').evaluate(dialog=>dialog.open),false);
  assert.ok(await page.evaluate(()=>window.toasts.some(message=>message.includes('외부 접속 주소'))));
  console.log(JSON.stringify({qrCopied:true,pngBytes:imageBytes,scanApiAvailable:decoded!==null,scanMatches:decoded===null?null:decoded===studentUrl,localLinkBlocked:true}));
}finally{await browser.close();}
