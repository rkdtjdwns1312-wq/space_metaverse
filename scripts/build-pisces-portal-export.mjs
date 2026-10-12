import {mkdir,writeFile} from 'node:fs/promises';
import {chromium} from 'playwright';
import {createClassroomServer} from '../server/app.js';
const root='client/assets/skills/pisces/portal-export',game=createClassroomServer({teacherKey:'pisces-export-local',studentHours:false});let browser;
try{
 const {port}=await game.listen();browser=await chromium.launch({headless:true,channel:'msedge',args:['--no-proxy-server']});const page=await browser.newPage();await page.goto(`http://127.0.0.1:${port}`);
 const files=await page.evaluate(async()=>{
  const {drawPiscesPortalPair,drawPiscesPortalFish,preloadPiscesSwim}=await import('/pisces-portals.js');await Promise.all(preloadPiscesSwim().map(i=>i.decode()));
  const {piscesPortalTiming}=await import('/shared/pisces-portals.js'),make=(w,h)=>Object.assign(document.createElement('canvas'),{width:w,height:h}),files=[];
  for(const level of [2,3,4]){
   const {hits,stagger,durationMs}=piscesPortalTiming(level),sheet=make(5120,1320),sg=sheet.getContext('2d');
   for(let f=0;f<48;f++){
    const c=make(640,220),g=c.getContext('2d'),time=f/47*2000,cast={kind:'pisces-skill',piscesPortal:true,fishStage:level,level,size:100,range:480,originOffset:50,durationMs,x:40,y:110,dx:1,dy:0};
    drawPiscesPortalPair(g,cast,time);for(let i=0;i<hits;i++){const age=time-i*stagger;if(age>=0&&age<=durationMs)drawPiscesPortalFish(g,{...cast,fishIndex:i},age);}drawPiscesPortalPair(g,cast,time,false,true);
    sg.drawImage(c,f%8*640,Math.floor(f/8)*220);files.push([`lv${level}-frames/${String(f+1).padStart(2,'0')}.png`,c.toDataURL()]);
   }files.push([`lv${level}-48f.png`,sheet.toDataURL()]);
  }return files;
 });for(const [name,data]of files){await mkdir(`${root}/${name.substring(0,name.lastIndexOf('/'))}`,{recursive:true});await writeFile(`${root}/${name}`,Buffer.from(data.split(',')[1],'base64'));}
 await writeFile(`${root}/manifest.json`,JSON.stringify({frames:48,columns:8,rows:6,frameWidth:640,frameHeight:220,anchor:{x:40,y:110},durationMs:2000,order:'row-major',levels:[2,3,4],runtime:'continuous portal clipping with fixed-size fish and independent 48-frame swimming cycles',source:'../portal-fish.png',swimAtlas:'../swim/swim-48f.png',buildScript:'scripts/build-pisces-portal-export.mjs'},null,2)+'\n');console.log('3 portal sheets and 144 aligned RGBA frames exported');
}finally{await browser?.close();await game.close();}
