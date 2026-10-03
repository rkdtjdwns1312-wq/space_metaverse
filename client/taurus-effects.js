import {TAURUS_VFX} from '/shared/taurus-skills.js';

const images=new Map();
function imageOf(id){const spec=TAURUS_VFX[id];if(!spec)return null;
  if(!images.has(id)){const image=new Image();image.src=spec.url;images.set(id,image);}
  const image=images.get(id);return image.complete&&image.naturalWidth?image:null;
}
function drawFrame(ctx,id,index,size){const image=imageOf(id);if(!image)return;
  ctx.drawImage(image,(index%6)*256,Math.floor(index/6)*256,256,256,-size/2,-size/2,size,size);
}
export function drawTaurusProjectile(ctx,cast,elapsedMs,reducedMotion=false){
  if(cast.kind!=='taurus-attack')return false;
  ctx.save();ctx.translate(cast.x,cast.y);ctx.rotate(Math.atan2(cast.dy??0,cast.dx??1));
  const index=reducedMotion?12:Math.min(23,Math.floor(elapsedMs/(cast.durationMs||650)*24));
  drawFrame(ctx,'attack',index,cast.size*.9);ctx.restore();return true;
}
export function drawTaurusDash(ctx,dash,elapsedMs,reducedMotion=false){
  const progress=Math.min(1,Math.max(0,elapsedMs/dash.durationMs));
  const index=reducedMotion?12:Math.min(23,Math.floor(progress*24));
  ctx.save();ctx.rotate(Math.atan2(dash.dy,dash.dx));
  drawFrame(ctx,`skill-lv${dash.stage}`,index,dash.size*(dash.stage===2?1.6:dash.stage===3?1.9:2.2));
  ctx.restore();
}
