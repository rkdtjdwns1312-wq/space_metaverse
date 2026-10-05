import {OPHIUCHUS_VFX} from '/shared/ophiuchus-skills.js';

const images=new Map();
const venomLayers=new Map();
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
function venomLayer(spec,frame,part){
  const key=`${spec.id}:${frame}:${part}`;
  if(venomLayers.has(key))return venomLayers.get(key);
  const image=images.get(spec.url);
  if(!image?.complete||!image.naturalWidth)return null;
  const start=part==='snake'?0:160,width=part==='snake'?196:96;
  const canvas=document.createElement('canvas');canvas.width=width;canvas.height=256;
  const layer=canvas.getContext('2d');
  layer.drawImage(image,(frame%6)*256+start,Math.floor(frame/6)*256,width,256,0,0,width,256);
  // 원화의 잘린 가장자리를 부드럽게 지워 긴 독기와 자연스럽게 이어 붙입니다.
  layer.globalCompositeOperation='destination-in';
  const fade=layer.createLinearGradient(0,0,width,0);
  if(part==='snake'){
    fade.addColorStop(0,'#fff');fade.addColorStop(170/196,'#fff');fade.addColorStop(1,'#0000');
  }else{
    fade.addColorStop(0,'#fff');fade.addColorStop(.72,'#fff');fade.addColorStop(1,'#0000');
  }
  layer.fillStyle=fade;layer.fillRect(0,0,width,256);
  if(part==='plume'){
    // 일부 원화의 오른쪽 아래에는 뱀의 몸통까지 포함되어 있어 독기층에서 제외합니다.
    const fadeY=layer.createLinearGradient(0,0,0,256);
    fadeY.addColorStop(0,'#fff');fadeY.addColorStop(.60,'#fff');fadeY.addColorStop(.78,'#0000');fadeY.addColorStop(1,'#0000');
    layer.fillStyle=fadeY;layer.fillRect(0,0,width,256);
  }
  venomLayers.set(key,canvas);return canvas;
}
function drawVenomLayer(ctx,spec,frame,part,x,y,width,height,opacity){
  if(opacity<=0)return;
  const baseAlpha=ctx.globalAlpha;
  const first=Math.floor(frame),mix=frame-first;
  for(const [index,weight] of [[first,1-mix],[Math.min(23,first+1),mix]]){
    if(weight<=0)continue;
    const layer=venomLayer(spec,index,part);if(!layer)continue;
    ctx.globalAlpha=baseAlpha*opacity*weight;
    ctx.drawImage(layer,x,y,width,height);
  }
  ctx.globalAlpha=baseAlpha;
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
  const frame=reducedMotion?12:Math.min(23,Math.max(0,elapsedMs/4000*24));
  const image=images.get(spec.url);
  if(!image?.complete||!image.naturalWidth)return true;
  const snakeSize=hit.size*hit.snakeScale*1.35*.3;
  const start=hit.originOffset??hit.size*.6,end=start+hit.range;
  // 뱀은 시전자 바로 앞에 고정하고, 독기만 사거리 끝까지 한 줄기로 펼칩니다.
  const split=160,snakeX=start-snakeSize*.15;
  const plumeX=snakeX+snakeSize*split/256,plumeWidth=Math.max(0,end-plumeX);
  ctx.save();ctx.translate(hit.x,hit.y);
  if(hit.dx<0){ctx.scale(-1,1);ctx.rotate(Math.atan2(hit.dy,-hit.dx));}
  else ctx.rotate(Math.atan2(hit.dy,hit.dx));
  if(elapsedMs>=750&&elapsedMs<3600&&plumeWidth>0){
    const reach=reducedMotion?1:Math.min(1,(elapsedMs-750)/250);
    const fadeOut=reducedMotion?1:Math.min(1,(3600-elapsedMs)/900);
    const venomFrame=Math.max(frame,8);
    drawVenomLayer(ctx,spec,venomFrame,'plume',plumeX,-snakeSize/2,plumeWidth*reach,snakeSize,fadeOut);
  }
  drawVenomLayer(ctx,spec,frame,'snake',snakeX,-snakeSize/2,snakeSize*196/256,snakeSize,1);
  ctx.restore();return true;
}
