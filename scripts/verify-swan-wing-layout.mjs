import assert from 'node:assert/strict';
import {readFile,mkdir} from 'node:fs/promises';
import {chromium} from 'playwright';

const browser=await chromium.launch({headless:true,...(process.platform==='win32'?{channel:'chrome',args:['--no-proxy-server']}:{})});
try{
  const page=await browser.newPage({viewport:{width:960,height:380}});
  const errors=[];page.on('pageerror',error=>errors.push(error.message));
  await page.route('**/*',async route=>{
    const path=new URL(route.request().url()).pathname;
    if(path==='/'){await route.fulfill({status:200,contentType:'text/html',body:'<canvas id="scene" width="960" height="380"></canvas>'});return;}
    try{const local=path.startsWith('/shared/')?path.slice(1):'client'+path;
      await route.fulfill({status:200,contentType:path.endsWith('.png')?'image/png':'text/javascript',body:await readFile(local)});}
    catch{await route.fulfill({status:404,body:'not found'});}
  });
  await page.goto('http://local.test/');
  await page.evaluate(async()=>{
    window.swan=await import('/swan-effects.js');
    window.swan.preloadSwan();
  });
  await page.waitForTimeout(300);
  const pixels=await page.evaluate(()=>{
    const canvas=document.getElementById('scene'),ctx=canvas.getContext('2d');
    ctx.fillStyle='#263452';ctx.fillRect(0,0,960,380);
    for(let stage=2;stage<=4;stage++){
      const x=stage*290-400;
      ctx.fillStyle='#f5e8da';ctx.beginPath();ctx.ellipse(x,260,24,55,0,0,Math.PI*2);ctx.fill();
      window.swan.drawSwanAura(ctx,{stage,elapsedMs:1000,durationMs:20000},x,260,90);
    }
    return [...ctx.getImageData(0,0,960,380).data].filter((value,index)=>index%4===0&&value>150).length;
  });
  assert.ok(pixels>2000,'날개가 화면에 그려져야 합니다.');
  assert.deepEqual(errors,[]);
  await mkdir('.local',{recursive:true});
  await page.screenshot({path:'.local/swan-wing-layout.png'});
  console.log('백조자리 Lv2~4 등 뒤 날개 화면 그리기 통과');
}finally{await browser.close();}
