// 게임 좌표에 직접 그리는 금빛 스킬. 그림과 별개로 타격 시각/범위는 서버가 정합니다.
function star(ctx,x,y,r){
  ctx.beginPath();for(let i=0;i<10;i++){const a=i*Math.PI/5-Math.PI/2,s=i%2?r*.42:r;ctx.lineTo(x+Math.cos(a)*s,y+Math.sin(a)*s);}ctx.closePath();ctx.fill();
}
function arrow(ctx,x,y,length){
  ctx.beginPath();ctx.moveTo(x-length,y);ctx.lineTo(x,y);ctx.lineTo(x-12,y-7);ctx.moveTo(x,y);ctx.lineTo(x-12,y+7);ctx.stroke();
}
function circle(ctx,x,y,r){ctx.beginPath();ctx.arc(x,y,r,0,Math.PI*2);ctx.stroke();}
export function drawSagittarius(ctx,effect,progress,time,reducedMotion=false){
  ctx.save();ctx.translate(effect.x,effect.y);ctx.strokeStyle='#ffe2a1';ctx.fillStyle='#fff3ba';ctx.lineWidth=2.5;
  ctx.shadowColor='#efb451';ctx.shadowBlur=reducedMotion?0:12;
  const size=effect.size||80;
  if(effect.kind==='arrow'){
    ctx.rotate(Math.atan2(effect.dy,effect.dx));
    const start=size/2,end=effect.range,head=start+(end-start)*Math.min(1,progress*1.8);
    ctx.globalAlpha=1-progress*.65;ctx.lineWidth=effect.slot===1?5:3;
    arrow(ctx,head,0,Math.min(head-start+20,size*1.2));
    for(let i=0;i<(effect.slot===1?12:5);i++){
      const x=start+(head-start)*i/12,y=Math.sin(i*7)*size*.1;
      star(ctx,x,y,3+i%3);
    }
  }else if(effect.kind==='hunter'){
    ctx.scale(effect.dx<0?-1:1,1);const s=size/100;ctx.scale(s,s);
    const bounce=reducedMotion?0:Math.sin(time/95)*4;ctx.translate(0,bounce-14);
    // 몸통·꼬리·뾰족 귀의 별자리 사냥개. 아바타 자체는 자세를 바꾸지 않습니다.
    const points=[[-38,1],[-55,-25],[-23,-10],[10,-12],[21,-33],[27,-15],[40,-19],[48,-6],[28,2],[18,20],[11,4],[-13,5],[-28,22],[-24,1],[-38,1]];
    ctx.fillStyle='#f6bb4e55';ctx.beginPath();points.forEach(([x,y])=>ctx.lineTo(x,y));ctx.closePath();ctx.fill();ctx.stroke();
    ctx.fillStyle='#fff5c1';for(const [x,y] of points.filter((_,i)=>i%2===0))star(ctx,x,y,4);
    ctx.fillStyle='#fff';star(ctx,34,-10,3);
  }else if(effect.kind==='rain'){
    const r=effect.radius;ctx.globalAlpha=.6;circle(ctx,0,0,r);circle(ctx,0,0,r*.88);
    ctx.fillStyle='#edc35c18';ctx.beginPath();ctx.arc(0,0,r,0,Math.PI*2);ctx.fill();
    for(let i=0;i<12;i++){const a=i*Math.PI/6;star(ctx,Math.cos(a)*r,Math.sin(a)*r,5);}
    for(let i=0;i<18;i++){
      const a=i*2.4,rad=Math.sqrt((i+.5)/18)*r*.86,x=Math.cos(a)*rad,y=Math.sin(a)*rad;
      const fall=reducedMotion?.5:((time/700+i*.17)%1);
      ctx.globalAlpha=.25+fall*.7;ctx.save();ctx.translate(x,y-(1-fall)*r);ctx.rotate(Math.PI/2);arrow(ctx,0,0,22+size*.1);ctx.restore();
    }
  }else{
    const r=effect.kind==='explosion'?effect.radius:size*.3;
    ctx.globalAlpha=1-progress;circle(ctx,0,0,r*(.2+progress*.8));
    if(effect.kind==='explosion')circle(ctx,0,0,r*(.1+progress*.65));
    for(let i=0;i<12;i++){const a=i*Math.PI/6;star(ctx,Math.cos(a)*r*progress,Math.sin(a)*r*progress,6*(1-progress)+2);}
    star(ctx,0,0,size*.18*(1-progress));
  }
  ctx.restore();
}
