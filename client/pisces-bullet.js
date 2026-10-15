const TAU=Math.PI*2;
const clamp=value=>Math.max(0,Math.min(1,value));
const smooth=(a,b,value)=>{const t=clamp((value-a)/(b-a));return t*t*(3-2*t);};

// Q는 물고기·아이콘 원화 없이 연속된 물줄기와 튀는 물방울로 그립니다.
export function preloadPiscesBullet(){return true;}

export function drawPiscesBullet(ctx,cast,elapsedMs,reducedMotion=false){
  const progress=clamp(elapsedMs/(cast.durationMs||650));
  const stage=Math.max(2,Math.min(4,Math.floor(cast.level||cast.stage||2)));
  const base=Math.max(1,cast.size||32);
  // Q should read as a traveling jet, not a thick droplet. The game sprite
  // size grows by stage; the visual reach grows further while the stream stays slim.
  const length=base*(stage===2?.98:stage===3?1.25:1.52);
  const thickness=length*(stage===2?.20:stage===3?.18:.16);
  const fade=Math.min(smooth(0,.11,progress),1-smooth(.84,1,progress));
  if(fade<=0)return true;
  const angle=Math.atan2(cast.dy??0,cast.dx??1),phase=reducedMotion?0:elapsedMs/180;
  ctx.save();ctx.translate(cast.x,cast.y);ctx.rotate(angle);ctx.globalAlpha*=fade;
  const alpha=ctx.globalAlpha;
  ctx.shadowColor='#55c9ff';ctx.shadowBlur=length*.12;
  const water=ctx.createLinearGradient(-length*.52,0,length*.52,0);
  water.addColorStop(0,'#5ab8efbd');water.addColorStop(.24,'#75d7ffeb');water.addColorStop(.64,'#d8fbff');water.addColorStop(.88,'#63c9f6f2');water.addColorStop(1,'#b9f4ffdf');
  ctx.fillStyle=water;ctx.beginPath();
  ctx.moveTo(-length*.5,0);
  ctx.bezierCurveTo(-length*.34,-thickness*(.38+Math.sin(phase)*.035),-length*.14,-thickness*.56,length*.12,-thickness*.30);
  ctx.bezierCurveTo(length*.27,-thickness*.18,length*.39,-thickness*.12,length*.5,0);
  ctx.bezierCurveTo(length*.36,thickness*.13,length*.22,thickness*.28,-length*.02,thickness*.36);
  ctx.bezierCurveTo(-length*.20,thickness*.48,-length*.36,thickness*.28,-length*.5,0);ctx.closePath();ctx.fill();
  ctx.shadowBlur=0;

  // 밝은 중심 물살과 양옆의 투명한 잔물결을 같은 궤적에 얹어 물줄기의 연속성을 강조합니다.
  ctx.lineCap='round';ctx.lineJoin='round';
  ctx.strokeStyle='#f0ffffe8';ctx.lineWidth=Math.max(1,thickness*.22);ctx.beginPath();
  ctx.moveTo(-length*.39,-thickness*.035);
  ctx.bezierCurveTo(-length*.16,-thickness*.17,length*.02,thickness*.12,length*.27,-thickness*.025);
  ctx.quadraticCurveTo(length*.39,-thickness*.08,length*.47,0);ctx.stroke();
  ctx.strokeStyle='#79d9ffbf';ctx.lineWidth=Math.max(.8,thickness*.10);ctx.beginPath();
  ctx.moveTo(-length*.43,thickness*.16);ctx.quadraticCurveTo(-length*.1,thickness*.03,length*.19,thickness*.20);
  ctx.quadraticCurveTo(length*.38,thickness*.28,length*.46,thickness*.03);ctx.stroke();
  ctx.strokeStyle='#ffffffbb';ctx.lineWidth=Math.max(.7,thickness*.075);ctx.beginPath();
  ctx.moveTo(-length*.32,-thickness*.22);ctx.quadraticCurveTo(-length*.02,-thickness*.34,length*.24,-thickness*.13);ctx.stroke();

  // 단계가 오를수록 물보라가 굵고 풍성해집니다. 방향을 뒤집지 않고 발사축을 따라 흩어집니다.
  const droplets=stage===2?4:stage===3?7:11;
  for(let i=0;i<droplets;i++){
    const phaseAt=reducedMotion?(i*.173)%1:((elapsedMs/520+i/droplets)%1+1)%1;
    const side=i%2?1:-1;
    const x=-length*(.47-phaseAt*.77),spread=thickness*(.22+phaseAt*.44);
    const y=side*(spread+Math.sin((i+1)*2.19+phase)*thickness*.10);
    const radius=thickness*(stage===4?.080:stage===3?.073:.065)*(1-phaseAt*.35);
    ctx.globalAlpha=alpha*(.34+.54*(1-phaseAt));
    const drop=ctx.createRadialGradient(x-radius*.25,y-radius*.35,0,x,y,radius);
    drop.addColorStop(0,'#f3ffff');drop.addColorStop(.42,i%3?'#8be4ff':'#d6faff');drop.addColorStop(1,'#4caee600');
    ctx.fillStyle=drop;ctx.beginPath();ctx.ellipse(x,y,radius*.76,radius*1.15,side*.18,0,TAU);ctx.fill();
  }
  ctx.globalAlpha=alpha;
  if(stage===4){
    // 최종 단계의 은하빛은 크기를 키우지 않고 물줄기 안쪽에서만 반짝입니다.
    ctx.fillStyle='#f8ffffd9';
    for(let i=0;i<3;i++){
      const x=length*(-.16+i*.21),y=Math.sin(i*2+phase*.35)*thickness*.12,r=Math.max(.7,thickness*.035);
      ctx.beginPath();ctx.arc(x,y,r,0,TAU);ctx.fill();
    }
  }
  ctx.restore();return true;
}
