import assert from 'node:assert/strict';
import http from 'node:http';
import {readFile,mkdir} from 'node:fs/promises';
import {extname,join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {chromium} from 'playwright';

const root=fileURLToPath(new URL('..',import.meta.url));
const html='<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><link rel="stylesheet" href="/client/arcade.css"></head><body><script type="module">import {createArcadeUI} from "/client/arcade-ui.js";const board=Array.from({length:20},()=>Array(10).fill(0));const state={runId:"visual",board,current:{type:0,x:3,y:0,cells:[[0,0],[1,0],[2,0],[3,0]]},lines:0,speedMs:850,elapsedMs:0};window.moves=[];window.arcade=createArcadeUI({request:async(event,data)=>{if(event==="tetris:move")window.moves.push(data.move);return state}});window.arcade.open("tetris");</script></body></html>';
const types={'.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8'};
const server=http.createServer(async(request,response)=>{
  if(request.url==='/'){response.writeHead(200,{'content-type':'text/html; charset=utf-8'});response.end(html);return;}
  try{const body=await readFile(join(root,decodeURIComponent(request.url.slice(1))));response.writeHead(200,{'content-type':types[extname(request.url)]??'application/octet-stream'});response.end(body);}
  catch{response.writeHead(404);response.end();}
});
await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve);});
const browser=await chromium.launch({headless:true,...(process.platform==='win32'?{channel:'chrome',args:['--no-proxy-server']}:{})});
try{
  await mkdir('.local',{recursive:true});
  for(const width of [390,768]){
    const page=await browser.newPage({viewport:{width,height:844}}),errors=[];
    page.on('pageerror',error=>errors.push(error.message));
    await page.route('**/*',async route=>{
      const pathname=new URL(route.request().url()).pathname;
      if(pathname==='/'){await route.fulfill({status:200,contentType:'text/html; charset=utf-8',body:html});return;}
      try{await route.fulfill({status:200,contentType:types[extname(pathname)]??'application/octet-stream',
        body:await readFile(join(root,decodeURIComponent(pathname.slice(1))))});}
      catch{await route.fulfill({status:404,body:'not found'});}
    });
    await page.goto(`http://127.0.0.1:${server.address().port}/`,{waitUntil:'domcontentloaded',timeout:25000});
    await page.getByRole('button',{name:'별 테트리스 시작'}).click();
    const controls=page.locator('.tetris-control');
    assert.equal(await controls.count(),4);
    assert.deepEqual(await controls.locator('kbd').allTextContents(),['←','A','F','↑','→','D','S','↓']);
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`${width}px 가로 넘침`);
    await page.screenshot({path:`.local/tetris-controls-${width}.png`});
    await page.keyboard.press('s');
    await page.getByRole('button',{name:'도형 빨리 내리기'}).click();
    assert.deepEqual(await page.evaluate(()=>window.moves),['down','down']);
    assert.deepEqual(errors,[]);
    await page.close();
  }
  console.log('별 테트리스 390/768px 키캡·키보드·버튼·넘침 검사 통과');
}finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
