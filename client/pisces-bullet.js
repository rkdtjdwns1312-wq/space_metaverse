const TAU=Math.PI*2;
const clamp=value=>Math.max(0,Math.min(1,value));
const smooth=(a,b,value)=>{const t=clamp((value-a)/(b-a));return t*t*(3-2*t);};

export function drawPiscesBullet(ctx,cast,elapsedMs,reducedMotion=false){
  const progress=clamp(elapsedMs/(cast.durationMs||650));
  const stage=Math.max(2,Math.min(4,Math.floor(cast.level||cast.stage||2)));
  const base=Math.max(1,cast.size||32),scale=stage===2?.82:stage===3?1:1.18;
  const size=base*.34*scale,fade=Math.min(1,smooth(0,.13,progress),1-smooth(.84,1,progress));
  if(fade<=0)return true;
  const angle=Math.atan2(cast.dy??0,cast.dx??1);
  ctx.save();ctx.translate(cast.x,cast.y);
  if((cast.dx??1)<0){ctx.scale(-1,1);ctx.rotate(Math.PI-angle);}else ctx.rotate(angle);
  ctx.globalAlpha*=reducedMotion?Math.sin(Math.PI*progress)*.72:fade;

  // 몸통은 물방울형 물고기 윤곽, 뒤쪽 꼬리는 두 갈래로 길게 잇습니다.
  ctx.beginPath();ctx.moveTo(-size*.82,0);
  ctx.quadraticCurveTo(-size*.54,-size*.72,size*.12,-size*.60);
  ctx.quadraticCurveTo(size*.82,-size*.43,size*.94,0);
  ctx.quadraticCurveTo(size*.72,size*.49,size*.12,size*.60);
  ctx.quadraticCurveTo(-size*.54,size*.72,-size*.82,0);ctx.closePath();
  const body=ctx.createLinearGradient(-size*.7,-size*.5,size*.7,size*.5);
  body.addColorStop(0,'#a6f5ff');body.addColorStop(.48,'#4bc7ee');body.addColorStop(1,'#287fe0');
  ctx.fillStyle=body;ctx.shadowColor='#baf8ff';ctx.shadowBlur=size*(stage===4?1.05:.58);ctx.fill();
  ctx.shadowBlur=0;ctx.strokeStyle='#e9ffff';ctx.lineWidth=Math.max(1,size*.12);ctx.stroke();

  ctx.beginPath();ctx.moveTo(-size*.73,0);ctx.lineTo(-size*1.28,-size*.46);ctx.lineTo(-size*1.12,0);
  ctx.lineTo(-size*1.28,size*.46);ctx.closePath();ctx.fillStyle='#62d8f5';ctx.fill();
  ctx.strokeStyle='#e8ffff';ctx.lineWidth=Math.max(1,size*.075);ctx.stroke();
  ctx.beginPath();ctx.moveTo(-size*.06,-size*.48);ctx.quadraticCurveTo(size*.18,-size*.88,size*.48,-size*.42);
  ctx.closePath();ctx.fillStyle=stage===4?'#d5fbff':stage===3?'#b7f5ff':'#8cecff';ctx.fill();
  ctx.beginPath();ctx.arc(size*.54,-size*.13,Math.max(1.15,size*.105),0,TAU);
  ctx.fillStyle='#103a72';ctx.fill();ctx.beginPath();ctx.arc(size*.58,-size*.18,Math.max(.55,size*.045),0,TAU);
  ctx.fillStyle='#fff';ctx.fill();

  if(stage>=3){
    ctx.strokeStyle='#ddffff';ctx.lineWidth=Math.max(1,size*.055);ctx.globalAlpha*=.82;
    for(const sign of [-1,1]){ctx.beginPath();ctx.ellipse(-size*.02,sign*size*.31,size*.34,size*.13,sign*.15,0,TAU);ctx.stroke();}
  }
  if(stage===4){
    ctx.globalAlpha*=.9;ctx.fillStyle='#f4ffff';
    for(const [x,y,r] of [[-.38,-.72,.09],[.2,.79,.08],[-.95,.6,.07]]){
      ctx.beginPath();ctx.arc(x*size,y*size,r*size,0,TAU);ctx.fill();
    }
    ctx.strokeStyle='#d9ffff';ctx.lineWidth=Math.max(1,size*.045);
    ctx.beginPath();ctx.moveTo(-size*1.42,0);ctx.quadraticCurveTo(-size*1.15,-size*.12,-size*.94,0);ctx.stroke();
  }
  ctx.restore();return true;
}
