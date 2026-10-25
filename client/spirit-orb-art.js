// Sun and moon share one sphere. This is a world decoration; combat remains server-owned.
export function drawSpiritOrb(ctx,orb,time=0,reducedMotion=false){
  const r=Number(orb?.radius),x=Number(orb?.x),y=Number(orb?.y);
  if(!Number.isFinite(r)||r<=0||!Number.isFinite(x)||!Number.isFinite(y))return;
  const phase=reducedMotion?0:time/700;
  ctx.save();ctx.translate(x,y);
  const aura=ctx.createRadialGradient(0,0,r*.6,0,0,r*1.85);
  aura.addColorStop(0,'#fff0ad91');aura.addColorStop(.55,'#b9baff55');aura.addColorStop(1,'#8da7ff00');
  ctx.fillStyle=aura;ctx.beginPath();ctx.arc(0,0,r*1.85,0,Math.PI*2);ctx.fill();
  ctx.save();ctx.rotate(Math.sin(phase)*.035);
  for(let i=0;i<8;i++){
    const a=i*Math.PI/4,inner=r*.93,outer=r*(1.2+.04*Math.sin(phase+i));
    ctx.strokeStyle=i%2?'#ffedab99':'#fff8d3bc';ctx.lineWidth=Math.max(1.5,r*.055);
    ctx.lineCap='round';ctx.beginPath();ctx.moveTo(-r*.34+Math.cos(a)*inner,Math.sin(a)*inner);
    ctx.lineTo(-r*.34+Math.cos(a)*outer,Math.sin(a)*outer);ctx.stroke();
  }
  ctx.restore();
  ctx.beginPath();ctx.arc(0,0,r,0,Math.PI*2);ctx.clip();
  const sun=ctx.createRadialGradient(-r*.48,-r*.32,r*.05,-r*.28,0,r*1.15);
  sun.addColorStop(0,'#fff9c8');sun.addColorStop(.5,'#ffc65b');sun.addColorStop(1,'#e67b50');
  ctx.fillStyle=sun;ctx.fillRect(-r,-r,r*2,r*2);
  const moon=ctx.createRadialGradient(r*.62,-r*.45,r*.05,r*.32,0,r*1.2);
  moon.addColorStop(0,'#e8f5ff');moon.addColorStop(.55,'#8ab5ec');moon.addColorStop(1,'#455cba');
  ctx.fillStyle=moon;ctx.beginPath();ctx.moveTo(0,-r);
  ctx.bezierCurveTo(r*.22,-r*.48,-r*.2,r*.43,0,r);
  ctx.lineTo(r,r);ctx.lineTo(r,-r);ctx.closePath();ctx.fill();
  ctx.fillStyle='#fff6cb';ctx.beginPath();ctx.arc(-r*.4,-r*.12,r*.25,0,Math.PI*2);ctx.fill();
  ctx.fillStyle='#f5faff';ctx.beginPath();ctx.arc(r*.38,-r*.1,r*.33,0,Math.PI*2);ctx.fill();
  ctx.fillStyle='#8ab5ec';ctx.beginPath();ctx.arc(r*.52,-r*.23,r*.32,0,Math.PI*2);ctx.fill();
  ctx.strokeStyle='#fffaf1cc';ctx.lineWidth=Math.max(1.5,r*.045);
  ctx.beginPath();ctx.arc(0,0,r-ctx.lineWidth/2,0,Math.PI*2);ctx.stroke();
  ctx.restore();
}
