import {LIBRA_VFX} from '/shared/libra-skills.js';

const images=new Map();
function softDraw(ctx,draw,{alpha=1,blur=0}={}){
  ctx.save();
  ctx.globalAlpha*=alpha;
  if(blur){ctx.shadowColor='rgba(245,218,255,.55)';ctx.shadowBlur=blur;ctx.filter=`blur(${blur*.12}px) saturate(.82) brightness(.94)`;}
  draw();ctx.restore();
}
function frame(ctx,id,index,size){let image=images.get(id);
  if(!image){image=new Image();image.src=LIBRA_VFX[id].url;images.set(id,image);}
  if(!image.complete||!image.naturalWidth)return;
  softDraw(ctx,()=>ctx.drawImage(image,(index%6)*256,Math.floor(index/6)*256,256,256,-size/2,-size/2,size,size),{alpha:.86,blur:5});
}
export function drawLibraProjectile(ctx,cast,elapsedMs,reducedMotion=false){
  if(cast.kind!=='libra-attack')return false;
  ctx.save();ctx.translate(cast.x,cast.y);ctx.rotate(Math.atan2(cast.dy??0,cast.dx??1));
  frame(ctx,'attack',reducedMotion?12:Math.min(23,Math.floor(elapsedMs/(cast.durationMs||650)*24)),cast.size*.85);
  ctx.restore();return true;
}
export function drawLibraAura(ctx,aura,elapsedMs,reducedMotion=false){
  const opening=elapsedMs<500,closing=elapsedMs>aura.durationMs-500;
  const size=aura.size*4.3;
  if(aura.stage===2||aura.stage===3){
    const key=`clean-lv${aura.stage}`;let core=images.get(key);
    if(!core){core=new Image();core.src=`/assets/skills/libra/source/scale-lv${aura.stage}-clean.png`;images.set(key,core);}
    if(core.complete&&core.naturalWidth){
      const fade=Math.max(0,Math.min(1,elapsedMs/500,(aura.durationMs-elapsedMs)/500));
      const side=size*(aura.stage===3?.78:.73),ratio=core.naturalWidth/core.naturalHeight;
      const width=ratio>=1?side:side*ratio,height=ratio>=1?side/ratio:side;
      softDraw(ctx,()=>ctx.drawImage(core,-width/2,-height/2,width,height),{alpha:fade*fade*(3-2*fade)*.9,blur:4});
    }
    return;
  }
  if(!opening&&!closing){
    if(aura.stage===4){
      const key='lv4-core';let core=images.get(key);
      if(!core){core=new Image();core.src='/assets/skills/libra/source/scale-lv4-painted.png';images.set(key,core);}
      // 큰 실제 표시 크기에서도 사슬과 금빛 조각이 흐려지지 않도록 원해상도로 표시합니다.
      if(core.complete&&core.naturalWidth){softDraw(ctx,()=>ctx.drawImage(core,-size*106/256,-size*108/256,size*212/256,size*212/256),{alpha:.9,blur:4});return;}
    }
    frame(ctx,`skill-lv${aura.stage}`,12,size);
    return;
  }
  const index=reducedMotion?(opening?5:18):opening?Math.min(11,Math.floor(elapsedMs/500*12)):
    Math.min(23,18+Math.floor((elapsedMs-(aura.durationMs-500))/500*6));
  frame(ctx,`skill-lv${aura.stage}`,index,size);
}
