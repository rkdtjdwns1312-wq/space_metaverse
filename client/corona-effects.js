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
    ctx.save();ctx.shadowColor='#ef1838';ctx.shadowBlur=8+aura.stage*2;
    frame(ctx,`skill-lv${aura.stage}`,13,size);ctx.restore();
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
