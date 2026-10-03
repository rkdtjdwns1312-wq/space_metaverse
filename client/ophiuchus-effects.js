import {OPHIUCHUS_VFX,ophiuchusFrameAt} from '/shared/ophiuchus-skills.js';

const images=new Map();
export function preloadOphiuchus(ids=Object.keys(OPHIUCHUS_VFX)){
  for(const id of ids){
    const spec=OPHIUCHUS_VFX[id];if(!spec||images.has(spec.url))continue;
    const image=new Image();image.src=spec.url;images.set(spec.url,image);
  }
}
function drawFrame(ctx,spec,frame,x,y,size){
  const image=images.get(spec.url);if(!image?.complete||!image.naturalWidth)return;
  ctx.drawImage(image,(frame%6)*256,Math.floor(frame/6)*256,256,256,x-size/2,y-size/2,size,size);
}
export function drawOphiuchusProjectile(ctx,cast,elapsedMs,reducedMotion=false){
  if(cast.kind!=='ophiuchus-attack')return false;
  const spec=OPHIUCHUS_VFX.attack;preloadOphiuchus(['attack']);
  const progress=Math.max(0,Math.min(1,elapsedMs/(cast.durationMs||650)));
  const frame=reducedMotion?12:Math.min(23,Math.floor(progress*24));
  ctx.save();ctx.translate(cast.x,cast.y);ctx.rotate(Math.atan2(cast.dy??0,cast.dx??1));
  ctx.shadowColor='#a954ef';ctx.shadowBlur=12;
  drawFrame(ctx,spec,frame,0,0,cast.size*1.3);
  ctx.restore();return true;
}
export function drawOphiuchusSkill(ctx,hit,elapsedMs,reducedMotion=false){
  if(hit.kind!=='ophiuchus-skill')return false;
  const spec=OPHIUCHUS_VFX[hit.vfxId];if(!spec)return false;
  preloadOphiuchus([spec.id]);
  const frame=reducedMotion?12:ophiuchusFrameAt(elapsedMs);
  const center=hit.size*.6+hit.range*.55;
  ctx.save();ctx.translate(hit.x+hit.dx*center,hit.y+hit.dy*center);ctx.rotate(Math.atan2(hit.dy,hit.dx));
  drawFrame(ctx,spec,frame,0,0,hit.size*hit.snakeScale*1.35);
  ctx.restore();return true;
}
