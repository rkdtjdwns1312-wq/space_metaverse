import {WATER_VFX,waterFrameAt,cetusWaveScaleAt,waterProjectileAngle} from '/shared/water-skills.js';

const images=new Map();
export function preloadWater(star,ids=Object.keys(WATER_VFX[star]||{})){
  for(const id of ids){
    const spec=WATER_VFX[star]?.[id];if(!spec||images.has(spec.url))continue;
    const image=new Image();image.src=spec.url;images.set(spec.url,image);
  }
}
function sprite(ctx,spec,frame,x,y,width,height,alpha=1){
  const image=images.get(spec.url);
  if(!image?.complete||!image.naturalWidth)return;
  const first=Math.max(0,Math.min(23,Math.floor(frame))),blend=Math.max(0,Math.min(1,frame-first));
  ctx.save();const baseAlpha=ctx.globalAlpha;ctx.globalAlpha=baseAlpha*alpha*(1-blend);
  ctx.drawImage(image,(first%6)*256,Math.floor(first/6)*256,256,256,x-width/2,y-height/2,width,height);
  if(blend&&first<23){ctx.globalAlpha=baseAlpha*alpha*blend;
    ctx.drawImage(image,((first+1)%6)*256,Math.floor((first+1)/6)*256,256,256,x-width/2,y-height/2,width,height);}
  ctx.restore();
}
export function drawWaterProjectile(ctx,cast,elapsedMs,reducedMotion=false){
  const star=cast.kind?.split('-')[0],spec=WATER_VFX[star]?.[star==='pisces'&&cast.kind==='pisces-skill'?'skill-lv4':cast.vfxId];
  if(!spec)return false;
  preloadWater(star,[spec.id]);
  const progress=Math.max(0,Math.min(1,elapsedMs/(cast.durationMs||650)));
  const frame=star==='cetus'?9:reducedMotion?12:Math.min(23,progress*23);
  const scale=cast.visualScale||1,size=cast.size*(star==='cetus'?1.55:1.2)*scale;
  ctx.save();ctx.translate(cast.x,cast.y);
  const angle=cast.kind==='pisces-skill'?cast.visualAngle:waterProjectileAngle(cast);
  if((cast.dx??1)<0){ctx.scale(-1,1);ctx.rotate(Math.PI-angle);}
  else ctx.rotate(angle);
  const fade=Math.min(1,progress/.1,(1-progress)/.13);
  if(star==='cetus'){
    const waveSize=size*cetusWaveScaleAt(progress);
    sprite(ctx,spec,frame,0,0,waveSize,waveSize,Math.min(1,progress/.08,(1-progress)/.08));
  }else sprite(ctx,spec,frame,0,0,size,size,reducedMotion?Math.sin(Math.PI*progress)*.7:fade);
  ctx.restore();return true;
}
export function drawWaterAura(ctx,aura,x,y,size,reducedMotion=false){
  const spec=WATER_VFX[aura.kind]?.[`skill-lv${aura.stage}`];if(!spec)return;
  preloadWater(aura.kind,[spec.id]);
  const frame=reducedMotion?12:waterFrameAt(aura.elapsedMs,aura.durationMs);
  // 물빛은 캐릭터 뒤에 배치됩니다. 고래는 2배가 된 몸을 감싸도록 더 넓게 그립니다.
  const width=size*2.35;
  const above=aura.kind==='cancer'?size*.58:size*.12;
  const opacity=Math.max(0,Math.min(1,aura.elapsedMs/450,(aura.durationMs-aura.elapsedMs)/450));
  sprite(ctx,spec,frame,x,y-above,width,width,opacity);
}
