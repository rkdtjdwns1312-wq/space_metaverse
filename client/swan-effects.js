import {SWAN_VFX,swanFrameAt} from '/shared/swan-skills.js';

const images=new Map();
export function preloadSwan(ids=Object.keys(SWAN_VFX)){
  for(const id of ids){
    const spec=SWAN_VFX[id];if(!spec||images.has(spec.url))continue;
    const image=new Image();image.src=spec.url;images.set(spec.url,image);
  }
}
function drawFrame(ctx,spec,frame,x,y,size){
  const image=images.get(spec.url);
  if(!image?.complete||!image.naturalWidth)return;
  ctx.drawImage(image,(frame%6)*256,Math.floor(frame/6)*256,256,256,x-size/2,y-size/2,size,size);
}
export function drawSwanProjectile(ctx,cast,elapsedMs,reducedMotion=false){
  if(cast.kind!=='cygnus-attack')return false;
  const spec=SWAN_VFX.attack;preloadSwan(['attack']);
  const progress=Math.max(0,Math.min(1,elapsedMs/(cast.durationMs||650)));
  const frame=reducedMotion?12:Math.min(23,Math.floor(progress*24));
  const size=cast.size*.82*(cast.visualScale||1);
  ctx.save();ctx.translate(cast.x,cast.y);
  if((cast.dx??1)<0){ctx.scale(-1,1);ctx.rotate(Math.atan2(cast.dy??0,-cast.dx));}
  else ctx.rotate(Math.atan2(cast.dy??0,cast.dx??1));
  ctx.shadowColor='#a8c8ff';ctx.shadowBlur=cast.visualScale>1?24:8;
  drawFrame(ctx,spec,frame,0,0,size);
  ctx.restore();return true;
}
export function drawSwanAura(ctx,aura,x,y,size,reducedMotion=false){
  const spec=SWAN_VFX[`skill-lv${aura.stage}`];if(!spec)return;
  preloadSwan([spec.id,'skill-lv2']);
  const elapsed=Math.max(0,aura.elapsedMs);
  const frame=reducedMotion?12:swanFrameAt(elapsed,aura.durationMs);
  const width=size*(aura.stage===2?2.2:aura.stage===3?2.55:2.95);
  ctx.save();ctx.globalAlpha*=reducedMotion?.78:1;
  // 각 단계 원화에 1/2/3쌍이 이미 포함되어 있어 중복 날개를 겹치지 않습니다.
  drawFrame(ctx,spec,frame,x,y-size*.36,width);
  ctx.restore();
}
