import {OPHIUCHUS_VFX,ophiuchusFrameAt} from '/shared/ophiuchus-skills.js';

const images=new Map();
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
  const frame=reducedMotion?12:ophiuchusFrameAt(elapsedMs);
  const image=images.get(spec.url);
  if(!image?.complete||!image.naturalWidth)return true;
  const snakeSize=hit.size*hit.snakeScale*1.35*.3;
  const start=hit.originOffset??hit.size*.6,end=start+hit.range;
  const frameX=(frame%6)*256,frameY=Math.floor(frame/6)*256;
  // 시트의 왼쪽 뱀은 캐릭터 바로 앞에 고정하고, 오른쪽 독기만 사거리까지 펼칩니다.
  const split=180,snakeX=start-snakeSize*.15;
  const plumeX=snakeX+snakeSize*split/256,plumeWidth=Math.max(0,end-plumeX);
  ctx.save();ctx.translate(hit.x,hit.y);
  if(hit.dx<0){ctx.scale(-1,1);ctx.rotate(Math.atan2(hit.dy,-hit.dx));}
  else ctx.rotate(Math.atan2(hit.dy,hit.dx));
  ctx.drawImage(image,frameX,frameY,256,256,snakeX,-snakeSize/2,snakeSize,snakeSize);
  if(elapsedMs>=750&&elapsedMs<3000&&plumeWidth>0){
    const reach=reducedMotion?1:Math.min(1,(elapsedMs-750)/250);
    const venomFrame=Math.max(frame,8),venomX=(venomFrame%6)*256,venomY=Math.floor(venomFrame/6)*256;
    ctx.save();ctx.beginPath();ctx.rect(plumeX,-snakeSize/2,plumeWidth*reach,snakeSize);ctx.clip();
    ctx.drawImage(image,venomX+split,venomY,256-split,256,plumeX,-snakeSize/2,plumeWidth,snakeSize);
    ctx.restore();
  }
  ctx.restore();return true;
}
