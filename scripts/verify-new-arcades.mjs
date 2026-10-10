import assert from 'node:assert/strict';
import http from 'node:http';
import {readFile,mkdir} from 'node:fs/promises';
import {extname,join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {chromium} from 'playwright';

const root=fileURLToPath(new URL('..',import.meta.url));
const html='<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><link rel="stylesheet" href="/client/arcade.css"></head><body><script type="module">import {createArcadeUI} from "/client/arcade-ui.js";window.arcade=createArcadeUI();window.arcade.open("path");</script></body></html>';
const types={'.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8'};
const server=http.createServer(async(request,response)=>{
  if(request.url==='/'){response.writeHead(200,{'content-type':'text/html; charset=utf-8'});response.end(html);return;}
  try{const path=join(root,decodeURIComponent(request.url.slice(1))),body=await readFile(path);response.writeHead(200,{'content-type':types[extname(path)]??'application/octet-stream'});response.end(body);}
  catch{response.writeHead(404);response.end();}
});
await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve);});
const browser=await chromium.launch({headless:true,...(process.platform==='win32'?{channel:'msedge'}:{})});
const errors=[];
try{
  const page=await browser.newPage({viewport:{width:390,height:844}});
  page.on('pageerror',error=>errors.push(error.message));
  await page.addInitScript(()=>{Math.random=()=>0;});
  await page.clock.install();
  await page.goto(`http://127.0.0.1:${server.address().port}/`);
  await page.locator('.star-path-game').waitFor();
  await mkdir('.local',{recursive:true});await page.screenshot({path:'.local/new-arcade-path-390.png'});
  await page.getByRole('button',{name:'별길 시작하기'}).click();
  assert.equal(await page.locator('.star-path-cell').count(),25);
  await page.locator('[data-cell="4"]').click();
  assert.match(await page.locator('#arcade-score').textContent(),/바로 옆 칸/);
  await page.locator('[data-cell="21"]').focus();
  await page.keyboard.press('Enter');
  assert.equal(await page.evaluate(()=>document.activeElement?.dataset.cell),'21','키보드로 칸을 고른 뒤에도 같은 칸에 초점이 남아야 해요.');
  await page.locator('[data-cell="20"]').focus();
  await page.keyboard.press('Enter');
  assert.equal(await page.evaluate(()=>document.activeElement?.dataset.cell),'20','되돌린 뒤에도 키보드 초점이 유지돼야 해요.');
  const routes=[[21,22,17,12,13,14,9,4],[19,14,13,12,11,10,5,0],[21,22,23,24,19,14,13,12,11,10,5,0,1,2,3,4]];
  for(const [index,route] of routes.entries()){
    for(const cell of route)await page.locator(`[data-cell="${cell}"]`).click();
    if(index<2)await page.clock.runFor(760);
  }
  assert.match(await page.locator('#arcade-score').textContent(),/성공! 별길 3개 완성/);
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  await page.evaluate(()=>window.arcade.open('signal'));
  await page.locator('.space-signal-game').waitFor();
  await page.screenshot({path:'.local/new-arcade-signal-390.png'});
  await page.getByRole('button',{name:'우주 신호 시작하기'}).click();
  await page.clock.runFor(650);
  assert.match(await page.locator('.space-signal-cue').textContent(),/1번째 신호: 달/,'순서가 글자로도 안내돼야 해요.');
  for(let count=2;count<=7;count++){
    await page.clock.runFor(10000);
    for(let i=0;i<count;i++)await page.locator('[data-signal="0"]').click();
  }
  assert.match(await page.locator('#arcade-score').textContent(),/성공! 우주 신호 6단계 완성/);
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  await page.locator('#arcade-close').click();
  await page.clock.runFor(10000);
  assert.equal(await page.locator('#arcade-board button').count(),0);
  assert.deepEqual(errors,[]);
  console.log('새 오락기 2종: 390px 경로·순서·완료·닫기 검사 통과');
}finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
