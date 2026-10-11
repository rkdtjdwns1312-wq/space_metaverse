import {mkdir,writeFile,readFile} from 'node:fs/promises';
import {chromium} from 'playwright';
import {createClassroomServer} from '../server/app.js';
const game=createClassroomServer({teacherKey:'libra-build-local',studentHours:false});let browser;
try{
 const {port}=await game.listen();browser=await chromium.launch({headless:true,channel:'msedge',args:['--no-proxy-server']});const page=await browser.newPage();await page.goto(`http://127.0.0.1:${port}`);
 const result=await page.evaluate(async()=>{
  const im=new Image();im.src='/assets/skills/libra/source/scale-lv4-painted.png';await im.decode();
  const make=(w,h)=>Object.assign(document.createElement('canvas'),{width:w,height:h});const smooth=x=>x*x*(3-2*x);
  const sheet=make(1536,1024),sg=sheet.getContext('2d'),preview=make(768,512),pg=preview.getContext('2d');pg.fillStyle='#18263f';pg.fillRect(0,0,768,512);
  const files=[],frames=[];
  for(let f=0;f<24;f++){
   const c=make(256,256),g=c.getContext('2d'),phase=f<12?smooth(f/11):f>=18?1-smooth((f-18)/5):1,scale=.72+.28*phase;
   g.save();g.translate(128,126);
   const sparkle=(f<12||f>=18)?Math.sin(phase*Math.PI):0;
   if(sparkle>.01){
    g.globalAlpha=sparkle*.85;g.strokeStyle='#ffd36b';g.lineWidth=1.4;
    for(const r of [89,111]){g.beginPath();g.ellipse(0,13,r*scale,r*.85*scale,0,0,Math.PI*2);g.stroke();}
    g.strokeStyle='#b9b6ff';g.lineWidth=2;g.beginPath();g.ellipse(0,87,111*scale,20,0,0,Math.PI*2);g.stroke();
    for(let i=0;i<16;i++){const a=i*Math.PI/8+.14*phase,x=Math.cos(a)*110*scale,y=13+Math.sin(a)*92*scale,r=i%2?2:4;g.fillStyle=i%2?'#e3d4ff':'#fff4ba';g.beginPath();g.moveTo(x-r,y);g.lineTo(x,y-r*1.5);g.lineTo(x+r,y);g.lineTo(x,y+r*1.5);g.closePath();g.fill();}
   }
   g.globalAlpha=phase;g.drawImage(im,-106*scale,-106*scale,212*scale,212*scale);g.restore();
   sg.drawImage(c,f%6*256,Math.floor(f/6)*256);pg.drawImage(c,f%6*128,Math.floor(f/6)*128,128,128);frames.push(c.toDataURL());files.push([`skill-lv4/frames/${String(f+1).padStart(2,'0')}.png`,frames.at(-1)]);
  }
  const icon=make(120,120);icon.getContext('2d').drawImage(im,6,6,108,108);
  files.push(['skill-lv4.png',sheet.toDataURL()],['skill-lv4-icon.png',icon.toDataURL()],['skill-lv4-preview.png',preview.toDataURL()]);
  return {files,holdStable:frames[12]===frames[17],emptyEnds:frames[0]===frames[23],distinctFrames:new Set(frames).size};
 });
 const root='client/assets/skills/libra';for(const [name,data] of result.files){await mkdir(`${root}/${name.substring(0,name.lastIndexOf('/'))}`,{recursive:true});await writeFile(`${root}/${name}`,Buffer.from(data.split(',')[1],'base64'));}
 const manifest=JSON.parse(await readFile(`${root}/manifest.json`,'utf8'));manifest.assets['skill-lv4']={source:'source/scale-lv4-painted.png',sourceTool:'built-in image_gen',buildScript:'scripts/build-libra-painted.mjs',frames:24,canvas:[256,256],holdFrames:[12,17],holdStable:result.holdStable,emptyEnds:result.emptyEnds,distinctFrames:result.distinctFrames};await writeFile(`${root}/manifest.json`,JSON.stringify(manifest,null,2)+'\n');console.log(JSON.stringify({...result,files:result.files.length}));
}finally{await browser?.close();await game.close();}
