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
  if(hit.dx<0){ctx.scale(-1,1);ctx.rotate(Math.atan2(hit.dy,-hit.dx));}
  else ctx.rotate(Math.atan2(hit.dy,hit.dx));
  frame(ctx,'attack',reducedMotion?12:Math.min(23,Math.floor(elapsedMs/(hit.durationMs||550)*24)),hit.size*1.25);
  ctx.restore();return true;
}
export function drawHerculesShield(ctx,shield,elapsedMs,reducedMotion=false){
  const id=`skill-lv${shield.stage}`;
  const duration=shield.durationMs||5000,elapsed=Math.max(0,Math.min(duration,elapsedMs));
  if(elapsed>=1000&&elapsed<duration-1000){
    // 같은 시트의 방패 중심만 잘라 고정합니다. 돔·바닥 마법진은 유지 중에는 보이지 않습니다.
    const image=imageOf(id);if(!image)return;
    const frameX=(4%6)*256,frameY=0;
    const width=shield.size*1.12,height=shield.size*2.47;
    ctx.drawImage(image,frameX+87,frameY+27,82,181,-width/2,-height/2,width,height);
    return;
  }
  const index=reducedMotion?(elapsed<1000?4:18):elapsed<1000?
    Math.min(4,Math.floor(elapsed/1000*5)):
    Math.min(23,12+Math.floor((elapsed-(duration-1000))/1000*12));
  frame(ctx,id,index,shield.size*3.5);
}
export function drawHerculesBurst(ctx,burst,elapsedMs,reducedMotion=false){
  ctx.save();ctx.translate(burst.x,burst.y);
  const progress=Math.min(1,elapsedMs/550);
  frame(ctx,`skill-lv${burst.stage}`,reducedMotion?15:Math.min(23,14+Math.floor(progress*10)),burst.size*(1.8+progress*2));
  ctx.restore();
}
