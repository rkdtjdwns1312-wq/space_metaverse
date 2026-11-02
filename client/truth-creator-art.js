import {mapImage,mapImageReady,decodeMapImages} from './map-image.js';
import {drawMonsterArtLoading} from './monster-art-loading.js';

const art=mapImage('/assets/monsters/truth-creator.png');
const floating=mapImage('/assets/monsters/truth-creator-float.png');
const chaser=mapImage('/assets/monsters/truth-creator-chaser.png');
const orb=mapImage('/assets/monsters/truth-creator-orb.png');
const blue=mapImage('/assets/monsters/truth-creator-blue.png');
const galaxy=mapImage('/assets/monsters/truth-creator-galaxy.png');
export const preloadTruthCreatorArt=()=>decodeMapImages([art,floating,orb,chaser,blue,galaxy]);
export function truthCreatorBounds(monster){
  const width=monster.radius*2.4,height=width,bottom=monster.y+monster.radius*.9;
  return {width,height,top:bottom-height-8,bottom};
}
export function drawTruthCreator(ctx,monster,time=0,attack){
  if(monster?.shape!=='truth-creator')return false;
  if(!ctx)return true;
  if(!mapImageReady(art))return drawMonsterArtLoading(ctx,monster,art);
  const {width,height,bottom}=truthCreatorBounds(monster);
  const quiet=typeof matchMedia==='function'&&matchMedia('(prefers-reduced-motion: reduce)').matches;
  const bob=quiet?0:Math.sin(time/1100)*2;
  ctx.save();
  if(attack){ctx.shadowColor='#fff1b3';ctx.shadowBlur=12;}
  if(mapImageReady(floating)){
    // 대기도 같은 시트의 첫 프레임을 사용하여 걷기 시작/종료 때 몸체 크기가 튀지 않게 합니다.
    const frame=monster.moving&&!quiet?Math.floor(time/160)%8:0,sw=floating.naturalWidth/4,sh=floating.naturalHeight/2;
    const size=width*1.18;
    ctx.drawImage(floating,frame%4*sw,Math.floor(frame/4)*sh,sw,sh,monster.x-size/2,bottom-height+(height-size)/2+bob,size,size);
  }else ctx.drawImage(art,monster.x-width/2,bottom-height+bob,width,height);
  ctx.restore();return true;
}
export function drawTruthCreatorStatue(ctx,object){
  if(!mapImageReady(art)){drawMonsterArtLoading(ctx,object,art);return;}
  const size=230;ctx.save();ctx.filter='grayscale(1) brightness(.6)';
  ctx.drawImage(art,object.x-size/2,object.y-size+30,size,size);ctx.restore();
  ctx.save();ctx.font='16px "Jua","Malgun Gothic",sans-serif';ctx.textAlign='center';ctx.lineWidth=4;
  ctx.strokeStyle='#171521';ctx.fillStyle='#e6d6aa';
  ctx.strokeText(object.name,object.x,object.y+51);ctx.fillText(object.name,object.x,object.y+51);ctx.restore();
}
export function drawTruthCreatorGround(ctx,effects,now,quiet=false){
  for(const path of effects?.paths||[])if(now<path.endsAt){
    const length=Math.hypot(path.x2-path.x1,path.y2-path.y1);if(length<1)continue;
    ctx.save();ctx.lineCap='round';ctx.beginPath();ctx.moveTo(path.x1,path.y1);ctx.lineTo(path.x2,path.y2);
    ctx.strokeStyle='rgba(255,214,125,.13)';ctx.lineWidth=path.width*1.9;ctx.stroke();
    ctx.shadowColor='#fff0b5';ctx.shadowBlur=12;ctx.strokeStyle='rgba(255,223,149,.55)';ctx.lineWidth=path.width;ctx.stroke();
    ctx.shadowBlur=0;ctx.strokeStyle='#fffbea';ctx.lineWidth=3;ctx.stroke();
    // At most 24 glints per analytic path; no per-tick trail particles or canvases.
    const count=Math.min(24,Math.max(1,Math.floor(length/60)));
    for(let i=0;i<count;i++){
      const part=(i+.5)/count,x=path.x1+(path.x2-path.x1)*part,y=path.y1+(path.y2-path.y1)*part;
      const size=quiet?3:3+2*Math.sin(now/400+i*1.7);ctx.strokeStyle='rgba(255,250,223,.8)';ctx.lineWidth=1.5;
      ctx.beginPath();ctx.moveTo(x-size,y);ctx.lineTo(x+size,y);ctx.moveTo(x,y-size);ctx.lineTo(x,y+size);ctx.stroke();
    }
    ctx.restore();
  }
}
export function truthCreatorObjectLayers(ctx,effects,now){
  const layers=[];
  for(const [shots,art] of [[effects?.projectiles,orb],[effects?.chasers,chaser]])if(mapImageReady(art))
    for(const shot of shots||[])if(now<shot.endsAt)layers.push({y:shot.y,draw:()=>{
      const size=shot.radius*2.5;ctx.drawImage(art,shot.x-size/2,shot.y-size/2,size,size);
    }});
  for(const shot of effects?.blueOrbs||[])if(now<shot.endsAt)layers.push({y:shot.y,draw:()=>{
    const size=shot.radius*2.5;ctx.save();
    if(mapImageReady(blue))ctx.drawImage(blue,shot.x-size/2,shot.y-size/2,size,size);
    else{ctx.fillStyle='#5ba9ef';ctx.beginPath();ctx.arc(shot.x,shot.y,shot.radius,0,Math.PI*2);ctx.fill();}
    if(shot.phase==='landed'){
      ctx.font='bold 20px "Jua","Malgun Gothic",sans-serif';ctx.textAlign='center';ctx.lineWidth=5;ctx.strokeStyle='#102d58';ctx.fillStyle='#e4f7ff';
      const label=Math.max(0,Math.ceil((shot.endsAt-now)/1000))+'초';ctx.strokeText(label,shot.x,shot.y+size/2+17);ctx.fillText(label,shot.x,shot.y+size/2+17);
    }
    ctx.restore();
  }});
  if(mapImageReady(galaxy))for(const shot of effects?.galaxies||[])if(now<shot.endsAt)layers.push({y:shot.y,draw:()=>{
    const size=shot.radius*2.75;ctx.save();ctx.translate(shot.x,shot.y);ctx.rotate(Math.atan2(shot.dy,shot.dx));ctx.drawImage(galaxy,-size/2,-size/2,size,size);ctx.restore();
  }});
  return layers;
}
export function drawTruthCreatorSentry(ctx,monster,time=0){
  if(monster?.shape!=='truth-creator-star')return false;
  if(!ctx)return true;
  if(!mapImageReady(orb))return drawMonsterArtLoading(ctx,monster,orb);
  const quiet=typeof matchMedia==='function'&&matchMedia('(prefers-reduced-motion: reduce)').matches;
  // The same 48px collision radius and 2.75× art width as a Lv2 energy baby star.
  const size=monster.radius*2.75,bob=quiet?0:Math.sin(time/850+monster.x)*2;
  ctx.save();ctx.shadowColor='#ffe066';ctx.shadowBlur=quiet?15:15+4*Math.sin(time/600);
  ctx.drawImage(orb,monster.x-size/2,monster.y-size/2+bob,size,size);ctx.restore();return true;
}
