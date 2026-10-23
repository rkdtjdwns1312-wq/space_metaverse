import assert from 'node:assert/strict';
import {readFileSync,mkdirSync} from 'node:fs';
import {resolve} from 'node:path';
import {chromium} from 'playwright';

const browser=await chromium.launch({headless:true,args:['--no-proxy-server'],...(process.platform==='win32'?{channel:'msedge'}:{})});
try{
  const page=await browser.newPage({viewport:{width:780,height:980}});
  await page.route('http://walk.test/**',async route=>{
    const path=new URL(route.request().url()).pathname;
    if(path==='/')return route.fulfill({contentType:'text/html',body:'<canvas id="walk" width="768" height="960"></canvas>'});
    if(path==='/origin-monster-walk.js')return route.fulfill({contentType:'text/javascript',body:readFileSync('client/origin-monster-walk.js')});
    if(/^\/assets\/monsters\/[a-z-]+-walk\.png$/.test(path))return route.fulfill({contentType:'image/png',body:readFileSync(resolve('client'+path))});
    return route.fulfill({status:404,body:'not found'});
  });
  await page.goto('http://walk.test/');
  const result=await page.evaluate(async()=>{
    const {ORIGIN_WALK_ART,originWalkImage,drawOriginWalkFrame}=await import('/origin-monster-walk.js');
    const ctx=document.querySelector('#walk').getContext('2d'),rows=[];
    for(const [row,shape] of Object.keys(ORIGIN_WALK_ART).entries()){
      await originWalkImage(shape).decode();
      const samples=[];
      for(let frame=0;frame<4;frame++){
        const small=document.createElement('canvas');small.width=160;small.height=160;
        const c=small.getContext('2d');
        if(!drawOriginWalkFrame(c,shape,frame*160,0,0,160))throw Error('image not ready: '+shape);
        samples.push(small.toDataURL());
        ctx.drawImage(small,frame*192,row*160,160,160);
      }
      rows.push({shape,distinct:new Set(samples).size});
    }
    return rows;
  });
  assert.equal(result.length,6);
  for(const row of result)assert.equal(row.distinct,4,`${row.shape} 걷기 프레임이 서로 달라야 합니다`);
  mkdirSync('.local',{recursive:true});
  await page.locator('#walk').screenshot({path:'.local/origin-monster-walk-preview.png'});
  console.log('origin walk browser frames: '+result.map(row=>row.shape+'='+row.distinct).join(', '));
}finally{await browser.close();}
