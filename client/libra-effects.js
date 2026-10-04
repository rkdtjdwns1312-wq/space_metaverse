import {LIBRA_VFX} from '/shared/libra-skills.js';

const images=new Map();
function frame(ctx,id,index,size){let image=images.get(id);
  if(!image){image=new Image();image.src=LIBRA_VFX[id].url;images.set(id,image);}
  if(!image.complete||!image.naturalWidth)return;
  ctx.drawImage(image,(index%6)*256,Math.floor(index/6)*256,256,256,-size/2,-size/2,size,size);
}
export function drawLibraProjectile(ctx,cast,elapsedMs,reducedMotion=false){
  if(cast.kind!=='libra-attack')return false;
  ctx.save();ctx.translate(cast.x,cast.y);ctx.rotate(Math.atan2(cast.dy??0,cast.dx??1));
  frame(ctx,'attack',reducedMotion?12:Math.min(23,Math.floor(elapsedMs/(cast.durationMs||650)*24)),cast.size*.85);
  ctx.restore();return true;
}
export function drawLibraAura(ctx,aura,elapsedMs,reducedMotion=false){
  const opening=elapsedMs<500,closing=elapsedMs>aura.durationMs-500;
  const size=aura.size*4.3;
  if(!opening&&!closing){
    frame(ctx,`skill-lv${aura.stage}`,12,size);
    return;
  }
  const index=reducedMotion?(opening?5:18):opening?Math.min(11,Math.floor(elapsedMs/500*12)):
    Math.min(23,18+Math.floor((elapsedMs-(aura.durationMs-500))/500*6));
  frame(ctx,`skill-lv${aura.stage}`,index,size);
}
