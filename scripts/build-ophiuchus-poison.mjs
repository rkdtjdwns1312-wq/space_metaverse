import {mkdir,writeFile,readFile} from 'node:fs/promises';
import {chromium} from 'playwright';
import {createClassroomServer} from '../server/app.js';
const game=createClassroomServer({teacherKey:'poison-build-local',studentHours:false});let browser;
const root='client/assets/skills/ophiuchus';
const iconsOnly=process.argv.includes('--icons-only');
async function save(files){for(const [name,data] of files){await mkdir(`${root}/${name.substring(0,name.lastIndexOf('/'))}`,{recursive:true});await writeFile(`${root}/${name}`,Buffer.from(data.split(',')[1],'base64'));}}
try{
 const {port}=await game.listen();browser=await chromium.launch({headless:true,channel:'msedge',args:['--no-proxy-server']});const page=await browser.newPage();await page.goto(`http://127.0.0.1:${port}`);
 const art=await page.evaluate(async(iconsOnly)=>{
  const im=new Image();im.src='/assets/skills/ophiuchus/source/poison-atlas.png';await im.decode();
  const make=(w,h)=>Object.assign(document.createElement('canvas'),{width:w,height:h}),files=[];
  for(const stage of [2,3,4]){
   const n=stage-2,cw=im.width/2,ch=im.height/2,c=make(512,256),g=c.getContext('2d');
   // Cell gutters remain transparent; trim common vertical padding consistently.
   g.drawImage(im,n%2*cw+18,Math.floor(n/2)*ch+100,cw-36,320,0,0,512,256);
   if(!iconsOnly)files.push([`poison-lv${stage}.png`,c.toDataURL()]);
   const icon=make(120,120),ic=icon.getContext('2d');
   // The LV4 cloud crosses the atlas column: use its complete source bounds,
   // not the cropped ground texture. Keep aspect ratio and an 8px icon gutter.
   const [sx,sy,sw,sh]=({2:[0,100,765,405],3:[785,100,751,405],4:[0,540,990,475]})[stage];
   const fit=Math.min(104/sw,96/sh),w=sw*fit,h=sh*fit;
   ic.drawImage(im,sx,sy,sw,sh,(120-w)/2,(120-h)/2,w,h);
   files.push([`poison-lv${stage}-icon.png`,icon.toDataURL()],[`skill-lv${stage}-icon.png`,icon.toDataURL()]);
  }
  return files;
 },iconsOnly);await save(art);
 if(iconsOnly){console.log(JSON.stringify({icons:art.length,center:[60,60],minPadding:8}));}
 else {
 const result=await page.evaluate(async()=>{
  const {preloadOphiuchus,drawOphiuchusZone}=await import('/ophiuchus-effects.js');await Promise.all(preloadOphiuchus().map(i=>i.decode()));
  const make=(w,h)=>Object.assign(document.createElement('canvas'),{width:w,height:h});const files=[],stats=[];
  const times=[0,400,800,1200,1600,2000,...Array.from({length:12},(_,i)=>2400+i*800),12000,12400,12800,13200,13600,14000];
  for(const stage of [2,3,4]){
   const sheet=make(1536,1024),sg=sheet.getContext('2d'),hashes=[],preview=make(768,512),pg=preview.getContext('2d');pg.fillStyle='#17263d';pg.fillRect(0,0,768,512);
   for(const [f,ms] of times.entries()){
    const c=make(256,256),g=c.getContext('2d');drawOphiuchusZone(g,{stage,x:128,y:128,rx:118,ry:59,size:80,durationMs:14000},ms);
    const data=c.toDataURL();hashes.push(data);files.push([`skill-lv${stage}/frames/${String(f+1).padStart(2,'0')}.png`,data]);sg.drawImage(c,f%6*256,Math.floor(f/6)*256);pg.drawImage(c,f%6*128,Math.floor(f/6)*128,128,128);
   }
   files.push([`skill-lv${stage}.png`,sheet.toDataURL()],[`skill-lv${stage}-preview.png`,preview.toDataURL()]);stats.push({stage,frames:24,distinct:new Set(hashes).size,emptyEnds:hashes[0]===hashes[23]});
  }
  return {files,stats,times};
 });await save(result.files);
 await writeFile(`${root}/poison-manifest.json`,JSON.stringify({source:'source/poison-atlas.png',sourceTool:'built-in image_gen',buildScript:'scripts/build-ophiuchus-poison.mjs',columns:6,rows:4,frameSize:256,anchor:{x:.5,y:.5},timings:{growMs:2000,holdMs:10000,fadeMs:2000},sampleTimesMs:result.times,runtime:'continuous shared-area rendering',stages:result.stats},null,2)+'\n');console.log(JSON.stringify({files:art.length+result.files.length,stats:result.stats}));
 const manifest=JSON.parse(await readFile(`${root}/manifest.json`,'utf8'));
 for(const stage of [2,3,4])manifest.assets[`skill-lv${stage}`]={...result.stats.find(s=>s.stage===stage),canvas:[256,256],source:'source/poison-atlas.png',buildScript:'scripts/build-ophiuchus-poison.mjs',timingManifest:'poison-manifest.json',transparentBorders:true};
 await writeFile(`${root}/manifest.json`,JSON.stringify(manifest,null,2)+'\n');
 }
}finally{await browser?.close();await game.close();}
