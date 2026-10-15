import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {chromium} from 'playwright';
import {createClassroomServer} from '../server/app.js';
const game=createClassroomServer({teacherKey:'isolated-zone-view',studentHours:false});let browser;
try{
 const {port}=await game.listen();await mkdir('.local/667-668-zones',{recursive:true});browser=await chromium.launch({headless:true,args:['--no-proxy-server'],...(process.platform==='win32'?{channel:'msedge'}:{})});const page=await browser.newPage({viewport:{width:1200,height:900}});
 await page.goto(`http://127.0.0.1:${port}/shared/aquarius-skills.js`);
 const result=await page.evaluate(async()=>{
  const {aquariusSkillOf}=await import('/shared/aquarius-skills.js'),{ophiuchusSkillOf}=await import('/shared/ophiuchus-skills.js'),{drawAquarius,preloadAquarius}=await import('/aquarius-effects.js'),{drawOphiuchusZone,preloadOphiuchus}=await import('/ophiuchus-effects.js');
  preloadAquarius();await Promise.all(preloadOphiuchus().map(i=>i.decode()));const tex=new Image();tex.src='/assets/skills/aquarius/water-area.png';await tex.decode();
  document.body.replaceChildren();document.body.style.cssText='margin:0;background:#202a43;color:white;font:18px sans-serif';const samples=[];
  for(const [id,specOf,draw,factor] of [['aquarius',aquariusSkillOf,drawAquarius,2],['ophiuchus',ophiuchusSkillOf,drawOphiuchusZone,1.5]]){
   const row=document.createElement('div');row.style.cssText='display:flex';document.body.append(row);
   for(const level of [2,3,4]){const spec=specOf({avatar:{level,constellationId:id}}),size=48,rx=spec.radiusWidths*size,ry=rx*spec.verticalRatio,cast={kind:id==='aquarius'?'aquarius-fountain':'ophiuchus-zone',stage:level,x:200,y:160,size,rx,ry,durationMs:14000};
    const box=document.createElement('div'),label=document.createElement('p');label.textContent=`${id} LV${level} · ×${factor}`;const canvas=document.createElement('canvas');canvas.width=400;canvas.height=300;box.append(label,canvas);row.append(box);const c=canvas.getContext('2d');draw(c,cast,5000);
    const pixels=c.getImageData(0,0,400,300).data;let visible=0;for(let i=3;i<pixels.length;i+=4)if(pixels[i]>0)visible++;
    c.strokeStyle='#fff9';c.setLineDash([4,5]);c.beginPath();c.ellipse(cast.x,cast.y,rx,ry,0,0,Math.PI*2);c.stroke();
    samples.push({id,level,ratio:spec.radiusWidths/((level+1)/2*.8),visible,rx,ry});
   }
  }return samples;
 });
 for(const s of result){assert(Math.abs(s.ratio-(s.id==='aquarius'?2:1.5))<1e-9);assert(s.visible>0);}await page.screenshot({path:'.local/667-668-zones/regions.png',fullPage:true});await writeFile('.local/667-668-zones/report.json',JSON.stringify(result));console.log('PASS: 6개 레벨별 영역 확대 및 실제 Canvas 표시');
}finally{await browser?.close();await game.close();}
