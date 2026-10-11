const TAU=Math.PI*2;
const clamp=value=>Math.max(0,Math.min(1,value));
const smooth=(a,b,value)=>{const t=clamp((value-a)/(b-a));return t*t*(3-2*t);};
let fish;
export function preloadPiscesBullet(){
  if(!fish){fish=new Image();fish.src='/assets/skills/pisces/portal-fish.png';}
  return fish;
}

export function drawPiscesBullet(ctx,cast,elapsedMs,reducedMotion=false){
  const image=preloadPiscesBullet();
  if(!image.complete||!image.naturalWidth)return true;
  const progress=clamp(elapsedMs/(cast.durationMs||650));
  const stage=Math.max(2,Math.min(4,Math.floor(cast.level||cast.stage||2)));
  const base=Math.max(1,cast.size||32),scale=stage===2?.82:stage===3?1:1.18;
  const width=base*.86*scale,height=width*image.naturalHeight/image.naturalWidth;
  const fade=Math.min(smooth(0,.13,progress),1-smooth(.84,1,progress));
  if(fade<=0)return true;
  const angle=Math.atan2(cast.dy??0,cast.dx??1);
  ctx.save();ctx.translate(cast.x,cast.y);
  // 좌우는 수평 반전만 적용하여 눈·등지느러미가 뒤집히지 않게 합니다.
  if((cast.dx??1)<0){ctx.scale(-1,1);ctx.rotate(Math.PI-angle);}else ctx.rotate(angle);
  ctx.globalAlpha*=fade;
  const opacity=ctx.globalAlpha;
  // E와 같은 투명 원화의 물결 질감과 청색/연보라 지느러미를 유지합니다.
  ctx.shadowColor='#74cdff';ctx.shadowBlur=width*(stage===4?.085:.04);
  ctx.drawImage(image,-width/2,-height/2,width,height);
  ctx.shadowBlur=0;
  if(stage>=3){
    // 몸을 덮는 링 대신 꼬리 뒤로만 짧은 물빛·별빛 잔광이 흐릅니다.
    const time=reducedMotion?0:elapsedMs/650;
    for(let i=0;i<(stage===4?5:3);i++){
      const phase=(time+i/5)%1,x=-width*(.30+phase*.34);
      const y=Math.sin(i*2.4)*height*.30,r=width*(stage===4?.022:.016)*(1-phase*.5);
      ctx.globalAlpha=opacity*(1-phase)*.72;
      ctx.fillStyle=i%2?'#d5bcff':'#c5f6ff';
      ctx.beginPath();ctx.ellipse(x,y,r*1.8,r*.65,0,0,TAU);ctx.fill();
      if(stage===4){ctx.fillStyle='#f2fcff';ctx.fillRect(x-r*.25,y-r*1.6,r*.5,r*3.2);}
    }
  }
  ctx.restore();return true;
}
