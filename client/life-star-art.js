// 작은 흰 별: 부드러운 민트빛 숨결과 반짝임으로 생명력을 표현합니다.
export function drawLifeStar(ctx,o,time=0,reducedMotion=false){
  const phase=reducedMotion?0:time/1400,r=o.radius,pulse=1+Math.sin(phase)*.06;
  ctx.save();ctx.translate(o.x,o.y);ctx.scale(pulse,pulse);
  const halo=ctx.createRadialGradient(0,0,r*.2,0,0,r*2.6);
  halo.addColorStop(0,'#ffffffdd');halo.addColorStop(.4,'#cbffe99c');halo.addColorStop(1,'#d5fff000');
  ctx.fillStyle=halo;ctx.fillRect(-r*2.6,-r*2.6,r*5.2,r*5.2);
  const body=ctx.createRadialGradient(-r*.25,-r*.3,1,0,0,r);
  body.addColorStop(0,'#ffffff');body.addColorStop(.65,'#fffefa');body.addColorStop(1,'#d8f8ed');
  ctx.shadowColor='#f3fff9';ctx.shadowBlur=18;ctx.fillStyle=body;ctx.beginPath();ctx.arc(0,0,r,0,Math.PI*2);ctx.fill();ctx.shadowBlur=0;
  ctx.strokeStyle='#ffffffc9';ctx.lineWidth=1.5;ctx.beginPath();ctx.ellipse(0,2,r*1.55,r*.58,-.35,0,Math.PI*2);ctx.stroke();
  for(let i=0;i<5;i++){
    const a=i*Math.PI*2/5+phase*.18,x=Math.cos(a)*r*1.8,y=Math.sin(a)*r*1.35;
    const s=2+(Math.sin(phase+i)+1)*1.1;ctx.fillStyle=i%2?'#d1fff0':'#ffffff';
    ctx.beginPath();ctx.moveTo(x,y-s);ctx.quadraticCurveTo(x,y,x+s,y);ctx.quadraticCurveTo(x,y,x,y+s);ctx.quadraticCurveTo(x,y,x-s,y);ctx.quadraticCurveTo(x,y,x,y-s);ctx.fill();
  }
  ctx.restore();
}
