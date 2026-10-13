const TAU=Math.PI*2;
const clamp=value=>Math.max(0,Math.min(1,value));
const smooth=(a,b,value)=>{const t=clamp((value-a)/(b-a));return t*t*(3-2*t);};
// Q는 작은 액체 물방울 윤곽, E는 기존의 상세한 물고기 원화를 사용합니다.
export function preloadPiscesBullet(){}

export function drawPiscesBullet(ctx,cast,elapsedMs,reducedMotion=false){
  const progress=clamp(elapsedMs/(cast.durationMs||650));
  const stage=Math.max(2,Math.min(4,Math.floor(cast.level||cast.stage||2)));
  const base=Math.max(1,cast.size||32),scale=stage===2?.82:stage===3?1:1.18;
  const width=base*.86*scale,height=width*.43;
  const fade=Math.min(smooth(0,.13,progress),1-smooth(.84,1,progress));
  if(fade<=0)return true;
  const angle=Math.atan2(cast.dy??0,cast.dx??1);
  ctx.save();ctx.translate(cast.x,cast.y);
  // 왼쪽도 상하가 뒤집히지 않도록 수평 반전만 적용합니다.
  if((cast.dx??1)<0){ctx.scale(-1,1);ctx.rotate(Math.PI-angle);}else ctx.rotate(angle);
  ctx.globalAlpha*=fade;
  const opacity=ctx.globalAlpha;
  const tail=reducedMotion?0:Math.sin(elapsedMs/780*TAU)*height*.13;
  const tailWidth=reducedMotion?1:.88+Math.cos(elapsedMs/780*TAU)*.12;
  ctx.shadowColor='#65bbef';ctx.shadowBlur=width*(stage===4?.065:.035);
  // 둥근 물방울 몸통과 물결치는 꼬리를 하나의 닫힌 곡선으로 연결합니다.
  const liquid=ctx.createLinearGradient(0,-height*.5,0,height*.5);
  liquid.addColorStop(0,'#d4f8ffeb');liquid.addColorStop(.36,'#66c9f2e8');liquid.addColorStop(1,'#348fd2c9');
  ctx.fillStyle=liquid;ctx.strokeStyle='#79d5f7';ctx.lineWidth=Math.max(.8,width*.022);
  ctx.beginPath();ctx.moveTo(width*.46,0);
  ctx.bezierCurveTo(width*.37,-height*.61,0,-height*.65,-width*.19,-height*.12);
  ctx.bezierCurveTo(-width*.28,-height*.16+tail,-width*.40*tailWidth,-height*.44+tail,-width*.49*tailWidth,-height*.34+tail);
  ctx.quadraticCurveTo(-width*.40,tail,-width*.49*tailWidth,height*.34+tail);
  ctx.bezierCurveTo(-width*.40*tailWidth,height*.44+tail,-width*.28,height*.16+tail,-width*.19,height*.12);
  ctx.bezierCurveTo(0,height*.61,width*.38,height*.55,width*.46,0);ctx.closePath();ctx.fill();ctx.stroke();
  ctx.shadowBlur=0;ctx.strokeStyle='#eeffffdb';ctx.lineWidth=Math.max(1,width*.035);ctx.lineCap='round';
  ctx.beginPath();ctx.moveTo(-width*.10,-height*.22);ctx.quadraticCurveTo(width*.10,-height*.42,width*.27,-height*.22);ctx.stroke();
  ctx.shadowBlur=0;
  if(stage>=3){
    // 진화하면 꼬리 뒤에 작은 물방울만 조금 더 남깁니다.
    const time=reducedMotion?0:elapsedMs/650;
    for(let i=0;i<(stage===4?5:3);i++){
      const phase=(time+i/5)%1,x=-width*(.30+phase*.34);
      const y=Math.sin(i*2.4)*height*.30,r=width*(stage===4?.022:.016)*(1-phase*.5);
      ctx.globalAlpha=opacity*(1-phase)*.72;
      ctx.fillStyle=i%2?'#77c5ef':'#c5f6ff';
      ctx.beginPath();ctx.ellipse(x,y,r*1.8,r*.65,0,0,TAU);ctx.fill();
    }
  }
  ctx.restore();return true;
}
