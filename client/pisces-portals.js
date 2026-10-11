import {piscesPortalGeometry} from '/shared/pisces-portals.js';
let fish;
function loadFish(){if(!fish){fish=new Image();fish.src='/assets/skills/pisces/portal-fish.png';}return fish;}
const smooth=x=>{x=Math.max(0,Math.min(1,x));return x*x*(3-2*x);};
function portal(ctx,x,r,time,opacity,front=false){
  ctx.save();ctx.translate(x,0);ctx.globalAlpha*=opacity;
  ctx.shadowColor='#54dbff';ctx.shadowBlur=r*.24;
  if(!front){
    const glow=ctx.createRadialGradient(0,0,0,0,0,r);glow.addColorStop(0,'#123788bb');glow.addColorStop(.6,'#3f98d2aa');glow.addColorStop(1,'#99eeff00');
    ctx.save();ctx.scale(.42,1);ctx.fillStyle=glow;ctx.beginPath();ctx.arc(0,0,r,0,Math.PI*2);ctx.fill();ctx.restore();
  }
  ctx.lineWidth=Math.max(1.5,r*.055);ctx.strokeStyle='#b4f3ff';ctx.beginPath();ctx.ellipse(0,0,r*.28,r,0,front?-Math.PI/2:Math.PI/2,front?Math.PI/2:Math.PI*1.5);ctx.stroke();
  if(front)for(let i=0;i<7;i++){
    const angle=i*Math.PI*2/7+time/650;ctx.fillStyle=i%2?'#c9baff':'#e9ffff';ctx.beginPath();ctx.arc(Math.cos(angle)*r*.3,Math.sin(angle)*r,Math.max(1,r*.036),0,Math.PI*2);ctx.fill();
  }
  ctx.restore();
}
export function drawPiscesPortalPair(ctx,cast,elapsedMs,reducedMotion=false,front=false){
  const g=piscesPortalGeometry(cast),duration=2000;
  const opacity=smooth(elapsedMs/120)*(1-smooth((elapsedMs-duration+140)/140));
  ctx.save();ctx.translate(cast.x,cast.y);ctx.rotate(Math.atan2(cast.dy??0,cast.dx??1));
  for(const x of [g.start,g.end])portal(ctx,x,g.portalRadius,reducedMotion?0:elapsedMs,opacity,front);
  ctx.restore();
}
export function drawPiscesPortalFish(ctx,cast,elapsedMs,reducedMotion=false){
  const image=loadFish(),g=piscesPortalGeometry(cast,elapsedMs/cast.durationMs);
  const angle=Math.atan2(cast.dy??0,cast.dx??1);
  ctx.save();ctx.translate(cast.sourceX??cast.x,cast.sourceY??cast.y);ctx.rotate(angle);
  ctx.save();ctx.beginPath();ctx.rect(g.start,-g.height,g.end-g.start,g.height*2);ctx.clip();
  if(image.complete&&image.naturalWidth){
    ctx.save();ctx.translate(g.center,0);
    // 왼쪽에서도 등/배가 뒤집히지 않게 물고기만 세로반전으로 회전 보정합니다.
    if((cast.dx??1)<0)ctx.scale(1,-1);
    ctx.drawImage(image,-g.length/2,-g.height/2,g.length,g.height);ctx.restore();
  }
  ctx.restore();
  ctx.restore();return true;
}
