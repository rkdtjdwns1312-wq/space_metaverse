import {chromium} from 'playwright';
import express from 'express';
import {mkdir,writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';

const app=express();app.use(express.static('client'));app.use('/shared',express.static('shared'));
const server=app.listen(0,'127.0.0.1');await new Promise(resolve=>server.once('listening',resolve));
const browser=await chromium.launch({headless:true,channel:process.platform==='win32'?'msedge':undefined});
try{
 const page=await browser.newPage({viewport:{width:1600,height:1000}});
 await page.goto(`http://127.0.0.1:${server.address().port}/celestial-monster-art.js`);
 const result=await page.evaluate(async()=>{
  const cool=await import('/celestial-monster-art.js'),warm=await import('/sun-monster-art.js');
  await cool.preloadCelestialArt('grown-cool-star');await warm.preloadSunMonsterArt('grown-warm-star');
  document.body.innerHTML='<canvas width="1600" height="1000"></canvas>';document.body.style.margin='0';
  const ctx=document.querySelector('canvas').getContext('2d');ctx.fillStyle='#253049';ctx.fillRect(0,0,1600,1000);
  const times=[150,270,330,470],shapes=['grown-cool-star','grown-warm-star'];
  for(let row=0;row<4;row++)for(let col=0;col<4;col++){
   const shape=shapes[Math.floor(row/2)],face=row%2?-1:1,x=200+col*400,y=145+row*245;
   ctx.fillStyle='white';ctx.font='16px sans-serif';ctx.textAlign='center';ctx.fillText(`${shape} ${times[col]}ms ${face}`,x,y-115);
   (row<2?cool.drawCelestialMonster:warm.drawSunMonster)(ctx,{shape,x,y,radius:80,facingX:face},times[col],{startedAt:0,durationMs:600,dx:face,dy:0});
  }
  // Isolate procedural flame so sprite pixels cannot conceal a cutoff.
  const probe=document.createElement('canvas');probe.width=probe.height=400;const pc=probe.getContext('2d');
  pc.drawImage=()=>{};
  warm.drawSunMonster(pc,{shape:'grown-warm-star',x:150,y:150,radius:100},300,{startedAt:0,durationMs:600,dx:1,dy:0});
  const data=pc.getImageData(0,0,400,400).data;
  // Old tight rectangle began near x185: at y170 it jumped 0→~30 alpha.
  let jump=0;for(let x=175;x<195;x++)jump=Math.max(jump,Math.abs(data[(170*400+x)*4+3]-data[(170*400+x-1)*4+3]));
  return {warmGlowMaximumAdjacentAlphaJump:jump};
 });
 assert(result.warmGlowMaximumAdjacentAlphaJump<=3,JSON.stringify(result));
 await mkdir('.local',{recursive:true});await page.screenshot({path:'.local/grown-breath-poses.png'});
 await writeFile('.local/grown-breath-result.json',JSON.stringify(result,null,2));console.log(result);
}finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
