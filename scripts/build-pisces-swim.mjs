// Rig the existing fish texture into a seamless fin/tail cycle; never move the head.
import {mkdir,writeFile} from 'node:fs/promises';
import {chromium} from 'playwright';
import {createClassroomServer} from '../server/app.js';
const root='client/assets/skills/pisces/swim',game=createClassroomServer({teacherKey:'pisces-swim-build-local',studentHours:false});let browser;
try{
 await mkdir(root,{recursive:true});const {port}=await game.listen();browser=await chromium.launch({headless:true,channel:'msedge',args:['--no-proxy-server']});const page=await browser.newPage();await page.goto(`http://127.0.0.1:${port}`);
 const result=await page.evaluate(async()=>{
  const im=new Image();im.src='/assets/skills/pisces/portal-fish.png';await im.decode();const W=384,H=192,N=48;
  const make=(w,h)=>Object.assign(document.createElement('canvas'),{width:w,height:h});const base=make(W,H),bg=base.getContext('2d');bg.drawImage(im,0,0,W,H);const src=bg.getImageData(0,0,W,H).data;
  const sheet=make(W*8,H*6),sg=sheet.getContext('2d'),frames=[],checks={faceChanges:0,borderAlpha:0,distinct:0};
  const clamp=x=>Math.max(0,Math.min(1,x)),smooth=x=>{x=clamp(x);return x*x*(3-2*x);};
  const wave=(x,y,t)=>{
   const u=x/W,v=y/H;if(u>=.8)return 0;
   const tail=smooth((.55-u)/.50),tailSwing=H*.080*tail*tail*Math.sin(t+u*3);
   const finX=smooth((u-.43)/.12)*(1-smooth((u-.72)/.08));
   const lower=smooth((v-.59)/.20),upper=1-smooth((v-.24)/.16);
   return tailSwing+H*.035*finX*lower*Math.sin(t+.9)+H*.024*finX*upper*Math.sin(t+2);
  };
  for(let f=0;f<N;f++){
   const c=make(W,H),g=c.getContext('2d'),out=g.createImageData(W,H),dst=out.data,t=f/N*Math.PI*2;
   for(let y=0;y<H;y++)for(let x=0;x<W;x++){
    let sy=y;for(let k=0;k<4;k++)sy=y-wave(x,sy,t);
    const y0=Math.floor(sy),mix=sy-y0,k=(y*W+x)*4;
    if(y0<0||y0>=H-1)continue;
    const a=(y0*W+x)*4,b=a+W*4,aa=src[a+3]*(1-mix),ab=src[b+3]*mix,alpha=aa+ab;
    dst[k+3]=alpha;if(alpha)for(let ch=0;ch<3;ch++)dst[k+ch]=(src[a+ch]*aa+src[b+ch]*ab)/alpha;
    if(x>=Math.ceil(W*.8))for(let ch=0;ch<4;ch++)if(dst[k+ch]!==src[k+ch])checks.faceChanges++;
    if((x===0||x===W-1||y===0||y===H-1)&&dst[k+3])checks.borderAlpha++;
   }
   g.putImageData(out,0,0);sg.drawImage(c,f%8*W,Math.floor(f/8)*H);frames.push(c.toDataURL());
  }
  checks.distinct=new Set(frames).size;return {sheet:sheet.toDataURL(),frames,checks,width:W,height:H};
 });
 if(result.checks.faceChanges||result.checks.borderAlpha||result.checks.distinct!==48)throw new Error(JSON.stringify(result.checks));
 await mkdir(`${root}/frames`,{recursive:true});for(const [i,data]of result.frames.entries())await writeFile(`${root}/frames/${String(i+1).padStart(2,'0')}.png`,Buffer.from(data.split(',')[1],'base64'));
 await writeFile(`${root}/swim-48f.png`,Buffer.from(result.sheet.split(',')[1],'base64'));
 await writeFile(`${root}/manifest.json`,JSON.stringify({frames:48,columns:8,rows:6,frameWidth:result.width,frameHeight:result.height,cycleMs:1000,source:'../portal-fish.png',buildScript:'scripts/build-pisces-swim.mjs',headFixedFromX:.8,geometryUnchanged:true,checks:result.checks},null,2)+'\n');console.log(JSON.stringify(result.checks));
}finally{await browser?.close();await game.close();}
