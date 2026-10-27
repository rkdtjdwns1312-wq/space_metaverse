// Isolated editor smoke test: no classroom, credentials or production data needed.
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile,mkdir} from 'node:fs/promises';
import {chromium} from 'playwright';
const root=new URL('../',import.meta.url);
const files=new Map([
  ['/planet-designer.js','client/planet-designer.js'],['/planet-designer.css','client/planet-designer.css'],['/shared/planet-design.js','shared/planet-design.js'],
  ['/style.css','client/style.css'],['/readability.css','client/readability.css'],['/fantasy-ui.css','client/fantasy-ui.css'],['/assets/fonts/Jua-Regular.ttf','client/assets/fonts/Jua-Regular.ttf']
]);
const fixture=`<!doctype html><html lang="ko"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/style.css"><link rel="stylesheet" href="/readability.css"><link rel="stylesheet" href="/fantasy-ui.css"><link rel="stylesheet" href="/planet-designer.css"><body class="joined"><dialog id="parent"><button id="open">직접 디자인 만들기</button></dialog><script type="module">
import {openPlanetDesigner} from '/planet-designer.js';
window.saved=null;window.saveCalls=0;window.cancelCalls=0;window.rejectSave=false;window.gameKeys=0;
document.addEventListener('keydown',()=>window.gameKeys++);
document.querySelector('#parent').showModal();
document.querySelector('#open').onclick=()=>{window.editor=openPlanetDesigner({design:window.saved,onSave:design=>{if(window.rejectSave)throw Error('저장 테스트 오류');window.saved=design;window.saveCalls++;},onCancel:()=>window.cancelCalls++});};
</script></body></html>`;
const server=createServer(async(req,res)=>{
  try{
    if(req.url==='/'){res.setHeader('Content-Type','text/html; charset=utf-8');res.end(fixture);return;}
    const file=files.get(req.url);if(!file){res.writeHead(404).end();return;}
    res.setHeader('Content-Type',file.endsWith('.css')?'text/css':file.endsWith('.ttf')?'font/ttf':'text/javascript');res.end(await readFile(new URL(file,root)));
  }catch{res.writeHead(500).end();}
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const browser=await chromium.launch({headless:true,args:['--no-proxy-server'],...(process.platform==='win32'?{channel:'msedge'}:{})});
let checks=0;const errors=[];
try{
  const context=await browser.newContext({viewport:{width:1000,height:900}}),page=await context.newPage();
  page.on('pageerror',error=>errors.push(error.message));
  await page.goto(`http://127.0.0.1:${server.address().port}`);
  await page.locator('#open').click();
  const editor=page.locator('#planet-designer-dialog'),canvas=editor.locator('canvas');
  assert.equal(await editor.evaluate(el=>el.open),true);checks++;
  async function drag(from,to){const b=await canvas.boundingBox();await page.mouse.move(b.x+b.width*from[0],b.y+b.height*from[1]);await page.mouse.down();await page.mouse.move(b.x+b.width*to[0],b.y+b.height*to[1],{steps:12});await page.mouse.up();}
  await drag([.3,.5],[.7,.5]);assert.equal(await page.evaluate(()=>editor.getDesign().marks[0].tool),'brush');checks++;
  await editor.locator('[data-tool="star"]').click();await drag([.3,.2],[.7,.6]);
  assert.equal(await page.evaluate(()=>editor.getDesign().marks[1].tool),'star');checks++;
  await editor.locator('[data-action="undo"]').click();assert.equal(await page.evaluate(()=>editor.getDesign().marks.length),1);checks++;
  await editor.locator('[data-action="clear"]').click();assert.equal(await page.evaluate(()=>editor.getDesign().marks.length),0);
  await editor.locator('[data-action="undo"]').click();assert.equal(await page.evaluate(()=>editor.getDesign().marks.length),1);checks++;
  await editor.locator('[data-field="background"]').fill('#c4dea9');await editor.locator('[data-field="background"]').dispatchEvent('change');
  for(const tool of ['circle','rect','star']){
    await editor.locator(`[data-tool="${tool}"]`).click();await drag([.2+checks*.01,.2],[.55,.55]);
    assert.equal(await page.evaluate(()=>editor.getDesign().marks.at(-1).tool),tool);checks++;
  }
  assert.equal(await canvas.evaluate(el=>el.getContext('2d').getImageData(0,0,1,1).data[3]),0);
  assert.equal(await canvas.evaluate(el=>el.getContext('2d').getImageData(256,256,1,1).data[3]),255);checks++;
  await page.keyboard.press('x');assert.equal(await page.evaluate(()=>gameKeys),0);checks++;
  await mkdir(new URL('.local/',root),{recursive:true});
  await page.screenshot({path:new URL('.local/planet-designer-desktop.png',root).pathname.replace(/^\/([A-Z]:)/,'$1')});
  await page.evaluate(()=>{rejectSave=true;});await editor.locator('[data-action="save"]').click();
  assert.equal(await editor.locator('[role="status"]').textContent(),'저장 테스트 오류');assert.equal(await editor.evaluate(el=>el.open),true);checks++;
  await page.evaluate(()=>{rejectSave=false;});await editor.locator('[data-action="save"]').click();
  await editor.waitFor({state:'detached'});assert.equal(await page.evaluate(()=>saveCalls),1);assert.equal(await page.evaluate(()=>saved.marks.length),4);checks++;
  assert.equal(await page.locator('#open').evaluate(el=>el===document.activeElement),true);checks++;
  await page.locator('#open').click();await editor.locator('[data-action="clear"]').click();await page.keyboard.press('Escape');
  await editor.waitFor({state:'detached'});assert.equal(await page.evaluate(()=>saved.marks.length),4);assert.equal(await page.evaluate(()=>cancelCalls),1);checks++;
  await context.close();
  const mobile=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true}),mp=await mobile.newPage();
  mp.on('pageerror',error=>errors.push(error.message));await mp.goto(`http://127.0.0.1:${server.address().port}`);await mp.locator('#open').tap();
  await mp.locator('[data-tool="star"]').tap();assert.equal(await mp.locator('[data-tool="star"]').getAttribute('aria-pressed'),'true');checks++;
  await mp.locator('[data-tool="brush"]').tap();
  const bounds=await mp.locator('.planet-designer').boundingBox();assert.ok(bounds.x>=0&&bounds.x+bounds.width<=390);checks++;
  const mb=await mp.locator('.planet-designer canvas').boundingBox(),cdp=await mobile.newCDPSession(mp);
  assert.ok(Math.abs(mb.width-mb.height)<1,'shared game canvas styles must not stretch the drawing surface');checks++;
  await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:mb.x+mb.width*.3,y:mb.y+mb.height*.4}]});
  for(let i=1;i<=12;i++){
    await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:mb.x+mb.width*(.3+.3*i/12),y:mb.y+mb.height*(.4+.2*i/12)}]});
    await mp.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
  }
  await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
  assert.equal(await mp.evaluate(()=>editor.getDesign().marks.length),1);checks++;
  await mp.screenshot({path:new URL('.local/planet-designer-mobile.png',root).pathname.replace(/^\/([A-Z]:)/,'$1')});
  await mp.locator('[data-action="save"]').tap();
  await mp.waitForFunction(()=>saved!==null);assert.equal(await mp.evaluate(()=>saved.marks.length),1);checks++;
  assert.deepEqual(errors,[]);console.log(`Planet designer: ${checks} browser checks PASS (desktop and touch).`);
}finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
