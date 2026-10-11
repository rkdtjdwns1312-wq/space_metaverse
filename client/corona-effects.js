import {CORONA_VFX} from '/shared/corona-skills.js';

const images=new Map();
const bodyAuras=new WeakMap();
const clamp=value=>Math.max(0,Math.min(1,value));
const smooth=value=>{const t=clamp(value);return t*t*(3-2*t);};
export function coronaOpacity(aura,elapsedMs){
  return Math.min(smooth(elapsedMs/1000),smooth((aura.durationMs-elapsedMs)/1000));
}
function frame(ctx,id,index,size){let image=images.get(id);
  if(!image){image=new Image();image.src=CORONA_VFX[id].url;images.set(id,image);}
  if(!image.complete||!image.naturalWidth)return;
  ctx.drawImage(image,(index%6)*256,Math.floor(index/6)*256,256,256,-size/2,-size/2,size,size);
}
export function drawCoronaProjectile(ctx,cast,elapsedMs,reducedMotion=false){
  if(cast.kind!=='corona-finale')return false;
  ctx.save();ctx.translate(cast.x,cast.y);ctx.rotate(Math.atan2(cast.dy??0,cast.dx??1));
  frame(ctx,'attack',reducedMotion?12:Math.min(23,Math.floor(elapsedMs/(cast.durationMs||650)*24)),cast.size*(cast.visualScale||2));
  ctx.restore();return true;
}
export function drawCoronaAttack(ctx,hit,elapsedMs,reducedMotion=false){
  if(hit.kind!=='corona-attack')return false;
  ctx.save();ctx.translate(hit.x,hit.y);
  if(hit.dx<0){ctx.scale(-1,1);ctx.rotate(Math.atan2(hit.dy,-hit.dx));}
  else ctx.rotate(Math.atan2(hit.dy,hit.dx));
  const id='attack',image=images.get(id)||new Image();
  if(!images.has(id)){image.src=CORONA_VFX[id].url;images.set(id,image);}
  if(image.complete&&image.naturalWidth){
    const index=reducedMotion?12:Math.min(23,Math.floor(elapsedMs/(hit.durationMs||500)*24));
    const near=hit.size*.18,far=hit.reach+hit.size*.48,height=hit.size*1.3;
    ctx.drawImage(image,(index%6)*256,Math.floor(index/6)*256,256,256,near,-height/2,far-near,height);
  }
  ctx.restore();return true;
}
export function drawCoronaAura(ctx,aura,elapsedMs,reducedMotion=false){
  const size=aura.size*(aura.stage===2?.72:aura.stage===3?.84:.96);
  const id=`crown-lv${aura.stage}`;
  if(!images.has(id)){const image=new Image();image.src=`/assets/skills/corona-borealis/${id}.png`;images.set(id,image);}
  const image=images.get(id);if(!image.complete||!image.naturalWidth)return;
  // 기존 단계별 왕관 원화를 머리 위 아이콘 크기로 표시하고 몸 오라는 별도 렌더러에 둡니다.
  const height=size*image.naturalHeight/image.naturalWidth,opacity=coronaOpacity(aura,elapsedMs);
  ctx.save();ctx.globalAlpha*=opacity;ctx.drawImage(image,-size/2,-aura.size*.55-height,size,height);ctx.restore();
}
export function drawCoronaBodyAura(ctx,sprite,aura,elapsedMs,size,reducedMotion=false){
  if(!sprite)return;
  let layer=bodyAuras.get(sprite);
  if(!layer){
    const tint=document.createElement('canvas');tint.width=tint.height=256;
    const tc=tint.getContext('2d');tc.drawImage(sprite,0,0,256,256);
    tc.globalCompositeOperation='source-in';tc.fillStyle='#ee3457';tc.fillRect(0,0,256,256);
    layer=document.createElement('canvas');layer.width=layer.height=320;
    const lc=layer.getContext('2d');lc.shadowColor='#d91946';lc.shadowBlur=13;lc.globalAlpha=.32;
    for(let i=0;i<12;i++){const a=i*Math.PI/6;lc.drawImage(tint,32+Math.cos(a)*5,32+Math.sin(a)*5);}
    lc.shadowBlur=0;lc.globalAlpha=1;lc.globalCompositeOperation='destination-out';lc.drawImage(sprite,32,32,256,256);
    bodyAuras.set(sprite,layer);
  }
  const breathing=reducedMotion?1:.87+.10*Math.sin(elapsedMs/700);
  ctx.save();ctx.globalAlpha*=coronaOpacity(aura,elapsedMs)*breathing;
  ctx.drawImage(layer,-size*.625,-size*.625,size*1.25,size*1.25);ctx.restore();
}
export function drawCoronaFall(ctx,fall,elapsedMs,reducedMotion=false){
  const progress=Math.min(1,elapsedMs/350);
  ctx.save();ctx.translate(fall.x,fall.y-70*(1-progress));
  ctx.rotate(Math.PI/2);
  frame(ctx,'attack',reducedMotion?12:Math.min(23,Math.floor(progress*24)),fall.size*.9);
  ctx.restore();
}
