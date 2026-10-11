import {OPHIUCHUS_VFX,ophiuchusAreaAt} from '/shared/ophiuchus-skills.js';

const images=new Map(),layers=new Map();
function imageOf(url){
  if(!images.has(url)){const image=new Image();image.src=url;images.set(url,image);}
  return images.get(url);
}
export function preloadOphiuchus(){
  return [imageOf(OPHIUCHUS_VFX.attack.url),...[2,3,4].map(n=>imageOf(`/assets/skills/ophiuchus/poison-lv${n}.png`))];
}
export function drawOphiuchusProjectile(ctx,cast,elapsedMs,reducedMotion=false){
  if(cast.kind!=='ophiuchus-attack')return false;
  const spec=OPHIUCHUS_VFX.attack,image=imageOf(spec.url);
  if(!image.complete||!image.naturalWidth)return true;
  const progress=Math.max(0,Math.min(1,elapsedMs/(cast.durationMs||650)));
  const frame=reducedMotion?12:Math.min(23,Math.floor(progress*24)),size=cast.size*1.3;
  ctx.save();ctx.translate(cast.x,cast.y);ctx.rotate(Math.atan2(cast.dy??0,cast.dx??1));
  ctx.shadowColor='#a954ef';ctx.shadowBlur=12;
  ctx.drawImage(image,frame%6*256,Math.floor(frame/6)*256,256,256,-size/2,-size/2,size,size);
  ctx.restore();return true;
}
function cloudLayer(stage){
  if(layers.has(stage))return layers.get(stage);
  const image=imageOf(`/assets/skills/ophiuchus/poison-lv${stage}.png`);
  if(!image.complete||!image.naturalWidth)return null;
  const c=document.createElement('canvas');c.width=512;c.height=256;const g=c.getContext('2d');
  g.drawImage(image,0,0,512,256);
  // Every cloud reaches the hit ellipse gently, with no rectangular sprite edge.
  g.globalCompositeOperation='destination-in';g.translate(256,128);g.scale(1,.5);
  const mask=g.createRadialGradient(0,0,0,0,0,256);
  mask.addColorStop(0,'#fff');mask.addColorStop(.68,'#fff');mask.addColorStop(1,'#fff0');
  g.fillStyle=mask;g.fillRect(-256,-256,512,512);layers.set(stage,c);return c;
}
export function drawOphiuchusZone(ctx,cast,elapsedMs,reducedMotion=false){
  const area=ophiuchusAreaAt(cast,elapsedMs),{rx,ry,scale}=area;
  if(scale<=0)return;
  const stage=Math.max(2,Math.min(4,cast.stage||2)),cloud=cloudLayer(stage),time=reducedMotion?0:elapsedMs/1000;
  ctx.save();ctx.translate(area.x,area.y);ctx.beginPath();ctx.ellipse(0,0,rx,ry,0,0,Math.PI*2);ctx.clip();
  ctx.globalAlpha*=Math.min(1,scale*2);
  ctx.save();ctx.scale(1,ry/rx);
  const mist=ctx.createRadialGradient(0,0,0,0,0,rx);
  mist.addColorStop(0,stage===4?'#50208090':'#673a9970');mist.addColorStop(.7,'#8245b55c');mist.addColorStop(1,'#ad80e000');
  ctx.fillStyle=mist;ctx.fillRect(-rx,-rx,rx*2,rx*2);ctx.restore();
  if(cloud){
    ctx.drawImage(cloud,-rx,-ry,rx*2,ry*2);
    // Drifting wisps retain the painted detail throughout the ten-second hold.
    for(let i=0;i<stage+1;i++){
      const angle=i*2.39996,x=Math.cos(angle)*rx*.44+Math.sin(time*.6+i)*rx*.025;
      const y=Math.sin(angle)*ry*.35-Math.sin(time*.8+i)*ry*.06;
      ctx.save();ctx.globalAlpha*=.24+.08*Math.sin(time*.7+i)**2;
      ctx.drawImage(cloud,x-rx*.4,y-ry*.5,rx*.8,ry*.8);ctx.restore();
    }
  }
  for(let i=0;i<stage*5;i++){
    const phase=reducedMotion?.5:(time/3.5+i*.618034)%1,angle=i*2.39996,r=.18+(i%5)*.145;
    const x=Math.cos(angle)*rx*r,y=Math.sin(angle)*ry*r-phase*ry*.12;
    const a=Math.sin(phase*Math.PI),s=(1.2+i%3*.35)*scale;
    ctx.save();ctx.globalAlpha*=a*.7;ctx.strokeStyle=stage===4?'#dbff80':'#b5e894';ctx.lineWidth=.8;
    ctx.beginPath();ctx.arc(x,y,s,0,Math.PI*2);ctx.stroke();ctx.restore();
  }
  ctx.restore();
}
export function createOphiuchusEffects(canvas){
  let active=[];
  return {
    clear(){active=[];canvas.dataset.ophiuchusZones='0';},
    sync(list){const now=performance.now(),old=new Map(active.map(c=>[c.id,c]));active=list.map(c=>{
      const previous=old.get(c.id),expected=now-c.elapsedMs;
      return {...c,startsAt:previous&&Math.abs(previous.startsAt-expected)<150?previous.startsAt:expected};
    });},
    draw(ctx,now,reducedMotion){
      active=active.filter(c=>now-c.startsAt<c.durationMs);
      for(const c of active)drawOphiuchusZone(ctx,c,now-c.startsAt,reducedMotion);
      canvas.dataset.ophiuchusZones=String(active.length);
    }
  };
}
