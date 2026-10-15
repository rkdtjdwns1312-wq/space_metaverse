import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {chromium} from 'playwright';

test('Pisces Q renders a stage-scaled water stream in four directions and E keeps the swimming fish in water portals',async t=>{
  const root=process.cwd(),files={
    '/client/pisces-bullet.js':['client/pisces-bullet.js','text/javascript'],
    '/client/pisces-portals.js':['client/pisces-portals.js','text/javascript'],
    '/shared/pisces-portals.js':['shared/pisces-portals.js','text/javascript'],
    '/assets/skills/pisces/portal-fish.png':['client/assets/skills/pisces/portal-fish.png','image/png'],
    '/assets/skills/pisces/water-portal.png':['client/assets/skills/pisces/water-portal.png','image/png'],
    '/assets/skills/pisces/swim/swim-48f.png':['client/assets/skills/pisces/swim/swim-48f.png','image/png']
  };
  const server=createServer(async(req,res)=>{
    const url=new URL(req.url,'http://localhost');if(url.pathname==='/'){res.writeHead(200,{'content-type':'text/html'}).end('<!doctype html><html><meta charset="utf-8"><body style="margin:0;background:#17223d"></body></html>');return;}
    const entry=files[url.pathname];if(!entry){res.writeHead(404).end();return;}
    res.writeHead(200,{'content-type':entry[1]}).end(await readFile(resolve(root,entry[0])));
  });
  await new Promise(done=>server.listen(0,'127.0.0.1',done));
  const browser=await chromium.launch({headless:true,channel:'msedge',args:['--no-proxy-server']}),page=await browser.newPage({viewport:{width:1320,height:820}});
  t.after(async()=>{await page.close();await browser.close();await new Promise(done=>server.close(done));});
  await page.goto(`http://127.0.0.1:${server.address().port}/`);
  const visual=await page.evaluate(async()=>{
    const [{drawPiscesBullet},{drawPiscesPortalPair,drawPiscesPortalFish,preloadPiscesSwim}]=await Promise.all([
      import('/client/pisces-bullet.js'),import('/client/pisces-portals.js')]);
    const [fish,swim,waterPortal]=preloadPiscesSwim();await Promise.all([fish.decode(),swim.decode(),waterPortal.decode()]);
    const canvas=document.createElement('canvas');canvas.width=1320;canvas.height=900;document.body.append(canvas);
    const ctx=canvas.getContext('2d');ctx.fillStyle='#17223d';ctx.fillRect(0,0,canvas.width,canvas.height);
    const labels=(text,x,y)=>{ctx.fillStyle='#f4f7ff';ctx.font='bold 20px sans-serif';ctx.fillText(text,x,y);};
    const directions=[['→',1,0],['←',-1,0],['↑',0,-1],['↓',0,1]],areas=[],sequence=[];
    for(let row=0;row<3;row++){
      const level=row+2;labels(`Q · Lv${level}`,20,70+row*195);
      for(let col=0;col<4;col++){
        const [arrow,dx,dy]=directions[col],x=190+col*275,y=115+row*195;
        ctx.save();ctx.translate(x,y);ctx.strokeStyle='#52627d';ctx.lineWidth=1;ctx.beginPath();ctx.arc(0,0,86,0,Math.PI*2);ctx.stroke();
        const probe=document.createElement('canvas');probe.width=184;probe.height=184;const pc=probe.getContext('2d');pc.translate(92,92);
        drawPiscesBullet(pc,{x:0,y:0,dx,dy,size:112,level,durationMs:650},325,false);ctx.drawImage(probe,-92,-92);ctx.restore();labels(arrow,x-8,y+101);
        const pixels=probe.getContext('2d').getImageData(0,0,184,184).data;let minX=184,minY=184,maxX=-1,maxY=-1,area=0;
        for(let py=0;py<184;py++)for(let px=0;px<184;px++)if(pixels[(py*184+px)*4+3]>50){area++;minX=Math.min(minX,px);minY=Math.min(minY,py);maxX=Math.max(maxX,px);maxY=Math.max(maxY,py);}
        areas.push({level,arrow,area,width:maxX-minX+1,height:maxY-minY+1});
      }
    }
    for(const elapsedMs of [150,325,500]){
      const probe=document.createElement('canvas');probe.width=184;probe.height=184;const pc=probe.getContext('2d');pc.translate(92,92);
      drawPiscesBullet(pc,{x:0,y:0,dx:1,dy:0,size:112,level:4,durationMs:650},elapsedMs,false);
      sequence.push({elapsedMs,alpha:pc.getImageData(0,0,184,184).data.filter((v,i)=>i%4===3&&v>30).length});
    }
    labels('E · 물길 출입구와 머리부터 헤엄치는 물고기',30,700);
    const cast={piscesPortal:true,fishStage:4,level:4,size:100,range:1000,originOffset:50,x:110,y:800,dx:1,dy:0,durationMs:2000,fishIndex:0};
    drawPiscesPortalPair(ctx,cast,850,false,false);drawPiscesPortalFish(ctx,cast,850,false);drawPiscesPortalPair(ctx,cast,850,false,true);
    return {png:canvas.toDataURL('image/png'),areas,sequence,fishSrc:fish.src,swimSrc:swim.src,waterPortalSrc:waterPortal.src};
  });
  const row=level=>visual.areas.filter(a=>a.level===level).map(a=>a.area);
  assert(row(2).every(value=>value>0));assert(row(3).every((value,i)=>value>row(2)[i]));assert(row(4).every((value,i)=>value>row(3)[i]));
  for(const level of [2,3,4])for(const item of visual.areas.filter(a=>a.level===level)){
    const horizontal=item.arrow==='→'||item.arrow==='←',major=horizontal?item.width:item.height,minor=horizontal?item.height:item.width;
    assert(major>=([105,130,155][level-2]),`Lv${level} ${item.arrow} should have a visibly long water stream`);
    assert(major/minor>=1.8,`Lv${level} ${item.arrow} should read as a stream, not a droplet`);
  }
  assert(visual.sequence.every(frame=>frame.alpha>0),'연속 발사 중간에 물줄기가 끊기지 않아야 해요.');
  assert.deepEqual(visual.areas.map(a=>a.arrow),Array(3).fill(['→','←','↑','↓']).flat());
  assert.match(visual.fishSrc,/portal-fish\.png$/);assert.match(visual.swimSrc,/swim-48f\.png$/);
  assert.match(visual.waterPortalSrc,/water-portal\.png$/);
  const output=resolve(root,'.local/pisces-vfx/stream-portals.png');await mkdir(resolve(root,'.local/pisces-vfx'),{recursive:true});
  await writeFile(output,Buffer.from(visual.png.split(',')[1],'base64'));
  assert.equal(await page.locator('canvas').count(),1);
});
