import http from 'node:http';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {extname,join,normalize} from 'node:path';
import {fileURLToPath} from 'node:url';
import {chromium} from 'playwright';

const root=fileURLToPath(new URL('..',import.meta.url));
const html=`<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/client/arcade.css"></head><body>
<main><div id="arcade-board"></div><button id="fixture-close" type="button">게임 창 닫기</button></main>
<script type="module">
import {createDodgeGame} from './client/dodge-game.js';
const calls={requests:[],inputs:[]};let stateListener=()=>{},rankingListener=()=>{},ranking=[];
const initial={runId:'browser-run',status:'running',arenaWidth:600,arenaHeight:420,elapsedMs:0,wave:1,waveCount:2,starSpeed:82,maxActiveStars:120,player:{x:300,y:210,radius:14},stars:[{id:'s1',x:10,y:80,vx:82,vy:0,radius:10}]};
const request=async(event,data)=>{calls.requests.push({event,data});if(event==='dodge:start')return structuredClone(initial);if(event==='dodge:ranking')return {ranking:structuredClone(ranking)};if(event==='dodge:cancel')return {};throw new Error('unexpected '+event)};
const game=createDodgeGame({board:document.querySelector('#arcade-board'),request,sendInput:data=>calls.inputs.push({...data,at:performance.now()}),subscribeState:cb=>{stateListener=cb;return()=>{calls.stateUnsubscribed=true}},subscribeRanking:cb=>{rankingListener=cb;return()=>{calls.rankingUnsubscribed=true}},toast:text=>{calls.toast=text}});
window.fixture={calls,emitState:event=>{if(event.result?.ranking)ranking=structuredClone(event.result.ranking);stateListener(event)},emitRanking:event=>{ranking=structuredClone(event.ranking||[]);rankingListener(event)},destroy:()=>game.destroy()};
document.querySelector('#fixture-close').onclick=()=>game.destroy();
</script></body></html>`;

const server=http.createServer(async(request,response)=>{
  if(request.url==='/'){response.writeHead(200,{'content-type':'text/html; charset=utf-8'});response.end(html);return;}
  let relative=normalize(decodeURIComponent(request.url.split('?')[0]).replace(/^\/+/,''));
  if(relative==='dodge-game.css')relative=join('client','dodge-game.css');
  if(relative.startsWith('..')){response.writeHead(403);response.end();return;}
  try{const body=await readFile(join(root,relative));const type=extname(relative)==='.js'?'text/javascript; charset=utf-8':extname(relative)==='.css'?'text/css; charset=utf-8':'application/octet-stream';response.writeHead(200,{'content-type':type});response.end(body);}
  catch{response.writeHead(404);response.end();}
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));

