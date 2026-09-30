import {CORVUS_VFX} from '/shared/character-skills.js';

const images=new Map();
export function preloadCorvus(ids=Object.keys(CORVUS_VFX)){
  for(const spec of ids.map(id=>CORVUS_VFX[id]).filter(Boolean))if(!images.has(spec.id)){
    const image=new Image();image.src=spec.url;images.set(spec.id,image);
  }
}
// 화면 배율·방향만 적용합니다. 시트의 모든 프레임은 같은 크기와 중심점을 씁니다.
export function drawCorvus(ctx,hit,progress,reducedMotion=false){
  const spec=CORVUS_VFX[hit.vfxId];if(!spec)return false;
  preloadCorvus([spec.id]);const image=images.get(spec.id);
  if(!image?.complete||!image.naturalWidth)return true;
  const frame=reducedMotion?12:Math.min(23,Math.max(0,Math.floor(progress*24)));
  const size=(hit.originOffset||40)*(hit.vfxId==='attack'?2.5:4);
  const reach=hit.projectile?0:(hit.vfxId==='attack'?(hit.range||hit.reach||62)*Math.min(1,progress*2):(hit.range||hit.originOffset||40)*progress);
  ctx.save();ctx.translate(hit.x+hit.dx*reach,hit.y+hit.dy*reach);
  if(hit.vfxId==='attack')ctx.rotate(Math.atan2(hit.dy,hit.dx)+Math.PI/4);
  if(reducedMotion)ctx.globalAlpha=Math.sin(Math.PI*progress)*.65;
  ctx.drawImage(image,(frame%6)*spec.frameSize,Math.floor(frame/6)*spec.frameSize,spec.frameSize,spec.frameSize,-size/2,-size/2,size,size);
  ctx.restore();return true;
}
