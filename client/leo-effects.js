import {LEO_VFX} from '/shared/leo-skills.js';
const images=new Map();
function frame(ctx,id,index,size){let image=images.get(id);
  if(!image){image=new Image();image.src=LEO_VFX[id].url;images.set(id,image);}
  if(!image.complete||!image.naturalWidth)return;
  const first=Math.max(0,Math.min(23,Math.floor(index))),blend=Math.max(0,Math.min(1,index-first));
  ctx.save();const baseAlpha=ctx.globalAlpha;ctx.globalAlpha=baseAlpha*(1-blend);
  ctx.drawImage(image,(first%6)*256,Math.floor(first/6)*256,256,256,-size/2,-size/2,size,size);
  if(blend&&first<23){ctx.globalAlpha=baseAlpha*blend;
    ctx.drawImage(image,((first+1)%6)*256,Math.floor((first+1)/6)*256,256,256,-size/2,-size/2,size,size);}
  ctx.restore();
}
export function drawLeoAttack(ctx,hit,elapsedMs,reducedMotion=false){
  if(hit.kind!=='leo-attack')return false;
  ctx.save();ctx.translate(hit.x+hit.dx*hit.reach,hit.y+hit.dy*hit.reach);
  if(hit.dx<0){ctx.scale(-1,1);ctx.rotate(Math.atan2(hit.dy,-hit.dx));}
  else ctx.rotate(Math.atan2(hit.dy,hit.dx));
  const progress=Math.min(1,elapsedMs/(hit.durationMs||500));
  // 원본 첫 세 장의 얇은 금빛 할퀴기만 사용합니다. 이후 프레임의 사자 형상은 스킬용입니다.
  frame(ctx,'attack',reducedMotion?2:1+Math.min(1,progress*3),hit.size*1.2);
  ctx.globalAlpha=.3*(1-progress);
  ctx.translate(-hit.size*.14,0);
  frame(ctx,'attack',2,hit.size*1.2);
  ctx.restore();return true;
}
export function drawLeoRoar(ctx,roar,elapsedMs,reducedMotion=false){
  ctx.save();ctx.translate(roar.x,roar.y);
  const progress=Math.min(1,elapsedMs/(roar.durationMs||3000));
  frame(ctx,`skill-lv${roar.stage}`,reducedMotion?12:Math.min(23,progress*23),roar.size*2.8);
  ctx.restore();
}
