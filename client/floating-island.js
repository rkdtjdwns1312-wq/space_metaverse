// 원형 보행면 아래쪽에만 보이는 부드러운 역삼각형 지층입니다.
// 서버 충돌은 기존 보행면을 그대로 사용하며 그림은 길을 막지 않습니다.
const PALETTES={
  silver:['#c7c2db','#8d86b3','#515379'],
  moon:['#cbd5ed','#8898c1','#4e628e'],
  sun:['#f6d9aa','#c49a76','#826783'],
  rainbow:['#ead5eb','#a996cc','#6f709f']
};
export function drawFloatingIslands(ctx,zones,theme='silver',bottom=Infinity){
  const [top,middle,tip]=PALETTES[theme]||PALETTES.silver;
  ctx.save();
  for(const z of zones){
    if(!z||!Number.isFinite(z.rx)||!Number.isFinite(z.ry))continue;
    const base=z.y+z.ry,depth=Math.min(240,Math.max(55,z.ry*.56),bottom-base-12);
    if(depth<12)continue;
    const pointY=base+depth;
    const path=new Path2D();
    for(let i=0;i<=32;i++){
      const angle=Math.PI-i*Math.PI/32;
      const x=z.x+Math.cos(angle)*z.rx,y=z.y+Math.sin(angle)*z.ry;
      if(i===0)path.moveTo(x,y);else path.lineTo(x,y);
    }
    path.lineTo(z.x+z.rx*.07,pointY);path.closePath();
    const g=ctx.createLinearGradient(z.x,z.y,z.x,pointY);
    g.addColorStop(0,top);g.addColorStop(.48,middle);g.addColorStop(1,tip);
    ctx.fillStyle=g;ctx.shadowColor='#27284688';ctx.shadowBlur=22;ctx.shadowOffsetY=12;ctx.fill(path);
    ctx.shadowBlur=0;ctx.shadowOffsetY=0;
    // 지층의 양면을 낮은 대비로 나누어 납작한 삼각형 도형처럼 보이지 않게 합니다.
    ctx.fillStyle='#ffffff21';ctx.beginPath();ctx.moveTo(z.x-z.rx,z.y);ctx.lineTo(z.x,base);ctx.lineTo(z.x+z.rx*.07,pointY);ctx.closePath();ctx.fill();
    ctx.fillStyle='#2836611c';ctx.beginPath();ctx.moveTo(z.x+z.rx,z.y);ctx.lineTo(z.x,base);ctx.lineTo(z.x+z.rx*.07,pointY);ctx.closePath();ctx.fill();
    for(let i=0;i<7;i++){
      const x=z.x+Math.sin(i*8.3)*z.rx*.42,y=base+depth*(.19+i*.095);
      ctx.fillStyle=i%2?'#fff8dd8a':'#d9e7ff94';ctx.beginPath();ctx.arc(x,y,Math.max(1.6,z.rx*.003),0,Math.PI*2);ctx.fill();
    }
  }
  ctx.restore();
}
