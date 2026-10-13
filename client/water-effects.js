import {WATER_VFX,waterFrameAt,cetusWavePoseAt,waterProjectileAngle} from '/shared/water-skills.js';
import {drawPiscesBullet,preloadPiscesBullet} from './pisces-bullet.js';
import {drawPiscesPortalFish,preloadPiscesSwim} from './pisces-portals.js';

const images=new Map();
const cancerCrabSpecs=Object.freeze({
  2:{url:'/assets/skills/cancer/source/crab-lv2-clean.png',bounds:[17,19,1231,1219]},
  3:{url:'/assets/skills/cancer/source/crab-lv3-clean.png',bounds:[0,8,1230,1246]},
  4:{url:'/assets/skills/cancer/source/crab-lv4-clean.png',bounds:[0,0,1248,1254]}
});
const cancerCrabImages=new Map();
function cancerCrabImage(stage){
  const asset=cancerCrabSpecs[stage];if(!asset)return null;
  if(!cancerCrabImages.has(stage)){const image=new Image();image.src=asset.url;cancerCrabImages.set(stage,image);}
  return {image:cancerCrabImages.get(stage),...asset};
}
export function preloadWater(star,ids=Object.keys(WATER_VFX[star]||{})){
  if(star==='pisces'){preloadPiscesBullet();preloadPiscesSwim();}
  for(const id of ids){
    const spec=WATER_VFX[star]?.[id];if(!spec||images.has(spec.url))continue;
    const image=new Image();image.src=spec.url;images.set(spec.url,image);
  }
}
function sprite(ctx,spec,frame,x,y,width,height,alpha=1){
  const image=images.get(spec.url);
  if(!image?.complete||!image.naturalWidth)return;
  const last=spec.frames-1,side=spec.frameSize,columns=spec.columns;
  const first=Math.max(0,Math.min(last,Math.floor(frame))),blend=Math.max(0,Math.min(1,frame-first));
  ctx.save();const baseAlpha=ctx.globalAlpha;ctx.globalAlpha=baseAlpha*alpha*(1-blend);
  ctx.drawImage(image,(first%columns)*side,Math.floor(first/columns)*side,side,side,x-width/2,y-height/2,width,height);
  if(blend&&first<last){ctx.globalAlpha=baseAlpha*alpha*blend;
    ctx.drawImage(image,((first+1)%columns)*side,Math.floor((first+1)/columns)*side,side,side,x-width/2,y-height/2,width,height);}
  ctx.restore();
}
export function drawWaterProjectile(ctx,cast,elapsedMs,reducedMotion=false){
  if(cast.kind==='pisces-attack')return drawPiscesBullet(ctx,cast,elapsedMs,reducedMotion);
  if(cast.kind==='pisces-skill'&&cast.piscesPortal)return drawPiscesPortalFish(ctx,cast,elapsedMs,reducedMotion);
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
    const wave=cetusWavePoseAt(progress);
    // 오른쪽을 향한 새 원화를 사용하며 좌우 반전은 위의 공통 방향 처리에서 한 번만 합니다.
    ctx.translate(0,cast.size*.22);
    sprite(ctx,spec,wave.frame,0,-size*(215/256-.5),size,size,Math.min(1,progress/.06,(1-progress)/.14));
  }else sprite(ctx,spec,frame,0,0,size,size,reducedMotion?Math.sin(Math.PI*progress)*.7:fade);
  ctx.restore();return true;
}
export function drawWaterAura(ctx,aura,x,y,size,reducedMotion=false){
  const spec=WATER_VFX[aura.kind]?.[`skill-lv${aura.stage}`];if(!spec)return;
  const opacity=Math.max(0,Math.min(1,aura.elapsedMs/450,(aura.durationMs-aura.elapsedMs)/450));
  if(aura.kind==='cancer'){
    drawCancerBubbles(ctx,aura,x,y,size,opacity,reducedMotion);
    const crab=cancerCrabImage(aura.stage);
    if(crab?.image.complete&&crab.image.naturalWidth){
      const [sx,sy,sw,sh]=crab.bounds,diameter=size*2.15,scale=diameter/Math.max(sw,sh);
      const width=sw*scale,height=sh*scale,cx=x,cy=y-size*.18;
      ctx.save();ctx.globalAlpha*=opacity;
      ctx.drawImage(crab.image,sx,sy,sw,sh,cx-width/2,cy-height/2,width,height);
      ctx.restore();
    }
    return;
  }
  preloadWater(aura.kind,[spec.id]);
  const frame=reducedMotion?12:waterFrameAt(aura.elapsedMs,aura.durationMs);
  // 물빛은 캐릭터 뒤에 배치됩니다. 고래는 2배가 된 몸을 감싸도록 더 넓게 그립니다.
  const width=size*2.35,above=size*.12;
  sprite(ctx,spec,frame,x,y-above,width,width,opacity);
}

const cancerBubbleSeeds=[
  [-.88,.26,.052,0],[-.71,-.22,.042,.18],[-.5,.34,.064,.37],[-.3,-.38,.046,.55],
  [.34,.32,.055,.11],[.53,-.3,.044,.31],[.73,.16,.065,.52],[.91,-.16,.04,.72]
];
function drawCancerBubbles(ctx,aura,x,y,size,opacity,reducedMotion){
  if(opacity<=0)return;
  const phaseTime=reducedMotion?0:aura.elapsedMs;
  ctx.save();ctx.globalAlpha*=opacity;
  for(const [side,height,radius,offset] of cancerBubbleSeeds){
    const phase=reducedMotion?.42:((phaseTime/1900+offset)%1+1)%1;
    const bx=x+side*size*.92+Math.sin(phase*Math.PI*2+offset)*size*.035;
    const by=y+size*(.48-phase*.9);
    const r=size*radius;
    const alpha=(.14+.16*Math.sin(Math.PI*phase))*(reducedMotion?.72:1);
    const gradient=ctx.createRadialGradient(bx-r*.28,by-r*.32,0,bx,by,r);
    gradient.addColorStop(0,`rgba(240,252,255,${alpha})`);
    gradient.addColorStop(.52,`rgba(174,229,246,${alpha*.55})`);
    gradient.addColorStop(1,'rgba(151,221,244,0)');
    ctx.fillStyle=gradient;ctx.beginPath();ctx.ellipse(bx,by,r,r*1.12,0,0,Math.PI*2);ctx.fill();
    ctx.strokeStyle=`rgba(218,247,255,${alpha*.52})`;ctx.lineWidth=Math.max(1,size*.012);
    ctx.beginPath();ctx.ellipse(bx,by,r*.76,r*.88,0,0,Math.PI*2);ctx.stroke();
  }
  ctx.restore();
}
