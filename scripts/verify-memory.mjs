import assert from 'node:assert/strict';
import http from 'node:http';
import {readFile} from 'node:fs/promises';
import {extname,join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {chromium} from 'playwright';

const root=fileURLToPath(new URL('..',import.meta.url));
const html=`<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><link rel="stylesheet" href="/client/arcade.css"><style>body{margin:0}</style></head><body><script type="module">import {createArcadeUI} from '/client/arcade-ui.js';window.toasts=[];window.arcade=createArcadeUI({toast:text=>window.toasts.push(text),request:async()=>({ranking:[]}),subscribeStarRanking:()=>()=>{},sendDodgeInput:()=>{},subscribeDodgeState:()=>()=>{},subscribeDodgeRanking:()=>()=>{}});window.arcade.open('memory');</script></body></html>`;
const types={'.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8'};
const server=http.createServer(async(request,response)=>{
  if(request.url==='/'){response.writeHead(200,{'content-type':'text/html; charset=utf-8'});response.end(html);return;}
  try{const path=join(root,decodeURIComponent(request.url.slice(1)));const body=await readFile(path);response.writeHead(200,{'content-type':types[extname(path)]??'application/octet-stream'});response.end(body);}catch{response.writeHead(404);response.end();}
});
await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve);});

const browser=await chromium.launch({headless:true,...(process.platform==='win32'?{channel:'msedge'}:{})});
const context=await browser.newContext({viewport:{width:390,height:844}});context.setDefaultTimeout(5000);
const page=await context.newPage(),errors=[],checks=[];
page.on('pageerror',error=>errors.push(error.message));
const check=message=>{checks.push(message);console.log(`Memory ${checks.length}: ${message}`);};
const start=async name=>{await page.getByRole('button',{name}).click();await page.getByRole('button',{name:/^(시작|다시 시작|처음부터 다시)$/}).click();};
const gridInfo=()=>page.locator('.memory-grid').evaluate(grid=>({
  rows:Number(grid.dataset.rows),columns:Number(grid.dataset.columns),
  renderedRows:getComputedStyle(grid).gridTemplateRows.split(' ').length,
  renderedColumns:getComputedStyle(grid).gridTemplateColumns.split(' ').length,
  symbols:[...grid.querySelectorAll('.memory-card')].map(card=>card.dataset.symbol)
}));

try{
  await page.addInitScript(()=>{Math.random=()=>0;});
  await page.clock.install({time:Date.now()});
  await page.goto(`http://127.0.0.1:${server.address().port}/`,{waitUntil:'domcontentloaded',timeout:15000});
  await page.waitForFunction(()=>window.arcade&&document.querySelector('#arcade-dialog')?.open);

  const levels=page.locator('.memory-level');
  assert.equal(await levels.count(),3);assert.deepEqual(await levels.evaluateAll(buttons=>buttons.map(button=>button.getAttribute('aria-pressed'))),['false','false','false']);
  assert.equal(await page.locator('.memory-start').isDisabled(),true);

  for(const [name,rows,columns] of [['하 (3행 4열)',3,4],['중 (4행 6열)',4,6],['상 (6행 6열)',6,6]]){
    await start(name);const info=await gridInfo();
    assert.deepEqual([info.rows,info.columns,info.renderedRows,info.renderedColumns],[rows,columns,rows,columns]);
    assert.equal(info.symbols.length,rows*columns);const counts=new Map();for(const symbol of info.symbols)counts.set(symbol,(counts.get(symbol)??0)+1);
    assert.equal(counts.size,rows*columns/2);assert.ok([...counts.values()].every(count=>count===2));
    assert.equal(await page.locator('.memory-level[aria-pressed="true"]').count(),1);check(`${name}: 정확한 ${rows}×${columns} 격자와 서로 다른 그림 짝`);
  }

  const overflow=await page.evaluate(()=>{const grid=document.querySelector('.memory-grid'),dialog=document.querySelector('#arcade-dialog'),last=document.querySelector('.memory-card:last-child');return {document:document.documentElement.scrollWidth<=innerWidth,grid:grid.scrollWidth<=grid.clientWidth,last:last.getBoundingClientRect().right<=grid.getBoundingClientRect().right+.5,dialog:dialog.getBoundingClientRect().right<=innerWidth};});
  assert.deepEqual(overflow,{document:true,grid:true,last:true,dialog:true});check('390px 화면의 6열 카드와 대화상자 가로 넘침 없음');

  await start('하 (3행 4열)');
  const pair=await page.locator('.memory-card').evaluateAll(cards=>{const first=cards[0];return [0,cards.findIndex((card,index)=>index>0&&card.dataset.symbol===first.dataset.symbol)];});
  await page.locator('.memory-card').nth(pair[0]).click();await page.locator('.memory-card').nth(pair[1]).click();
  await page.locator('#arcade-score').filter({hasText:'1쌍 / 6쌍'}).waitFor();check('짝을 찾은 직후 점수 즉시 갱신');

  const cards=page.locator('.memory-card'),symbols=await cards.evaluateAll(items=>items.map(item=>item.dataset.symbol));
  const groups=new Map();symbols.forEach((symbol,index)=>groups.set(symbol,[...(groups.get(symbol)??[]),index]));
  for(const indices of groups.values()){
    if(indices.includes(pair[0]))continue;
    await cards.nth(indices[0]).click();await cards.nth(indices[1]).click();
  }
  await page.locator('#arcade-score').filter({hasText:/^성공 · 6쌍 \/ 6쌍/}).waitFor();
  assert.ok((await page.evaluate(()=>window.toasts)).includes('짝을 모두 찾았어요!'));check('60초 마감 전에 마지막 짝을 누르면 승리');

  await page.getByRole('button',{name:'다시 시작'}).click();await page.clock.fastForward('01:00');
  await page.locator('#arcade-score').filter({hasText:/^실패 · 0쌍 \/ 6쌍 · 남은 시간 0초$/}).waitFor();
  const before=await page.locator('.memory-card').first().getAttribute('data-state');await page.locator('.memory-card').first().click({force:true});assert.equal(await page.locator('.memory-card').first().getAttribute('data-state'),before);check('정확히 60초에 패배하고 마감 뒤 카드 클릭 차단');

  await page.getByRole('button',{name:'다시 시작'}).click();const toastCount=await page.evaluate(()=>window.toasts.length);
  await page.locator('#arcade-restart').click();const scoreBefore=await page.locator('#arcade-score').textContent();await page.clock.fastForward('01:01');
  assert.equal(await page.locator('#arcade-score').textContent(),scoreBefore);assert.equal(await page.evaluate(()=>window.toasts.length),toastCount);assert.equal(await page.locator('.memory-game').count(),1);
  await start('하 (3행 4열)');const closeToastCount=await page.evaluate(()=>window.toasts.length);await page.locator('#arcade-close').click();await page.clock.fastForward('01:01');
  assert.equal(await page.locator('#arcade-board').locator('button').count(),0);assert.equal(await page.evaluate(()=>window.toasts.length),closeToastCount);check('실제 다시하기·닫기 뒤 타이머와 게임 모듈 중복 없이 정리');

  assert.deepEqual(errors,[]);assert.equal(checks.length,8);console.log(`verify-memory: ${checks.length}개 통과, errors=[]`);
}finally{
  await browser.close();await new Promise(resolve=>server.close(resolve));
}
