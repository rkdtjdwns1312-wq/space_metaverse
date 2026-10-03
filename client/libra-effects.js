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
  const index=reducedMotion?12:elapsedMs<650?Math.floor(elapsedMs/650*6):elapsedMs>aura.durationMs-550?18+Math.floor((elapsedMs-(aura.durationMs-550))/550*6):6+Math.floor((elapsedMs-650)/85)%12;
  frame(ctx,`skill-lv${aura.stage}`,Math.min(23,index),aura.size*2.15);
  ctx.save();ctx.strokeStyle='#ffe3a388';ctx.lineWidth=2;ctx.beginPath();ctx.ellipse(0,0,aura.radius,aura.radius*.34,0,0,Math.PI*2);ctx.stroke();ctx.restore();
}
