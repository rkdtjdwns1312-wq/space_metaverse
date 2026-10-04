import {LEO_VFX} from '/shared/leo-skills.js';
const images=new Map();
const softened=new Map();
function softFrame(image,id,index){
  const key=`${id}:${index}`;if(softened.has(key))return softened.get(key);
  const canvas=document.createElement('canvas');canvas.width=canvas.height=256;
  const layer=canvas.getContext('2d');
  layer.drawImage(image,(index%6)*256,Math.floor(index/6)*256,256,256,0,0,256,256);
  layer.globalCompositeOperation='destination-in';
  const falloff=layer.createRadialGradient(128,122,75,128,122,140);
  falloff.addColorStop(0,'#fff');falloff.addColorStop(.48,'#fff');falloff.addColorStop(1,'#fff0');
  layer.fillStyle=falloff;layer.fillRect(0,0,256,256);
  softened.set(key,canvas);return canvas;
}
function frame(ctx,id,index,size){let image=images.get(id);
  if(!image){image=new Image();image.src=LEO_VFX[id].url;images.set(id,image);}
  if(!image.complete||!image.naturalWidth)return;
  const first=Math.max(0,Math.min(23,Math.floor(index))),blend=Math.max(0,Math.min(1,index-first));
  ctx.save();const baseAlpha=ctx.globalAlpha;ctx.globalAlpha=baseAlpha*(1-blend);
  if(id==='attack')ctx.drawImage(image,(first%6)*256,Math.floor(first/6)*256,256,256,-size/2,-size/2,size,size);
  else ctx.drawImage(softFrame(image,id,first),-size/2,-size/2,size,size);
  if(blend&&first<23){ctx.globalAlpha=baseAlpha*blend;
    if(id==='attack')ctx.drawImage(image,((first+1)%6)*256,Math.floor((first+1)/6)*256,256,256,-size/2,-size/2,size,size);
    else ctx.drawImage(softFrame(image,id,first+1),-size/2,-size/2,size,size);}
  ctx.restore();
}
export function drawLeoAttack(ctx,hit,elapsedMs,reducedMotion=false){
  if(hit.kind!=='leo-attack')return false;
  ctx.save();ctx.translate(hit.x+hit.dx*hit.reach,hit.y+hit.dy*hit.reach);
  if(hit.dx<0){ctx.scale(-1,1);ctx.rotate(Math.atan2(hit.dy,-hit.dx));}
  else ctx.rotate(Math.atan2(hit.dy,hit.dx));
  const progress=Math.min(1,elapsedMs/(hit.durationMs||500));
  // 원본 첫 세 장의 얇은 금빛 할퀴기만 사용합니다. 이후 프레임의 사자 형상은 스킬용입니다.
  frame(ctx,'attack',reducedMotion?2:1+Math.min(1,progress*3),hit.size*1.2);
  ctx.globalAlpha=.3*(1-progress);
  ctx.translate(-hit.size*.14,0);
  frame(ctx,'attack',2,hit.size*1.2);
  ctx.restore();return true;
}
export function drawLeoRoar(ctx,roar,elapsedMs,reducedMotion=false){
  const duration=roar.durationMs||3000,elapsed=Math.max(0,Math.min(duration,elapsedMs));
  const appear=duration*.42,fade=duration*.75;
  const index=reducedMotion?14:elapsed<appear?14*elapsed/appear:
    elapsed<fade?14:14+9*(elapsed-fade)/(duration-fade);
  const opacity=reducedMotion?1:Math.min(1,elapsed/180,(duration-elapsed)/230);
  ctx.save();ctx.translate(roar.x,roar.y);ctx.globalAlpha*=Math.max(0,opacity);
  // 소환이 끝난 뒤에는 사자 프레임을 고정하고 입에서 황금빛 포효만 퍼집니다.
  frame(ctx,`skill-lv${roar.stage}`,index,roar.size*2.8);
  if(!reducedMotion&&elapsed>=appear-100&&elapsed<fade){
    const mouthX=roar.size*.12,mouthY=-roar.size*.14;
    const waveStart=appear-100,travel=duration*12/23-waveStart;
    ctx.save();ctx.translate(mouthX,mouthY);
    ctx.shadowColor='#ffcd65';ctx.shadowBlur=12;
    for(let i=0;i<3;i++){
      const phase=(elapsed-waveStart-i*310)/travel;
      if(phase<0||phase>1.3)continue;
      const wave=Math.min(1,phase),tail=phase>1?(1.3-phase)/.3:1;
      ctx.strokeStyle=`rgba(255,229,140,${(.7-i*.13)*tail*(1-wave*.35)})`;
      ctx.lineWidth=Math.max(2,roar.size*.055*(1-wave*.5));
      ctx.beginPath();ctx.ellipse(0,0,Math.max(2,roar.rx*wave),Math.max(2,roar.ry*wave),0,0,Math.PI*2);ctx.stroke();
    }
    ctx.restore();
  }
  ctx.restore();
}
