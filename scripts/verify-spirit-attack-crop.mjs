import assert from 'node:assert/strict';
import {mkdirSync} from 'node:fs';
import {chromium} from 'playwright';
import {createClassroomServer} from '../server/app.js';
const game=createClassroomServer({studentHours:false,teacherKey:'isolated-spirit-art-check'}),{port}=await game.listen();
const browser=await chromium.launch({headless:true,args:['--no-proxy-server'],...(process.platform==='win32'?{channel:'msedge'}:{})});
mkdirSync('.local',{recursive:true});
try{
 const page=await browser.newPage({viewport:{width:1600,height:1400}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(`http://127.0.0.1:${port}/health`);
 const result=await page.evaluate(async()=>{
  const art=await import('/monster-attack-frames.js'),boss=await import('/boss-monster-art.js');await boss.preloadBossArt('spirit-king');
  const im=art.paintedMonsterImage('spirit-king'),source=document.createElement('canvas');source.width=im.width;source.height=im.height;
  const sc=source.getContext('2d');sc.drawImage(im,0,0);const pixels=sc.getImageData(0,0,im.width,im.height).data;
  const count=(x0,y0,w,h)=>{let n=0;for(let y=y0;y<y0+h;y++)for(let x=x0;x<x0+w;x++)if(pixels[(y*im.width+x)*4+3]>32)n++;return n;};
  const legacyBootFragments=[],cleanGutter=[];
  for(let col=0;col<4;col++){legacyBootFragments.push(count(col*443,443,443,12));cleanGutter.push(count(col*443,480,443,35));}
  document.body.replaceChildren();document.body.style.cssText='margin:0;background:#273146';
  const canvas=document.createElement('canvas');canvas.width=1600;canvas.height=1400;document.body.append(canvas);const ctx=canvas.getContext('2d');ctx.fillStyle='#273146';ctx.fillRect(0,0,1600,1400);
  const times=[30,90,150,215,295,390,475,560],frames=[];
  for(let direction=0;direction<2;direction++)for(let i=0;i<8;i++){
   const col=i%4,row=Math.floor(i/4)+direction*2,x=200+col*400,y=315+row*350,dx=direction?-1:1,time=times[i]*800/600;
   const pose=art.monsterAttackPose(time,{startedAt:0,durationMs:800});frames.push(pose.frame);
   ctx.fillStyle='white';ctx.font='18px sans-serif';ctx.fillText('Attack '+(i+1)+' / '+(dx>0?'right':'left'),x-85,y-280);
   boss.drawBossMonster(ctx,{shape:'spirit-king',x,y:y-72,radius:80,facingX:dx},time,{startedAt:0,durationMs:800,dx,dy:0});
  }
  return {legacyBootFragments,cleanGutter,frames};
 });
 assert(result.legacyBootFragments.every(n=>n>0),'old 443px split must reproduce boot fragments in all four lower frames');
 assert(result.cleanGutter.every(n=>n===0),'new lower-row source must have no boots above its head');
 assert.deepEqual(result.frames,[0,1,2,3,4,5,6,7,0,1,2,3,4,5,6,7]);assert.deepEqual(errors,[]);
 await page.screenshot({path:'.local/spirit-attack-fixed-16.png'});
 console.log('PASS spirit king: original 443px split reproduces stray boots in four frames; new source gutter clean; eight actual boss attack poses in both directions; no page errors',JSON.stringify(result));
}finally{await browser.close();await game.close();}
