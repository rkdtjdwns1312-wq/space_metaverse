import {WATER_VFX,waterFrameAt,cetusAuraFrameAt,waterProjectileAngle} from '/shared/water-skills.js';

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
  const frame=reducedMotion?12:Math.min(23,progress*23);
  const scale=cast.visualScale||1,size=cast.size*(star==='cetus'?1.55:1.2)*scale;
  ctx.save();ctx.translate(cast.x,cast.y);
  const angle=cast.kind==='pisces-skill'?cast.visualAngle:waterProjectileAngle(cast);
  if((cast.dx??1)<0){ctx.scale(-1,1);ctx.rotate(Math.PI-angle);}
  else ctx.rotate(angle);
  const fade=Math.min(1,progress/.1,(1-progress)/.13);
  if(star==='cetus'){
    // 파도가 솟고 가라앉는 동안 수면은 한자리에 남아 프레임 사이 형태를 이어 줍니다.
    ctx.save();ctx.globalAlpha*=Math.max(0,fade*.48);
    ctx.strokeStyle='#76d9ff';ctx.shadowColor='#4bb7ff';ctx.shadowBlur=10;
    ctx.lineWidth=Math.max(1.5,size*.018);
    ctx.beginPath();ctx.ellipse(0,size*.31,size*(.23+(reducedMotion ? .65 : progress)*.17),size*.042,0,0,Math.PI*2);ctx.stroke();
    ctx.restore();
  }
  sprite(ctx,spec,frame,0,0,size,size,reducedMotion?Math.sin(Math.PI*progress)*.7:fade);
  ctx.restore();return true;
}
export function drawWaterAura(ctx,aura,x,y,size,reducedMotion=false){
  const spec=WATER_VFX[aura.kind]?.[`skill-lv${aura.stage}`];if(!spec)return;
  preloadWater(aura.kind,[spec.id]);
  const frame=reducedMotion?12:aura.kind==='cetus'?cetusAuraFrameAt(aura.elapsedMs):waterFrameAt(aura.elapsedMs,aura.durationMs);
  // 물빛은 캐릭터 뒤에 배치됩니다. 고래는 2배가 된 몸을 감싸도록 더 넓게 그립니다.
  const width=size*(aura.kind==='cetus'?2.55:2.35);
  const above=aura.kind==='cancer'?size*.58:size*.12;
  const opacity=Math.max(0,Math.min(1,aura.elapsedMs/450,(aura.durationMs-aura.elapsedMs)/450));
  if(aura.kind==='cetus'){
    // 그림의 청색 실루엣처럼 몸 뒤쪽에서만 여러 갈래의 물빛이 아른거립니다.
    ctx.save();ctx.globalAlpha*=opacity;
    ctx.translate(x,y);ctx.globalCompositeOperation='screen';
    const t=reducedMotion?0:aura.elapsedMs/1000;
    for(let i=0;i<7;i++){
      const side=i%2?-1:1,rank=Math.floor(i/2),shift=Math.sin(t*2.2+i*1.7);
      const rootX=side*size*(.19+rank*.095),rootY=size*(.32-rank*.07);
      const tipX=rootX+side*size*(.14+shift*.055),tipY=-size*(.42+rank*.035)+shift*size*.09;
      const gradient=ctx.createLinearGradient(rootX,rootY,tipX,tipY);
      gradient.addColorStop(0,'#4acaff00');gradient.addColorStop(.48,'#72d9ff9e');gradient.addColorStop(1,'#b8efff00');
      ctx.strokeStyle=gradient;ctx.lineWidth=size*(.09+rank*.014);ctx.lineCap='round';
      ctx.shadowColor='#57caff';ctx.shadowBlur=size*.1;
      ctx.beginPath();ctx.moveTo(rootX,rootY);
      ctx.bezierCurveTo(rootX+side*size*.22,-size*.04,tipX-side*size*.13,-size*.28,tipX,tipY);ctx.stroke();
    }
    ctx.restore();
  }
  sprite(ctx,spec,frame,x,y-above,width,width,opacity);
}