const browser=await chromium.launch({headless:true,...(process.platform==='win32'?{channel:'msedge'}:{})});let checks=0;const errors=[];
try{
  const context=await browser.newContext({viewport:{width:390,height:844},hasTouch:true,isMobile:true});
  const page=await context.newPage();page.on('pageerror',error=>errors.push(error.message));
  await page.goto(`http://127.0.0.1:${server.address().port}/`);
  await page.locator('#dodge-start').waitFor();
  const check=message=>{checks++;console.log(`✓ ${message}`);};

  assert.equal(await page.locator('#dodge-canvas').getAttribute('width'),'600');assert.equal(await page.locator('#dodge-canvas').getAttribute('height'),'420');
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);assert.equal(await page.locator('#dodge-canvas').evaluate(element=>getComputedStyle(element).touchAction),'none');check('390px 화면에서 600×420 비율 경기장과 조작부 표시');

  assert.equal(await page.locator('#dodge-ranking-panel').isHidden(),true);await page.locator('#dodge-ranking-toggle').click();
  assert.equal(await page.locator('#dodge-ranking-panel').isVisible(),true);assert.match(await page.locator('#dodge-ranking-panel').textContent(),/매주 월요일 0시 새로 시작해요/);
  assert.equal(await page.locator('#dodge-ranking li').count(),1);assert.match(await page.locator('#dodge-ranking').textContent(),/아직 이번 주 기록이 없어요/);
  await page.locator('#dodge-ranking-toggle').click();assert.equal(await page.locator('#dodge-ranking-panel').isHidden(),true);check('시작 옆 랭킹 보기 버튼으로 빈 주간 순위 펼치기·닫기');

  await page.locator('#dodge-start').click();await page.waitForFunction(()=>window.fixture.calls.requests.some(call=>call.event==='dodge:start'));
  assert.equal(await page.locator('#dodge-canvas').evaluate(element=>document.activeElement===element),true);assert.match(await page.locator('#dodge-status').textContent(),/별을 피하세요/);check('실제 모듈 시작 요청과 경기장 초점');

  await page.keyboard.down('ArrowRight');await page.waitForTimeout(125);await page.keyboard.up('ArrowRight');
  const keyboard=await page.evaluate(()=>window.fixture.calls.inputs);assert.ok(keyboard.some(input=>input.x===1&&input.y===0));assert.ok(keyboard.some(input=>input.x===0&&input.y===0));check('방향키 입력과 100ms heartbeat 및 키 해제 정지');

  await page.evaluate(()=>window.fixture.emitState({state:{runId:'browser-run',status:'running',arenaWidth:600,arenaHeight:420,elapsedMs:5100,wave:2,waveCount:3,starSpeed:89,maxActiveStars:120,player:{x:330,y:210,radius:14},stars:[{id:'s1',x:180,y:210,vx:89,vy:0,radius:10}]},finished:false}));
  await page.waitForFunction(()=>document.querySelector('#dodge-stopwatch').textContent.startsWith('5.'));
  const pixel=await page.locator('#dodge-canvas').evaluate(canvas=>Array.from(canvas.getContext('2d').getImageData(330,210,1,1).data));assert.ok(pixel[3]>0);check('서버 state의 단계·소행성·별·스톱워치 렌더링');

  const cdp=await context.newCDPSession(page),box=await page.locator('#dodge-canvas').boundingBox();const center={x:box.x+box.width/2,y:box.y+box.height/2};
  await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{...center,id:1}]});
  await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:center.x+55,y:center.y+5,id:1}]});await page.waitForTimeout(40);
  await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
  const touch=await page.evaluate(()=>window.fixture.calls.inputs.slice(-4));assert.ok(touch.some(input=>input.x>.7));assert.equal(touch.at(-1).x,0);assert.equal(touch.at(-1).y,0);check('모바일 터치 드래그 이동과 손 떼기 정지');

  const pending={runId:'browser-run',status:'pending',arenaWidth:600,arenaHeight:420,elapsedMs:12345,wave:3,waveCount:4,starSpeed:96,maxActiveStars:120,player:{x:330,y:210,radius:14},stars:[{id:'hit',x:330,y:210,vx:96,vy:0,radius:10}]};
  await page.evaluate(state=>window.fixture.emitState({state,finished:true,error:'저장하지 못했어요. 다시 시도할게요.'}),pending);
  await page.locator('#dodge-status').filter({hasText:'기록 저장을 다시 시도하고 있어요'}).waitFor();assert.equal(await page.locator('#dodge-start').isDisabled(),true);assert.doesNotMatch(await page.locator('#dodge-status').textContent(),/이번 주 \d+위/);
  await page.evaluate(state=>window.fixture.emitState({state,finished:true,result:{elapsedMs:12345,rank:2,ranking:[{id:'browser-run',playerId:'student',nickname:'별이',elapsedMs:12345,at:Date.now(),rank:2}]}}),pending);
  await page.locator('#dodge-status').filter({hasText:'이번 주 2위'}).waitFor();assert.equal(await page.locator('#dodge-start').isEnabled(),true);
  await page.locator('#dodge-ranking-toggle').click();assert.match(await page.locator('#dodge-ranking').textContent(),/별이 · 12.35초/);check('충돌 뒤 저장 실패 대기·재시도 성공·서버 확정 생존시간·주간 순위 반영');

  await page.locator('#dodge-start').click();await page.waitForFunction(()=>window.fixture.calls.requests.filter(call=>call.event==='dodge:start').length===2);
  await page.locator('#fixture-close').click();await page.waitForFunction(()=>window.fixture.calls.requests.some(call=>call.event==='dodge:cancel'));
  assert.equal(await page.locator('.dodge-game').count(),0);const count=await page.evaluate(()=>window.fixture.calls.inputs.length);await page.waitForTimeout(240);assert.equal(await page.evaluate(()=>window.fixture.calls.inputs.length),count);
  const cleanup=await page.evaluate(()=>window.fixture.calls);assert.equal(cleanup.stateUnsubscribed,true);assert.equal(cleanup.rankingUnsubscribed,true);check('게임 창 닫기 시 cancel·RAF·heartbeat·구독 정리');

  assert.deepEqual(errors,[]);console.log(`verify-dodge: ${checks}개 실제 브라우저 검사 통과`);
}finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
