import {ARIES_VFX,ariesFrameAt} from '/shared/aries-skills.js';

const images=new Map();
export function preloadAries(ids=Object.keys(ARIES_VFX)){
  for(const id of ids){const spec=ARIES_VFX[id];if(!spec||images.has(spec.url))continue;
    const image=new Image();image.src=spec.url;images.set(spec.url,image);}
}
function frame(ctx,spec,index,x,y,size){
  const image=images.get(spec.url);if(!image?.complete||!image.naturalWidth)return;
  ctx.drawImage(image,(index%6)*256,Math.floor(index/6)*256,256,256,x-size/2,y-size/2,size,size);
}
export function drawAriesProjectile(ctx,cast,elapsedMs,reducedMotion=false){
  if(cast.kind!=='aries-attack')return false;
  const spec=ARIES_VFX.attack;preloadAries(['attack']);
  const index=reducedMotion?12:Math.min(23,Math.floor(Math.min(1,elapsedMs/(cast.durationMs||650))*24));
  ctx.save();ctx.translate(cast.x,cast.y);ctx.rotate(Math.atan2(cast.dy??0,cast.dx??1));
  frame(ctx,spec,index,0,0,cast.size*.85);ctx.restore();return true;
}
export function drawAriesCloud(ctx,cloud,reducedMotion=false){
  const spec=ARIES_VFX[`skill-lv${cloud.stage}`];if(!spec)return;
  preloadAries([spec.id]);
  const elapsed=Math.max(0,cloud.elapsedMs),travel=Math.min(1,elapsed/600);
  const eased=travel*travel*(3-2*travel),x=cloud.x+(cloud.targetX-cloud.x)*eased,
    y=cloud.y+(cloud.targetY-cloud.y)*eased;
  const index=reducedMotion?12:ariesFrameAt(elapsed,cloud.durationMs);
  frame(ctx,spec,index,x,y,cloud.size);
}
