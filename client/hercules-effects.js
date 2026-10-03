import {HERCULES_VFX} from '/shared/hercules-skills.js';

const images=new Map();
function imageOf(id){const spec=HERCULES_VFX[id];if(!spec)return null;
  if(!images.has(id)){const image=new Image();image.src=spec.url;images.set(id,image);}
  const image=images.get(id);return image.complete&&image.naturalWidth?image:null;
}
function frame(ctx,id,index,size){const image=imageOf(id);if(!image)return;
  ctx.drawImage(image,(index%6)*256,Math.floor(index/6)*256,256,256,-size/2,-size/2,size,size);
}
export function drawHerculesAttack(ctx,hit,elapsedMs,reducedMotion=false){
  if(hit.kind!=='hercules-attack')return false;
  ctx.save();ctx.translate(hit.x+hit.dx*hit.reach,hit.y+hit.dy*hit.reach);
  ctx.rotate(Math.atan2(hit.dy,hit.dx));
  frame(ctx,'attack',reducedMotion?12:Math.min(23,Math.floor(elapsedMs/(hit.durationMs||550)*24)),hit.size*1.25);
  ctx.restore();return true;
}
export function drawHerculesShield(ctx,shield,elapsedMs,reducedMotion=false){
  const id=`skill-lv${shield.stage}`;
  const index=reducedMotion?12:elapsedMs<700?Math.floor(elapsedMs/700*6):elapsedMs>shield.durationMs-500?18+Math.floor((elapsedMs-(shield.durationMs-500))/500*6):6+Math.floor((elapsedMs-700)/85)%12;
  frame(ctx,id,Math.min(23,index),shield.size*1.75);
}
export function drawHerculesBurst(ctx,burst,elapsedMs,reducedMotion=false){
  ctx.save();ctx.translate(burst.x,burst.y);
  const progress=Math.min(1,elapsedMs/550);
  frame(ctx,`skill-lv${burst.stage}`,reducedMotion?15:Math.min(23,14+Math.floor(progress*10)),burst.size*(1.8+progress*2));
  ctx.restore();
}
