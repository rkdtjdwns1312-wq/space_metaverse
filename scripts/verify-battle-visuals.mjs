// 기존 투명 시트를 사용하는 전투 연출의 생성·유지·종료 장면을 실제 브라우저에서 그립니다.
import assert from 'node:assert/strict';
import {randomBytes} from 'node:crypto';
import {mkdtemp,mkdir,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {chromium} from 'playwright';
import {createClassroomServer} from '../server/app.js';

const dir=await mkdtemp(join(tmpdir(),'battle-visuals-'));
const game=createClassroomServer({teacherKey:randomBytes(24).toString('hex'),studentHours:false,dataDir:dir});
const {port}=await game.listen();
const browser=await chromium.launch({headless:true,...(process.platform==='win32'?{channel:'msedge'}:{})});
try{
  await mkdir('.local',{recursive:true});
  const page=await browser.newPage({viewport:{width:1400,height:1050}}),errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  await page.goto(`http://127.0.0.1:${port}/`);
  const result=await page.evaluate(async()=>{
    const [{drawCoronaAura},{drawLeoRoar},{drawOphiuchusSkill},{drawHerculesShield},
      {drawWaterProjectile,drawWaterAura}]=await Promise.all([
      import('/corona-effects.js'),import('/leo-effects.js'),import('/ophiuchus-effects.js'),
      import('/hercules-effects.js'),import('/water-effects.js')]);
    for(const src of ['/assets/skills/corona-borealis/skill-lv4.png','/assets/skills/leo/skill-lv4.png',
      '/assets/skills/ophiuchus/skill-lv4.png','/assets/skills/hercules/skill-lv4.png',
      '/assets/skills/cetus/skill-lv4.png','/assets/skills/cetus/attack.png']){
      const image=new Image();image.src=src;await image.decode();
    }
    const canvas=document.createElement('canvas');canvas.width=1400;canvas.height=1000;
    Object.assign(canvas.style,{position:'fixed',left:'0',top:'0',zIndex:'9999',width:'1400px',height:'1000px'});
    document.body.append(canvas);const ctx=canvas.getContext('2d');
    const panels=[['왕관 유지',50,40],['사자 포효',720,40],['뱀 독기',50,365],['방패 유지',720,365],
      ['고래 오라',50,690],['고래 일반공격',720,690]];
    for(const [label,x,y] of panels){ctx.fillStyle='#151e43';ctx.fillRect(x,y,630,290);ctx.fillStyle='white';ctx.font='24px sans-serif';ctx.fillText(label,x+20,y+35);}
    ctx.save();ctx.translate(365,220);drawCoronaAura(ctx,{stage:4,size:105,durationMs:12000},4000);ctx.restore();
    drawLeoRoar(ctx,{x:1040,y:220,stage:4,size:95,rx:190,ry:95,durationMs:3000},1560);
    drawOphiuchusSkill(ctx,{kind:'ophiuchus-skill',vfxId:'skill-lv4',x:110,y:545,dx:1,dy:0,
      size:100,snakeScale:3,range:400,originOffset:60},1650);
    ctx.save();ctx.translate(1030,550);drawHerculesShield(ctx,{stage:4,size:105,durationMs:5000},2500);ctx.restore();
    drawWaterAura(ctx,{kind:'cetus',stage:4,elapsedMs:2700,durationMs:10000},365,870,105);
    drawWaterProjectile(ctx,{kind:'cetus-attack',vfxId:'attack',x:1030,y:865,dx:1,dy:0,
      size:105,durationMs:850},380);
    return {width:canvas.width,height:canvas.height};
  });
  await page.waitForTimeout(350);
  // Images are cached by the effect modules after the first draw; the second draw is the visual check.
  await page.evaluate(()=>{const c=document.querySelector('canvas[style*="z-index: 9999"]');c.remove();});
  const drawn=await page.evaluate(async()=>{
    const [{drawCoronaAura},{drawLeoRoar},{drawOphiuchusSkill},{drawHerculesShield},
      {drawWaterProjectile,drawWaterAura}]=await Promise.all([
      import('/corona-effects.js'),import('/leo-effects.js'),import('/ophiuchus-effects.js'),
      import('/hercules-effects.js'),import('/water-effects.js')]);
    const canvas=document.createElement('canvas');canvas.width=1400;canvas.height=1000;
    Object.assign(canvas.style,{position:'fixed',left:'0',top:'0',zIndex:'9999',width:'1400px',height:'1000px'});
    document.body.append(canvas);const ctx=canvas.getContext('2d');
    const panels=[['왕관 유지',50,40],['사자 포효',720,40],['뱀 독기',50,365],['방패 유지',720,365],
      ['고래 오라',50,690],['고래 일반공격',720,690]];
    for(const [label,x,y] of panels){ctx.fillStyle='#151e43';ctx.fillRect(x,y,630,290);ctx.fillStyle='white';ctx.font='24px sans-serif';ctx.fillText(label,x+20,y+35);}
    ctx.save();ctx.translate(365,220);drawCoronaAura(ctx,{stage:4,size:105,durationMs:12000},4000);ctx.restore();
    drawLeoRoar(ctx,{x:1040,y:220,stage:4,size:95,rx:190,ry:95,durationMs:3000},1560);
    drawOphiuchusSkill(ctx,{kind:'ophiuchus-skill',vfxId:'skill-lv4',x:110,y:545,dx:1,dy:0,
      size:100,snakeScale:3,range:400,originOffset:60},1650);
    ctx.save();ctx.translate(1030,550);drawHerculesShield(ctx,{stage:4,size:105,durationMs:5000},2500);ctx.restore();
    drawWaterAura(ctx,{kind:'cetus',stage:4,elapsedMs:2700,durationMs:10000},365,870,105);
    drawWaterProjectile(ctx,{kind:'cetus-attack',vfxId:'attack',x:1030,y:865,dx:1,dy:0,
      size:105,durationMs:850},380);
    const pixels=ctx.getImageData(0,0,1400,1000).data;
    const counts=panels.map(([,x,y])=>{
      let count=0;
      for(let py=y+65;py<y+280;py++)for(let px=x+10;px<x+620;px++){
        const i=(py*1400+px)*4;
        if(pixels[i]>105&&pixels[i+1]>85&&pixels[i+2]>95)count++;
      }
      return count;
    });
    return {counts};
  });
  assert.equal(result.width,1400);
  assert.ok(drawn.counts.every(count=>count>100),`여섯 전투 연출이 모두 나타나야 합니다: ${drawn.counts}`);
  assert.deepEqual(errors,[]);
  await page.screenshot({path:'.local/battle-visuals.png'});
  console.log(JSON.stringify({image:'.local/battle-visuals.png',effectPixels:drawn.counts,errors}));
}finally{await browser.close();await game.close();await rm(dir,{recursive:true,force:true});}
