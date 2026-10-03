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
  ctx.save();ctx.translate(hit.x+hit.dx*hit.reach,hit.y+hit.dy*hit.reach);
  ctx.rotate(Math.atan2(hit.dy,hit.dx));
  frame(ctx,'attack',reducedMotion?12:Math.min(23,Math.floor(elapsedMs/(hit.durationMs||500)*24)),hit.size*1.3);
  ctx.restore();return true;
}
export function drawCoronaAura(ctx,aura,elapsedMs,reducedMotion=false){
  const index=reducedMotion?12:elapsedMs<650?Math.floor(elapsedMs/650*6):elapsedMs>aura.durationMs-550?18+Math.floor((elapsedMs-(aura.durationMs-550))/550*6):6+Math.floor((elapsedMs-650)/85)%12;
  frame(ctx,`skill-lv${aura.stage}`,Math.min(23,index),aura.size*1.8);
}
export function drawCoronaFall(ctx,fall,elapsedMs,reducedMotion=false){
  const progress=Math.min(1,elapsedMs/350);
  ctx.save();ctx.translate(fall.x,fall.y-70*(1-progress));
  ctx.rotate(Math.PI/2);
  frame(ctx,'attack',reducedMotion?12:Math.min(23,Math.floor(progress*24)),fall.size*.9);
  ctx.restore();
}
