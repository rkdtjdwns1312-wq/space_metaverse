import test from 'node:test';
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {createClassroomServer} from '../server/app.js';

test('물병 canvas: 물병 원화 없이 새 물·별빛·유지 구간 물방울, 공통 판정 반경과 감소된 모션',async t=>{
  const game=createClassroomServer({teacherKey:'aquarius-render-isolated',studentHours:false});
  const {port}=await game.listen();t.after(()=>game.close());
  const browser=await chromium.launch({headless:true,args:['--no-proxy-server'],...(process.platform==='win32'?{channel:'msedge'}:{})});
  t.after(()=>browser.close());const page=await browser.newPage();
  // 게임 로그인/저장 데이터와 무관한 같은 출처의 빈 canvas에서 실제 브라우저로 검증합니다.
  await page.goto(`http://127.0.0.1:${port}/shared/aquarius-skills.js`);
  const result=await page.evaluate(async()=>{
    const {drawAquarius}=await import('/aquarius-effects.js');
    const {aquariusAreaAt}=await import('/shared/aquarius-skills.js');
    document.body.replaceChildren();const canvas=document.createElement('canvas');
    canvas.width=600;canvas.height=400;document.body.append(canvas);
    const ctx=canvas.getContext('2d'),cast={kind:'aquarius-fountain',vfxId:'skill-lv4',x:300,y:200,rx:200,ry:100,size:100,durationMs:14000};
    const NativeImage=window.Image;window.Image=class extends NativeImage {
      set src(value){if(value.includes('skill-lv'))throw new Error('E must not load jug artwork');super.src=value;}
      get src(){return super.src;}
    };
    drawAquarius(ctx,cast,3000);
    const texture=new NativeImage();texture.src='/assets/skills/aquarius/water-area.png';await texture.decode();
    const samples=[];let bubbleCount=0;
    const originalEllipse=ctx.ellipse.bind(ctx);
    ctx.ellipse=(x,y,rx,ry,...rest)=>{if(rx>0&&rx<4&&ry>rx)bubbleCount++;return originalEllipse(x,y,rx,ry,...rest);};
    for(const durationMs of [14000,15000])for(const ms of [0,1000,2000,7300,12000,12500,13000,14000,15000]){
      cast.durationMs=durationMs;
      ctx.clearRect(0,0,600,400);bubbleCount=0;drawAquarius(ctx,cast,ms);
      const area=aquariusAreaAt(cast,ms),pixels=ctx.getImageData(0,0,600,400).data;
      let count=0,outside=0;
      for(let y=0;y<400;y++)for(let x=0;x<600;x++)if(pixels[(y*600+x)*4+3]){
        count++;
        if(!area.rx||((x+.5-cast.x)/(area.rx+1))**2+((y+.5-cast.y)/(area.ry+1))**2>1)outside++;
      }
      samples.push({ms,durationMs,count,outside,bubbles:bubbleCount});
    }
    const reducedAt=ms=>{ctx.clearRect(0,0,600,400);drawAquarius(ctx,cast,ms,true);return canvas.toDataURL();};
    const reducedStable=reducedAt(3000)===reducedAt(8000);
    const movingAt=ms=>{ctx.clearRect(0,0,600,400);drawAquarius(ctx,cast,ms);return canvas.toDataURL();};
    const animated=movingAt(3000)!==movingAt(8000);
    window.Image=NativeImage;return {samples,reducedStable,animated};
  });
  for(const sample of result.samples){
    assert.equal(sample.outside,0,`outside shared ellipse at ${sample.ms}`);
    assert.equal(sample.count>0,sample.ms>0&&sample.ms<sample.durationMs);
    assert.equal(sample.bubbles>0,sample.ms>=2000&&sample.ms<sample.durationMs-2000);
  }
  for(const duration of [14000,15000]){
    const samples=result.samples.filter(s=>s.durationMs===duration),at=ms=>samples.find(s=>s.ms===ms);
    assert.ok(at(1000).count<at(2000).count);
    assert.ok(at(duration-1000).count<at(duration-2000).count);
  }
  assert.equal(result.reducedStable,true);assert.equal(result.animated,true);
});
