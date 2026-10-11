// 원화의 별 꼭짓점 좌표. 몸체를 변형하거나 전체 색상을 바꾸지 않습니다.
export const TRANSCENDENT_STARS={
  aquarius:[[.55,.26],[.62,.42],[.74,.4],[.73,.49],[.56,.57],[.37,.64]],
  aries:[[.7,.28],[.66,.41],[.52,.49],[.4,.53],[.35,.63],[.58,.68]],
  cancer:[[.5,.4],[.39,.53],[.61,.54],[.5,.69],[.27,.61],[.75,.61]],
  capricorn:[[.69,.28],[.68,.4],[.49,.57],[.29,.59],[.64,.65],[.4,.76]],
  cetus:[[.13,.43],[.32,.43],[.43,.4],[.46,.63],[.69,.62],[.81,.49]],
  'corona-borealis':[[.5,.2],[.28,.34],[.7,.34],[.51,.41],[.43,.6],[.63,.6]],
  corvus:[[.28,.28],[.43,.47],[.53,.6],[.75,.45],[.68,.64],[.45,.74]],
  cygnus:[[.43,.44],[.52,.51],[.61,.64],[.76,.57],[.38,.6],[.51,.72]],
  gemini:[[.36,.29],[.28,.44],[.33,.56],[.64,.32],[.65,.47],[.72,.59]],
  hercules:[[.3,.27],[.42,.42],[.61,.41],[.5,.54],[.49,.64],[.7,.79]],
  leo:[[.22,.29],[.33,.56],[.59,.37],[.66,.49],[.45,.65],[.61,.74]],
  libra:[[.5,.2],[.5,.29],[.49,.52],[.28,.61],[.74,.61],[.5,.79]],
  ophiuchus:[[.49,.29],[.4,.45],[.52,.52],[.35,.62],[.65,.65],[.48,.75]],
  pisces:[[.23,.29],[.37,.35],[.5,.35],[.61,.61],[.74,.66],[.48,.7]],
  sagittarius:[[.44,.36],[.45,.48],[.59,.57],[.55,.69],[.66,.76],[.82,.32]],
  taurus:[[.32,.35],[.45,.44],[.63,.51],[.74,.57],[.4,.69],[.64,.73]]
};
const layers=new WeakMap();
export function drawTranscendentStars(target,id,displaySize,time,reducedMotion=false,sprite){
  if(!TRANSCENDENT_STARS[id]||!sprite)return;
  let layer=layers.get(sprite);
  if(!layer){
    const mask=document.createElement('canvas');mask.width=mask.height=256;
    const mc=mask.getContext('2d');mc.drawImage(sprite,0,0,256,256);
    const source=mc.getImageData(0,0,256,256),data=source.data;
    const points=TRANSCENDENT_STARS[id].map(([u,v])=>{
      let best=-1,point=[u,v];
      for(let y=Math.max(0,Math.floor(v*256)-16);y<Math.min(256,v*256+16);y++)for(let x=Math.max(0,Math.floor(u*256)-16);x<Math.min(256,u*256+16);x++){
        const k=(y*256+x)*4,light=Math.min(data[k],data[k+1],data[k+2]),score=light-(Math.hypot(x-u*256,y-v*256)*.8);
        if(data[k+3]>200&&light>195&&score>best){best=score;point=[x/256,y/256];}
      }return best<0?null:point;
    }).filter(Boolean);
    // 반투명 외곽이나 배경에는 새로운 별을 그리지 않습니다.
    for(let k=0;k<data.length;k+=4)data[k+3]=data[k+3]>180?255:0;
    mc.putImageData(source,0,0);
    const canvas=document.createElement('canvas');canvas.width=canvas.height=256;
    layer={canvas,ctx:canvas.getContext('2d'),mask,points};layers.set(sprite,layer);
  }
  const {ctx,points}=layer,size=256;ctx.clearRect(0,0,256,256);ctx.save();ctx.translate(128,128);
  ctx.save();ctx.globalCompositeOperation='screen';
  points.forEach(([x,y],i)=>{
    const t=reducedMotion?0:time,hue=(t/55+i*43)%360,pulse=.62+.2*Math.sin(t/750+i*1.8);
    const px=(x-.5)*size,py=(y-.5)*size,r=size*.037;
    const g=ctx.createRadialGradient(px,py,0,px,py,r);
    g.addColorStop(0,`hsla(${hue},95%,80%,${pulse})`);g.addColorStop(.3,`hsla(${hue},95%,65%,${pulse*.7})`);g.addColorStop(1,`hsla(${hue},95%,65%,0)`);
    ctx.fillStyle=g;ctx.fillRect(px-r,py-r,r*2,r*2);
    ctx.fillStyle=`hsla(${hue},100%,91%,${pulse})`;const s=size*.011*pulse;
    ctx.beginPath();ctx.moveTo(px,py-s*2);ctx.lineTo(px+s*.5,py-s*.5);ctx.lineTo(px+s*2,py);ctx.lineTo(px+s*.5,py+s*.5);ctx.lineTo(px,py+s*2);ctx.lineTo(px-s*.5,py+s*.5);ctx.lineTo(px-s*2,py);ctx.lineTo(px-s*.5,py-s*.5);ctx.closePath();ctx.fill();
  });ctx.restore();ctx.restore();
  ctx.save();ctx.globalCompositeOperation='destination-in';ctx.drawImage(layer.mask,0,0);ctx.restore();
  target.save();target.globalCompositeOperation='screen';target.drawImage(layer.canvas,-displaySize/2,-displaySize/2,displaySize,displaySize);target.restore();
}
