import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {chromium} from 'playwright';
import {createClassroomServer} from '../server/app.js';
const out='.local/580-582-visuals';await mkdir(out,{recursive:true});
const game=createClassroomServer({teacherKey:'portal-visual-local-only',studentHours:false});let browser;
try{
 const {port}=await game.listen();browser=await chromium.launch({headless:true,channel:'msedge',args:['--no-proxy-server']});
 const page=await browser.newPage({viewport:{width:1200,height:900}});await page.goto(`http://127.0.0.1:${port}`);
 const result=await page.evaluate(async()=>{
  const {drawPiscesPortalPair,drawPiscesPortalFish}=await import('/pisces-portals.js');
  const {piscesPortalTiming}=await import('/shared/pisces-portals.js');
  const {geminiWalkFrames}=await import('/gemini-animation.js');
  const {drawLeoRoar}=await import('/leo-effects.js');
  const make=(w,h)=>Object.assign(document.createElement('canvas'),{width:w,height:h});
  const load=async src=>{const im=new Image();im.src=src;await im.decode();return im;};
  await load('/assets/skills/pisces/portal-fish.png');
  drawPiscesPortalFish(make(1,1).getContext('2d'),{size:100,range:480,level:2,durationMs:2000,x:0,y:0},0);
  await new Promise(r=>setTimeout(r,100));
  const sheets=[],walks=[],lions=[],stats=[];
  for(const level of [2,3,4]){
   const {hits,stagger,durationMs:duration}=piscesPortalTiming(level);
   const sheet=make(640*8,220*6),sc=sheet.getContext('2d');
   for(let f=0;f<48;f++){
    const c=make(640,220),ctx=c.getContext('2d'),time=f/47*2000;
    const cast={kind:'pisces-skill',piscesPortal:true,fishStage:level,fishIndex:0,level,size:100,range:480,originOffset:50,durationMs:duration,x:40,y:110,dx:1,dy:0};
    drawPiscesPortalPair(ctx,cast,time);
    for(let i=0;i<hits;i++){const age=time-i*stagger;if(age>=0&&age<=duration)drawPiscesPortalFish(ctx,{...cast,fishIndex:i},age);}
    drawPiscesPortalPair(ctx,cast,time,false,true);
    sc.drawImage(c,f%8*640,Math.floor(f/8)*220);
   }
   sheets.push({level,png:sheet.toDataURL()});
   const source=await load(`/assets/avatars/${level===2?'':`lv${level}/`}gemini.png`),frames=geminiWalkFrames(source,level),walk=make(1024,1024),wc=walk.getContext('2d');
   const base=frames[0].getContext('2d').getImageData(0,0,256,256).data;let faceChanges=0;
   for(let f=0;f<16;f++){
    wc.drawImage(frames[f],f%4*256,Math.floor(f/4)*256);const data=frames[f].getContext('2d').getImageData(0,0,256,256).data;
    for(let y=40;y<110;y++)for(let x=72;x<195;x++){const k=(y*256+x)*4;for(let c=0;c<4;c++)if(data[k+c]!==base[k+c])faceChanges++;}
   }
   walks.push({level,png:walk.toDataURL()});stats.push({level,faceChanges});
   const lion=make(1800,360),lc=lion.getContext('2d');const roar={stage:level,x:0,y:0,size:90,rx:155,ry:85,durationMs:3000};
   drawLeoRoar(lc,roar,1500);await new Promise(r=>setTimeout(r,80));lc.clearRect(0,0,1800,360);
   for(const [i,t] of [0,600,1260,1550,2550,3000].entries()){lc.save();lc.translate(i*300+150,180);drawLeoRoar(lc,roar,t);lc.restore();}
   lions.push({level,png:lion.toDataURL()});
  }
  return {sheets,walks,lions,stats};
 });
 for(const [key,prefix]of [['sheets','portal'],['walks','gemini'],['lions','leo']])for(const item of result[key])await writeFile(`${out}/${prefix}-lv${item.level}.png`,Buffer.from(item.png.split(',')[1],'base64'));
  await writeFile(`${out}/results.json`,JSON.stringify(result.stats,null,2));assert(result.stats.every(s=>s.faceChanges===0));console.log(JSON.stringify({portalSheets:3,framesEach:48,gemini:result.stats,leoStaticPose:3}));
}finally{await browser?.close();await game.close();}
