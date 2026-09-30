import {AQUARIUS_VFX,aquariusFrameAt} from '/shared/aquarius-skills.js';
const images=new Map();
export function preloadAquarius(){
  for(const spec of Object.values(AQUARIUS_VFX))if(!images.has(spec.id)){
    const image=new Image();image.src=spec.url;images.set(spec.id,image);
  }
}
export function drawAquarius(ctx,cast,elapsedMs,reducedMotion=false){
  if(!cast.kind?.startsWith('aquarius-'))return false;
  const spec=AQUARIUS_VFX[cast.vfxId];if(!spec)return false;
  preloadAquarius();const image=images.get(spec.id);
  if(!image?.complete||!image.naturalWidth)return true;
  const basic=cast.kind==='aquarius-attack',frame=reducedMotion?12:aquariusFrameAt(elapsedMs,basic);
  // 물병은 방향에 따라 눕히지 않고, 지면 타원과 같은 중심에서 똑바로 쏟아집니다.
  const width=basic?cast.size*1.2:cast.rx*2.5,height=width;
  ctx.save();ctx.translate(cast.x,cast.y);
  if(!basic){
    // 원화 아래의 은은한 물빛이 서버 판정 타원과 정확히 같은 범위를 안내합니다.
    ctx.save();ctx.scale(cast.rx,cast.ry);
    const glow=ctx.createRadialGradient(0,0,0,0,0,1);
    glow.addColorStop(0,'#b4f1ff36');glow.addColorStop(.8,'#57caff24');glow.addColorStop(1,'#57caff00');
    ctx.fillStyle=glow;ctx.globalAlpha=Math.max(0,Math.min(1,elapsedMs/500,(cast.durationMs-elapsedMs)/500));
    ctx.fillRect(-1,-1,2,2);ctx.restore();
  }
  if(basic)ctx.rotate(Math.atan2(cast.dy,cast.dx));
  if(reducedMotion)ctx.globalAlpha=Math.min(1,elapsedMs/150,(cast.durationMs-elapsedMs)/250);
  ctx.drawImage(image,(frame%6)*256,Math.floor(frame/6)*256,256,256,-width*spec.anchor.x,-height*spec.anchor.y,width,height);
  ctx.restore();return true;
}
export function createAquariusEffects(canvas){
  let active=[];
  return {
    clear(){active=[];},
    sync(list){const now=performance.now(),old=new Map(active.map(c=>[c.id,c]));active=list.map(c=>{
      const previous=old.get(c.id),expected=now-c.elapsedMs;
      return {...c,startsAt:previous&&Math.abs(previous.startsAt-expected)<150?previous.startsAt:expected};
    });},
    draw(ctx,now,reducedMotion){
      active=active.filter(c=>now-c.startsAt<c.durationMs);
      for(const c of active)drawAquarius(ctx,c,now-c.startsAt,reducedMotion);
      canvas.dataset.aquariusCasts=String(active.length);
      if(active.length)canvas.dataset.aquariusFrame=String(aquariusFrameAt(now-active[0].startsAt));
    }
  };
}
