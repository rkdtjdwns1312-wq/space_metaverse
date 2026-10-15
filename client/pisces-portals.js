import {piscesPortalGeometry} from '/shared/pisces-portals.js';
let fish,swim,waterPortal;
function loadFish(){if(!fish){fish=new Image();fish.src='/assets/skills/pisces/portal-fish.png';}return fish;}
export function preloadPiscesSwim(){
  if(!swim){swim=new Image();swim.src='/assets/skills/pisces/swim/swim-48f.png';}
  return [loadFish(),swim,loadWaterPortal()];
}
export function piscesSwimFrameAt(elapsedMs,index=0){return Math.floor(((elapsedMs/1000+index*.21)%1+1)%1*48);}
const smooth=x=>{x=Math.max(0,Math.min(1,x));return x*x*(3-2*x);};
function portal(ctx,x,r,time,opacity,front=false,reducedMotion=false){
  ctx.save();ctx.translate(x,0);ctx.globalAlpha*=opacity;
  const image=loadWaterPortal();
  if(image.complete&&image.naturalWidth){
    // Render the painterly water-hole sprite in the same oriented oval aperture.
    // The front pass draws only its foamy lip so the swimming fish stays visible.
    ctx.save();ctx.beginPath();ctx.ellipse(0,0,r*.69,r*1.02,-.10,0,Math.PI*2);
    if(front){ctx.ellipse(0,0,r*.49,r*.80,-.10,0,Math.PI*2,'evenodd');ctx.clip('evenodd');}
    else ctx.clip();
    ctx.drawImage(image,-r*.82,-r*1.16,r*1.64,r*2.32);
    ctx.restore();
  }
  ctx.restore();
}
function loadWaterPortal(){if(!waterPortal){waterPortal=new Image();waterPortal.src='/assets/skills/pisces/water-portal.png';}return waterPortal;}
export function drawPiscesPortalPair(ctx,cast,elapsedMs,reducedMotion=false,front=false){
  const g=piscesPortalGeometry(cast),duration=2000;
  const opacity=smooth(elapsedMs/120)*(1-smooth((elapsedMs-duration+140)/140));
  ctx.save();ctx.translate(cast.x,cast.y);ctx.rotate(Math.atan2(cast.dy??0,cast.dx??1));
  for(const x of [g.start,g.end])portal(ctx,x,g.portalRadius,reducedMotion?0:elapsedMs,opacity,front,reducedMotion);
  ctx.restore();
}
export function drawPiscesPortalFish(ctx,cast,elapsedMs,reducedMotion=false){
  const [image,swimming]=preloadPiscesSwim(),g=piscesPortalGeometry(cast,elapsedMs/cast.durationMs);
  const angle=Math.atan2(cast.dy??0,cast.dx??1);
  ctx.save();ctx.translate(cast.sourceX??cast.x,cast.sourceY??cast.y);ctx.rotate(angle);
  ctx.save();ctx.beginPath();ctx.rect(g.start,-g.height,g.end-g.start,g.height*2);ctx.clip();
  if(image.complete&&image.naturalWidth){
    ctx.save();ctx.translate(g.center,0);
    // 왼쪽에서도 등/배가 뒤집히지 않게 물고기만 세로반전으로 회전 보정합니다.
    if((cast.dx??1)<0)ctx.scale(1,-1);
    if(!reducedMotion&&swimming.complete&&swimming.naturalWidth){
      const frame=piscesSwimFrameAt(elapsedMs,cast.fishIndex||0);
      ctx.drawImage(swimming,frame%8*384,Math.floor(frame/8)*192,384,192,-g.length/2,-g.height/2,g.length,g.height);
    }else ctx.drawImage(image,-g.length/2,-g.height/2,g.length,g.height);
    ctx.restore();
  }
  ctx.restore();
  ctx.restore();return true;
}
