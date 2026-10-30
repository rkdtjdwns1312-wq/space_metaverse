import assert from 'node:assert/strict';
import {mkdirSync,writeFileSync} from 'node:fs';
import {chromium} from 'playwright';
import {createClassroomServer} from '../server/app.js';
const game=createClassroomServer({teacherKey:'walk-frame-review',studentHours:false,dataDir:null});let browser;
try{
 const {port}=await game.listen();browser=await chromium.launch({headless:true,...(process.platform==='win32'?{channel:'msedge'}:{})});const page=await browser.newPage({viewport:{width:1280,height:720}});await page.goto('http://127.0.0.1:'+port);
 const result=await page.evaluate(async()=>{
  const {preloadBossArt,drawBossMonster}=await import('/boss-monster-art.js');await preloadBossArt('noksera');
  const image=new Image();image.src='/assets/monsters/noksera-walk.png';await image.decode();
  const sheet=document.createElement('canvas');sheet.width=1280;sheet.height=720;const g=sheet.getContext('2d');g.fillStyle='#19304a';g.fillRect(0,0,1280,720);
  const frames=[],records=[],cached=[];
  for(let flip=0;flip<2;flip++)for(let index=0;index<4;index++){
   const c=document.createElement('canvas');c.width=320;c.height=340;const ctx=c.getContext('2d'),draw=ctx.drawImage.bind(ctx);let frame;
   ctx.drawImage=(...args)=>{frame=args[0];draw(...args);};
   drawBossMonster(ctx,{shape:'noksera',x:160,y:205,radius:140,facingX:flip?1:-1,moving:true},index*180);
   if(!flip){cached.push(frame);const original=document.createElement('canvas');original.width=original.height=627;const o=original.getContext('2d');o.drawImage(image,index%2*627,Math.floor(index/2)*627,627,627,0,0,627,627);
    const a=o.getImageData(0,0,627,627).data,b=frame.getContext('2d').getImageData(0,0,627,627).data,gutter=index%2?26:0;let removed=0,changedInside=0,remainingGutter=0;
    for(let y=0;y<627;y++)for(let x=0;x<627;x++){const p=(y*627+x)*4;if(x<gutter){if(a[p+3])removed++;if(b[p+3])remainingGutter++;}else for(let k=0;k<4;k++)if(a[p+k]!==b[p+k])changedInside++;}
    records.push({index,removed,changedInside,remainingGutter,width:frame.width,height:frame.height});
   }else frames.push(frame===cached[index]);
   g.drawImage(c,index*320,flip*360+20);g.fillStyle='#fff';g.font='16px sans-serif';g.fillText('Pose '+(index+1)+(flip?' / right':' / left'),index*320+12,flip*360+20);
  }
  return {records,frames,png:sheet.toDataURL('image/png')};
 });
 for(const r of result.records){assert.equal(r.width,627);assert.equal(r.height,627);assert.equal(r.changedInside,0);assert.equal(r.remainingGutter,0);if(r.index%2)assert.ok(r.removed>0);}
 assert.ok(result.frames.every(Boolean),'same cached pose reused for mirrored direction');mkdirSync('.local/noksera-walk',{recursive:true});writeFileSync('.local/noksera-walk/frames-clean.png',Buffer.from(result.png.split(',')[1],'base64'));console.log('PASS4poses×2directions, cached frames, right-column neighbour fragments removed, every retained source pixel unchanged',result.records);
}finally{await browser?.close();await game.close();}
