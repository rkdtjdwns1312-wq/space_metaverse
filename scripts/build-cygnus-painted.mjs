// Generated source atlas -> aligned transparent 24-frame game sheets and icons.
import {mkdir,writeFile} from 'node:fs/promises';
import {chromium} from 'playwright';
import {createClassroomServer} from '../server/app.js';
const game=createClassroomServer({teacherKey:'asset-build-local',studentHours:false});let browser;
try{
 const {port}=await game.listen();browser=await chromium.launch({headless:true,channel:'msedge',args:['--no-proxy-server']});const page=await browser.newPage();await page.goto(`http://127.0.0.1:${port}`);
 const result=await page.evaluate(async()=>{
  const im=new Image();im.src='/assets/skills/cygnus/source/painted-atlas.png';await im.decode();
  const make=(w,h)=>Object.assign(document.createElement('canvas'),{width:w,height:h});
  const smooth=x=>{x=Math.max(0,Math.min(1,x));return x*x*(3-2*x);};
  const files=[],stats=[];
  for(const [index,id] of ['attack','skill-lv2','skill-lv3','skill-lv4'].entries()){
   const cw=im.naturalWidth/2,ch=im.naturalHeight/2,source=make(cw,ch),sc=source.getContext('2d');sc.drawImage(im,index%2*cw,Math.floor(index/2)*ch,cw,ch,0,0,cw,ch);
   const data=sc.getImageData(0,0,cw,ch).data;let x0=cw,y0=ch,x1=0,y1=0;
   for(let y=0;y<ch;y++)for(let x=0;x<cw;x++)if(data[(y*cw+x)*4+3]>20){x0=Math.min(x0,x);x1=Math.max(x1,x);y0=Math.min(y0,y);y1=Math.max(y1,y);}
   x0=Math.max(0,x0-4);y0=Math.max(0,y0-4);x1=Math.min(cw-1,x1+4);y1=Math.min(ch-1,y1+4);
   const sw=x1-x0+1,sh=y1-y0+1,fit=Math.min(214/sw,214/sh),w=sw*fit,h=sh*fit;
   const sheet=make(1536,1024),sg=sheet.getContext('2d');const preview=make(768,512),pg=preview.getContext('2d');pg.fillStyle='#18263f';pg.fillRect(0,0,768,512);
   const frames=[];
   for(let f=0;f<24;f++){
    const c=make(256,256),g=c.getContext('2d');const t=f/23;
    const phase=id==='attack'?Math.min(smooth(t/.16),1-smooth((t-.76)/.24)):f<6?smooth(f/5):f>=18?1-smooth((f-18)/5):1;
    const scale=id==='attack'?.84+.16*phase:.72+.28*phase;
    g.save();g.translate(128,128);g.globalAlpha=phase;
    g.drawImage(source,x0,y0,sw,sh,-w*scale/2,-h*scale/2,w*scale,h*scale);
    // Only birth/fade carry particles; the held wing frames are identical and quiet.
    const glitter=id==='attack'?phase:(f<6||f>=18?Math.sin(phase*Math.PI):0);
    if(glitter>.01){g.globalAlpha=glitter*.65;g.fillStyle='#b9dbff';for(let i=0;i<8;i++){const a=i*Math.PI/4+.15*t,r=92+i%2*12,x=Math.cos(a)*r,y=Math.sin(a)*r;g.beginPath();g.moveTo(x-3,y);g.lineTo(x,y-5);g.lineTo(x+3,y);g.lineTo(x,y+5);g.closePath();g.fill();}}
    g.restore();sg.drawImage(c,f%6*256,Math.floor(f/6)*256);pg.drawImage(c,f%6*128,Math.floor(f/6)*128,128,128);frames.push(c.toDataURL());
    files.push([`${id}/frames/${String(f+1).padStart(2,'0')}.png`,frames.at(-1)]);
   }
   const icon=make(120,120),ic=icon.getContext('2d');ic.drawImage(source,x0,y0,sw,sh,60-w*.235,60-h*.235,w*.47,h*.47);
   files.push([`${id}.png`,sheet.toDataURL()],[`${id}-icon.png`,icon.toDataURL()],[`${id}-preview.png`,preview.toDataURL()]);
   stats.push({id,frames:24,distinctFrames:new Set(frames).size,holdStable:frames[6]===frames[12]&&frames[12]===frames[17],emptyEnds:frames[0]===frames[23]});
  }
  return {files,stats};
 });
 const root='client/assets/skills/cygnus';for(const [name,data] of result.files){await mkdir(`${root}/${name.substring(0,name.lastIndexOf('/'))}`,{recursive:true});await writeFile(`${root}/${name}`,Buffer.from(data.split(',')[1],'base64'));}
 await writeFile(`${root}/manifest.json`,JSON.stringify({format:'RGBA PNG',columns:6,rows:4,frameCount:24,frameWidth:256,frameHeight:256,frameOrder:'row-major',source:'source/painted-atlas.png',sourceTool:'built-in image_gen',buildScript:'scripts/build-cygnus-painted.mjs',anchor:{x:.5,y:.5},heldFrames:[6,17],assets:result.stats},null,2)+'\n');console.log(JSON.stringify(result.stats));
}finally{await browser?.close();await game.close();}
