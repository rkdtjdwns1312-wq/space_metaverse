import assert from 'node:assert/strict';
import {mkdirSync,writeFileSync} from 'node:fs';
import {chromium} from 'playwright';
import {createClassroomServer} from '../server/app.js';

// Same viewport, DPR, avatar count and movement in each map; no real room data.
const tag=process.argv[2]||'current',out='.local/street-performance';mkdirSync(out,{recursive:true});
const game=createClassroomServer({teacherKey:'render-benchmark-only',studentHours:false});
const {port}=await game.listen();
const browser=await chromium.launch({headless:true,args:['--no-proxy-server'],...(process.platform==='win32'?{channel:'msedge'}:{})});
const results=[],errors=[];
try{
  const page=await browser.newPage({viewport:{width:1200,height:760},deviceScaleFactor:1});
  page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/render-benchmark',route=>route.fulfill({contentType:'text/html',body:'<body class="joined" style="margin:0"><canvas style="width:1200px;height:760px"></canvas>'}));
  await page.goto(`http://127.0.0.1:${port}/render-benchmark`);
  const cdp=await page.context().newCDPSession(page);await cdp.send('Performance.enable');
  await page.evaluate(async()=>{
    const {createWorld}=await import('/world.js');
    window.frameData=[];window.recording=false;
    const raf=requestAnimationFrame.bind(window);let previous;
    window.requestAnimationFrame=fn=>raf(t=>{const start=performance.now();fn(t);if(recording)frameData.push({ms:performance.now()-start,gap:previous?t-previous:0});previous=t;});
    window.world=createWorld(document.querySelector('canvas'));
  });
  for(const count of [1,35])for(const [id,x,y] of [['space-plaza',1800,1320],['star-street',900,1690],['star-street',900,700],['star-street',900,2810]]){
    await page.evaluate(({id,x,y,count})=>{
      clearInterval(window.moving);window.room={players:Array.from({length:count},(_,i)=>({id:'p'+i,role:'student',nickname:'측정'+i,mapId:id,x:x+(i%7-3)*42,y:y+Math.floor(i/7)*38,avatar:{level:1},effects:[]})),planets:[],monsters:[]};
      room.players[0].x=x;room.players[0].y=y;world.setRoom(room,'p0');
      let tick=0;window.moving=setInterval(()=>{tick++;world.positions({positions:room.players.map((p,i)=>[p.id,x+(i?i%7-3:0)*42+Math.sin(tick/18)*55,y+(i?Math.floor(i/7)*38:0),1])});},50);
    },{id,x,y,count});
    await page.waitForFunction(()=>document.querySelector('canvas').dataset.artStatus==='ready');
    await page.waitForTimeout(800);
    await cdp.send('Emulation.setCPUThrottlingRate',{rate:4});
    await cdp.send('Profiler.enable');await cdp.send('Profiler.start');
    const before=await cdp.send('Performance.getMetrics');
    await page.evaluate(()=>{frameData=[];recording=true;});await page.waitForTimeout(2500);
    const frames=await page.evaluate(()=>{recording=false;return frameData;});
    const after=await cdp.send('Performance.getMetrics'),{profile}=await cdp.send('Profiler.stop');
    await cdp.send('Emulation.setCPUThrottlingRate',{rate:1});
    const calls=await page.evaluate(async()=>{
      const c=document.querySelector('canvas').getContext('2d'),draw=c.drawImage.bind(c),text=c.fillText.bind(c),stroke=c.strokeText.bind(c);
      const calls={images:0,offscreenImages:0,text:0,largeSurfaces:[]};
      c.drawImage=(...a)=>{const image=a[0],n=a.length,dx=a[n===9?5:1],dy=a[n===9?6:2],dw=n===3?(image.width||image.naturalWidth):a[n===9?7:3],dh=n===3?(image.height||image.naturalHeight):a[n===9?8:4],m=c.getTransform();
        const left=dx*m.a+m.e,top=dy*m.d+m.f,right=left+dw*m.a,bottom=top+dh*m.d;calls.images++;
        if(right<0||bottom<0||left>c.canvas.width||top>c.canvas.height)calls.offscreenImages++;
        if(image.width>1700&&image.height>2000)calls.largeSurfaces.push({width:image.width,height:image.height,sourcePixels:n===9?a[3]*a[4]:image.width*image.height});
        return draw(...a);
      };c.fillText=(...a)=>{calls.text++;return text(...a);};c.strokeText=(...a)=>{calls.text++;return stroke(...a);};
      await new Promise(resolve=>requestAnimationFrame(()=>resolve()));c.drawImage=draw;c.fillText=text;c.strokeText=stroke;return calls;
    });
    const times=frames.map(f=>f.ms).sort((a,b)=>a-b),gaps=frames.slice(1).map(f=>f.gap),metric=(list,name)=>list.metrics.find(m=>m.name===name)?.value||0;
    const samples=new Map();for(let i=0;i<(profile.samples||[]).length;i++){const node=profile.nodes.find(n=>n.id===profile.samples[i]),name=node?.callFrame.functionName||'(anonymous)';samples.set(name,(samples.get(name)||0)+(profile.timeDeltas?.[i]||0));}
    const result={id,x,y,players:count,cpuThrottle:4,frames:frames.length,fps:1000/(gaps.reduce((a,b)=>a+b,0)/gaps.length),meanMs:times.reduce((a,b)=>a+b,0)/times.length,p95Ms:times[Math.floor(times.length*.95)],over33ms:gaps.filter(n=>n>33.4).length,taskMs:(metric(after,'TaskDuration')-metric(before,'TaskDuration'))*1000,calls,hotFunctions:[...samples.entries()].filter(([name])=>!['(idle)','(program)'].includes(name)).sort((a,b)=>b[1]-a[1]).slice(0,8)};
    results.push(result);console.log(JSON.stringify(result));
    if(count===1)await page.screenshot({path:`${out}/${tag}-${id}-${y}.png`});
  }
  assert.deepEqual(errors,[]);writeFileSync(`${out}/${tag}.json`,JSON.stringify({tag,results,errors},null,2));
}finally{await browser.close();await game.close();}
