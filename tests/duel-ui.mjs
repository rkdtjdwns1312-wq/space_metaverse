// Targeted standalone visual/keyboard smoke test. No operational server needed.
import assert from 'node:assert/strict';
import express from 'express';
import {createServer} from 'node:http';
import {Server} from 'socket.io';
import {chromium} from 'playwright';
import {mkdir} from 'node:fs/promises';
import {createDuelArcade,registerDuelArcade} from '../server/duel-arcade.js';
import {DUEL_ARCADES} from '../shared/duel-arcade.js';

const room={code:'preview',players:new Map(['a','b'].map(id=>[id,{id,nickname:id==='a'?'별이':'달이',role:'student',connected:false,mapId:'star-street',x:DUEL_ARCADES[0].x,y:DUEL_ARCADES[0].y}]))};
const app=express(),http=createServer(app),io=new Server(http),duel=createDuelArcade({getRoom:()=>room,random:n=>n-1,
  emitPrivate:(_code,id,event,value)=>io.sockets.sockets.get(room.players.get(id)?.socketId)?.emit(event,value)});
// fileURLToPath handles Korean workspace paths without percent-encoded names.
const {fileURLToPath}=await import('node:url');
app.use('/shared',express.static(fileURLToPath(new URL('../shared',import.meta.url))));
app.use(express.static(fileURLToPath(new URL('../client',import.meta.url))));
app.get('/preview',(_req,res)=>res.type('html').send('<!doctype html><html lang="ko"><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/style.css"><link rel="stylesheet" href="/readability.css"><title>두 친구 오락기 검사</title><body><p id="message"></p><script src="/socket.io/socket.io.js"></script><script type="module" src="/preview.js"></script></body></html>'));
app.get('/preview.js',(_req,res)=>res.type('js').send(`import {createDuelArcadeUI} from '/duel-arcade-ui.js';
const id=new URLSearchParams(location.search).get('id'),socket=io({auth:{id}});
const request=async(event,data)=>{const result=await socket.timeout(2000).emitWithAck(event,data);if(!result.ok)throw new Error(result.error);return result;};
window.ui=createDuelArcadeUI({request,stop(){},toast:text=>document.querySelector('#message').textContent=text,getRoom:()=>({players:[{id,mapId:'star-street'}]}),getSelfId:()=>id,socket});
window.socket=socket;window.ready=new Promise(resolve=>socket.on('connect',resolve));`));
io.on('connection',socket=>{
  const player=room.players.get(socket.handshake.auth.id);player.connected=true;player.socketId=socket.id;socket.data.session={room,player};
  const action=(event,handler)=>socket.on(event,(data,ack)=>{try{ack({ok:true,...handler(data)});}catch(error){ack({ok:false,error:error.message});}});
  registerDuelArcade({socket,action,duel});
});
let browser;
try{
  await new Promise(resolve=>http.listen(0,'127.0.0.1',resolve));
  browser=await chromium.launch({headless:true,args:['--no-proxy-server'],...(process.platform==='win32'?{channel:'msedge'}:{})});
  const desktop=await browser.newContext({viewport:{width:1000,height:900}}),mobile=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
  const a=await desktop.newPage(),b=await mobile.newPage(),errors=[];
  for(const page of [a,b])page.on('pageerror',error=>errors.push(error.message));
  await Promise.all([a.goto('http://127.0.0.1:'+http.address().port+'/preview?id=a'),b.goto('http://127.0.0.1:'+http.address().port+'/preview?id=b')]);
  for(const page of [a,b])await page.evaluate(()=>window.ready);
  await a.evaluate(()=>window.ui.open({id:'duel-memory'}));
  await a.getByLabel('카드판 크기').selectOption('5x6');await a.getByRole('button',{name:'달이 초대'}).click();
  await b.getByRole('dialog',{name:'친구의 놀이 초대'}).getByText(/5 × 6 \(15쌍\)/).waitFor();
  await b.getByRole('button',{name:'함께 시작',exact:true}).click();
  await b.locator('.duel-memory .duel-cell').last().waitFor();assert.equal(await b.locator('.duel-memory .duel-cell').count(),30);
  const first=b.locator('[data-duel-cell="0"]');await first.focus();await first.press('Enter');
  await b.locator('[data-duel-cell="0"][aria-label*="공개된"]').waitFor();
  await first.press('ArrowRight');assert.equal(await b.evaluate(()=>document.activeElement.dataset.duelCell),'1');
  const box=await b.locator('.duel-dialog:not(.duel-invitation)').boundingBox();assert(box.x>=0&&box.x+box.width<=391);
  await mkdir('.local/duel-preview',{recursive:true});await b.screenshot({path:'.local/duel-preview/memory-mobile.png'});
  await a.getByRole('button',{name:'다시하기 요청'}).click();await b.getByRole('button',{name:'동의',exact:true}).click();
  assert.equal(await b.locator('.duel-memory .duel-cell').count(),30);
  await a.getByRole('button',{name:'함께 나가기'}).click();await b.getByRole('button',{name:'동의',exact:true}).click();
  for(const p of room.players.values())Object.assign(p,{x:DUEL_ARCADES[1].x,y:DUEL_ARCADES[1].y});
  for(const page of [a,b])await page.evaluate(()=>window.ui.reset());
  await a.evaluate(()=>window.ui.open({id:'duel-omok'}));await a.getByRole('button',{name:'달이 초대'}).click();await b.getByRole('button',{name:'함께 시작',exact:true}).click();
  await b.locator('.duel-omok .duel-cell').last().waitFor();assert.equal(await b.locator('.duel-omok .duel-cell').count(),225);
  for(const [i,index] of [111,113,97,127].entries()){
    const black=b.locator('[data-duel-cell="'+index+'"]');await black.focus();await black.press('Enter');
    await black.locator('xpath=self::*[contains(@aria-label,"흑돌")]').waitFor();
    const white=a.locator('[data-duel-cell="'+i*2+'"]');await white.focus();await white.press('Enter');
    await white.locator('xpath=self::*[contains(@aria-label,"백돌")]').waitFor();
  }
  await b.locator('[data-duel-cell="112"]').focus();await b.locator('[data-duel-cell="112"]').press('Enter');
  await b.getByText('3·3 자리에는 놓을 수 없어요.',{exact:true}).waitFor();
  assert.equal(await b.locator('[data-duel-cell="112"]').getAttribute('aria-label'),'8행 8열 · 빈자리');
  assert.equal(await b.locator('.duel-status').textContent(),'내 차례예요!');
  for(const type of ['black','white']){
    const stone=a.locator('.duel-'+type).first();
    assert.equal(await stone.evaluate(e=>getComputedStyle(e,'::after').content),'"★"');
    assert.equal(await stone.evaluate(e=>getComputedStyle(e,'::before').borderRadius),'50%');
  }
  await b.screenshot({path:'.local/duel-preview/omok-mobile.png'});await a.screenshot({path:'.local/duel-preview/omok-desktop.png'});
  assert.deepEqual(errors,[]);console.log('PASS: mobile/desktop, invitation size, 30 cards, keyboard, bilateral rematch/exit, 225 omok buttons, 3-3 inline warning with unchanged turn; no browser errors.');
}finally{await browser?.close();duel.dispose();await new Promise(resolve=>io.close(resolve));}
