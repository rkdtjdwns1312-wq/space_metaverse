import {LEO_VFX} from '/shared/leo-skills.js';
const images=new Map();
function frame(ctx,id,index,size){let image=images.get(id);
  if(!image){image=new Image();image.src=LEO_VFX[id].url;images.set(id,image);}
  if(!image.complete||!image.naturalWidth)return;
  ctx.drawImage(image,(index%6)*256,Math.floor(index/6)*256,256,256,-size/2,-size/2,size,size);
}
export function drawLeoAttack(ctx,hit,elapsedMs,reducedMotion=false){
  if(hit.kind!=='leo-attack')return false;
  ctx.save();ctx.translate(hit.x+hit.dx*hit.reach,hit.y+hit.dy*hit.reach);ctx.rotate(Math.atan2(hit.dy,hit.dx));
  frame(ctx,'attack',reducedMotion?12:Math.min(23,Math.floor(elapsedMs/(hit.durationMs||500)*24)),hit.size*1.2);
  ctx.restore();return true;
}
export function drawLeoRoar(ctx,roar,elapsedMs,reducedMotion=false){
  ctx.save();ctx.translate(roar.x,roar.y);
  frame(ctx,`skill-lv${roar.stage}`,reducedMotion?12:Math.min(23,Math.floor(elapsedMs/(roar.durationMs||1000)*24)),roar.size*2.8);
  ctx.restore();
}
