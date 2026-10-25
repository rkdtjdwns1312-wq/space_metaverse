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
  // 원화 속 위아래로 쌓인 날개를 그대로 확대하지 않고 한 쌍씩 등 뒤에서 펼칩니다.
  const wingSpec=SWAN_VFX['skill-lv2'];preloadSwan([wingSpec.id]);
  const elapsed=Math.max(0,aura.elapsedMs);
  const frame=reducedMotion?12:swanFrameAt(elapsed,aura.durationMs);
  ctx.save();ctx.globalAlpha*=reducedMotion?.78:1;
  ctx.shadowColor='#a8c8ff';ctx.shadowBlur=size*.08;
  const image=images.get(wingSpec.url),rootY=y-size*.14;
  if(image?.complete&&image.naturalWidth){
    const pairs=aura.stage-1,scales=pairs===1?[1]:pairs===2?[1.17,.77]:[1.35,1.02,.69];
    for(let pair=0;pair<pairs;pair++)for(const side of [-1,1]){
      const wingWidth=size*1.1*scales[pair],wingHeight=size*2.2*scales[pair];
      const spread=pairs===1?0:(pairs-pair-1)*.19;
      ctx.save();ctx.translate(x,rootY);ctx.rotate(side*spread);ctx.scale(side,1);
      // V자 날개의 오른쪽 절반을 좌우에 대칭으로 놓고, 아래 뿌리를 공통점에 맞춥니다.
      ctx.drawImage(image,(frame%6)*256+128,Math.floor(frame/6)*256,128,256,
        0,-wingHeight*195/256,wingWidth,wingHeight);
      ctx.restore();
    }
  }
  ctx.restore();
}
