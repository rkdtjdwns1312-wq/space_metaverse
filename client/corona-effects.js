import {CORONA_VFX} from '/shared/corona-skills.js';

const images=new Map();
function frame(ctx,id,index,size){let image=images.get(id);
  if(!image){image=new Image();image.src=CORONA_VFX[id].url;images.set(id,image);}
  if(!image.complete||!image.naturalWidth)return;
  ctx.drawImage(image,(index%6)*256,Math.floor(index/6)*256,256,256,-size/2,-size/2,size,size);
}
export function drawCoronaProjectile(ctx,cast,elapsedMs,reducedMotion=false){
  if(cast.kind!=='corona-finale')return false;
  ctx.save();ctx.translate(cast.x,cast.y);ctx.rotate(Math.atan2(cast.dy??0,cast.dx??1));
  frame(ctx,'attack',reducedMotion?12:Math.min(23,Math.floor(elapsedMs/(cast.durationMs||650)*24)),cast.size*(cast.visualScale||2));
  ctx.restore();return true;
}
export function drawCoronaAttack(ctx,hit,elapsedMs,reducedMotion=false){
  if(hit.kind!=='corona-attack')return false;
  ctx.save();ctx.translate(hit.x,hit.y);
  if(hit.dx<0){ctx.scale(-1,1);ctx.rotate(Math.atan2(hit.dy,-hit.dx));}
  else ctx.rotate(Math.atan2(hit.dy,hit.dx));
  const id='attack',image=images.get(id)||new Image();
  if(!images.has(id)){image.src=CORONA_VFX[id].url;images.set(id,image);}
  if(image.complete&&image.naturalWidth){
    const index=reducedMotion?12:Math.min(23,Math.floor(elapsedMs/(hit.durationMs||500)*24));
    const near=hit.size*.18,far=hit.reach+hit.size*.48,height=hit.size*1.3;
    ctx.drawImage(image,(index%6)*256,Math.floor(index/6)*256,256,256,near,-height/2,far-near,height);
  }
  ctx.restore();return true;
}
export function drawCoronaAura(ctx,aura,elapsedMs,reducedMotion=false){
  const size=aura.size*(aura.stage===2?1.3:aura.stage===3?1.55:1.8);
  const opening=elapsedMs<1000,closing=elapsedMs>aura.durationMs-1000;
  if(!opening&&!closing){
    // 원본 프레임의 중앙 왕관만 남기고 바깥 붉은 고리·입자·그림자는 제외합니다.
    ctx.save();
    ctx.beginPath();
    const crownOutline=[[128,27],[151,80],[177,65],[181,105],[209,93],[194,169],
      [178,190],[78,190],[62,169],[47,93],[75,105],[79,65],[105,80]];
    crownOutline.forEach(([x,y],i)=>{const px=(x/256-.5)*size,py=(y/256-.5)*size;
      if(i===0)ctx.moveTo(px,py);else ctx.lineTo(px,py);});
    ctx.closePath();ctx.clip();
    frame(ctx,`skill-lv${aura.stage}`,13,size);
    ctx.restore();
    return;
  }
  const index=reducedMotion?(opening?12:17):opening?Math.min(12,Math.floor(elapsedMs/1000*13)):
    Math.min(23,16+Math.floor((elapsedMs-(aura.durationMs-1000))/1000*8));
  frame(ctx,`skill-lv${aura.stage}`,index,size);
}
export function drawCoronaFall(ctx,fall,elapsedMs,reducedMotion=false){
  const progress=Math.min(1,elapsedMs/350);
  ctx.save();ctx.translate(fall.x,fall.y-70*(1-progress));
  ctx.rotate(Math.PI/2);
  frame(ctx,'attack',reducedMotion?12:Math.min(23,Math.floor(progress*24)),fall.size*.9);
  ctx.restore();
}
