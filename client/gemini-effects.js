import {GEMINI_VFX} from '/shared/gemini-skills.js';

const images=new Map();
export function preloadGemini(ids=Object.keys(GEMINI_VFX)){
  for(const id of ids){
    const spec=GEMINI_VFX[id];if(!spec||images.has(spec.url))continue;
    const image=new Image();image.src=spec.url;images.set(spec.url,image);
  }
}
export function drawGeminiProjectile(ctx,cast,elapsedMs,reducedMotion=false){
  if(!['gemini-attack','gemini-skill'].includes(cast.kind))return false;
  const spec=GEMINI_VFX[cast.vfxId];if(!spec)return false;
  preloadGemini([spec.id]);const image=images.get(spec.url);
  if(!image?.complete||!image.naturalWidth)return true;
  const progress=Math.max(0,Math.min(1,elapsedMs/(cast.durationMs||900)));
  const frame=reducedMotion?12:Math.min(23,Math.floor(progress*24));
  const scale=cast.basic?.95:cast.vfxId==='skill-lv2'?1.4:cast.vfxId==='skill-lv3'?1.6:1.85;
  const size=cast.size*scale;
  ctx.save();ctx.translate(cast.x,cast.y);ctx.rotate(Math.atan2(cast.dy??0,cast.dx??1));
  ctx.drawImage(image,(frame%6)*256,Math.floor(frame/6)*256,256,256,-size/2,-size/2,size,size);
  ctx.restore();return true;
}
