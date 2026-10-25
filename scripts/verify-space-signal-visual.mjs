import assert from 'node:assert/strict';
import http from 'node:http';
import {readFile,mkdir} from 'node:fs/promises';
import {extname,join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {chromium} from 'playwright';

const root=fileURLToPath(new URL('..',import.meta.url));
const html='<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><link rel="stylesheet" href="/client/arcade.css"></head><body><script type="module">import {createArcadeUI} from "/client/arcade-ui.js";window.arcade=createArcadeUI({request:async event=>event==="signal:start"?{runId:"visual",round:1,lives:3,sequence:[0,1,2,3]}:{round:1,lives:3,correct:true}});window.arcade.open("signal");</script></body></html>';
const types={'.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8'};
const server=http.createServer(async(request,response)=>{
  if(request.url==='/'){response.writeHead(200,{'content-type':'text/html; charset=utf-8'});response.end(html);return;}
  try{const body=await readFile(join(root,decodeURIComponent(request.url.slice(1))));response.writeHead(200,{'content-type':types[extname(request.url)]??'application/octet-stream'});response.end(body);}
  catch{response.writeHead(404);response.end();}
});
await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve);});
const browser=await chromium.launch({headless:true,...(process.platform==='win32'?{channel:'msedge'}:{})});
try{
  await mkdir('.local',{recursive:true});
  for(const width of [320,390,768]){
    const page=await browser.newPage({viewport:{width,height:844}}),errors=[];
    page.on('pageerror',error=>errors.push(error.message));
    await page.clock.install();
    await page.goto(`http://127.0.0.1:${server.address().port}/`);
    const cards=page.locator('.space-signal-cell');
    await cards.first().waitFor();
    assert.equal(await cards.count(),4);
    assert.deepEqual(await cards.locator('.space-signal-name').allTextContents(),['달','별','보석','태양']);
    assert.equal(await cards.locator('svg').count(),4);
    assert.deepEqual(await cards.evaluateAll(nodes=>nodes.map(node=>node.getAttribute('aria-label'))),['1번 달','2번 별','3번 보석','4번 태양']);
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`${width}px 가로 넘침`);
    await page.screenshot({path:`.local/space-signal-${width}.png`});
    await page.getByRole('button',{name:'우주 신호 시작하기'}).click();
    await page.clock.runFor(650);
    assert.equal(await cards.first().evaluate(node=>node.classList.contains('lit')),true);
    await page.screenshot({path:`.local/space-signal-lit-${width}.png`});
    assert.deepEqual(errors,[]);
    await page.close();
  }
  console.log('우주 신호 320/390/768px 카드·이름·접근성·점등·넘침 검사 통과');
}finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
