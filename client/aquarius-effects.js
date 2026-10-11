import {AQUARIUS_VFX,aquariusFrameAt,aquariusAreaAt,aquariusTimingOf} from '/shared/aquarius-skills.js';
const images=new Map();
export function preloadAquarius(){
  for(const spec of [AQUARIUS_VFX.attack,{id:'water-area',url:'/assets/skills/aquarius/water-area.png'}])if(!images.has(spec.id)){
    const image=new Image();image.src=spec.url;images.set(spec.id,image);
  }
}
export function drawAquarius(ctx,cast,elapsedMs,reducedMotion=false){
  if(!cast.kind?.startsWith('aquarius-'))return false;
  if(cast.kind==='aquarius-fountain'){
    drawWaterArea(ctx,cast,elapsedMs,reducedMotion);return true;
  }
  const spec=AQUARIUS_VFX[cast.vfxId];if(!spec)return false;
  preloadAquarius();const image=images.get(spec.id);
  if(!image?.complete||!image.naturalWidth)return true;
  const frame=reducedMotion?12:aquariusFrameAt(elapsedMs,true);
  const width=cast.size*1.2,height=width;
  ctx.save();ctx.translate(cast.x,cast.y);
  ctx.rotate(Math.atan2(cast.dy,cast.dx));
  if(reducedMotion)ctx.globalAlpha=Math.min(1,elapsedMs/150,(cast.durationMs-elapsedMs)/250);
  ctx.drawImage(image,(frame%6)*256,Math.floor(frame/6)*256,256,256,-width*spec.anchor.x,-height*spec.anchor.y,width,height);
  ctx.restore();return true;
}
function drawWaterArea(ctx,cast,elapsedMs,reducedMotion){
  preloadAquarius();
  const area=aquariusAreaAt(cast,elapsedMs),{rx,ry,scale}=area;
  if(scale<=0)return;
  const time=reducedMotion?0:elapsedMs/1000;
  ctx.save();ctx.translate(area.x,area.y);
  // 물빛·물결·별 모두 판정 타원 안에 제한해 바깥에 가짜 범위를 만들지 않습니다.
  ctx.beginPath();ctx.ellipse(0,0,rx,ry,0,0,Math.PI*2);ctx.clip();
  ctx.globalAlpha*=Math.min(1,scale*3);
  const water=ctx.createLinearGradient(0,-ry,0,ry);
  water.addColorStop(0,'#79d9efb8');water.addColorStop(.48,'#328dcbbd');water.addColorStop(1,'#174b94d9');
  ctx.fillStyle=water;ctx.fillRect(-rx,-ry,rx*2,ry*2);
  const art=images.get('water-area');
  if(art?.complete&&art.naturalWidth){
    ctx.save();ctx.globalAlpha*=.94;
    // 원화 위아래 투명 여백만 건너뛰어 물의 테두리와 실제 타원 범위를 맞춥니다.
    ctx.drawImage(art,0,art.naturalHeight*.10,art.naturalWidth,art.naturalHeight*.80,-rx,-ry,rx*2,ry*2);
    ctx.restore();
  }
  // 겹친 물빛과 부드러운 반사광으로 평평한 도형 대신 깊이 있는 별빛 수면을 만듭니다.
  for(let i=0;i<5;i++){
    const x=Math.cos(i*2.1)*rx*.53,y=Math.sin(i*2.1+time*.22)*ry*.48;
    ctx.save();ctx.translate(x,y);ctx.scale(1,.45);
    const radius=rx*(.25+i*.025),light=ctx.createRadialGradient(0,0,0,0,0,radius);
    light.addColorStop(0,i%2?'#c2fbff48':'#5378e55c');light.addColorStop(1,'#8eeeff00');
    ctx.fillStyle=light;ctx.fillRect(-radius,-radius,radius*2,radius*2);ctx.restore();
  }
  ctx.lineWidth=2;ctx.strokeStyle='#bbf1eebb';
  ctx.beginPath();ctx.ellipse(0,0,Math.max(.01,rx-1),Math.max(.01,ry-1),0,0,Math.PI*2);ctx.stroke();
  // 불규칙한 가로 물결과 얇은 하이라이트로 기존 2D 배경의 붓결을 맞춥니다.
  for(let row=0;row<7;row++){
    const y=(row-3)*ry*.25;
    ctx.beginPath();
    for(let step=0;step<=24;step++){
      const x=-rx+rx*2*step/24,py=y+Math.sin(step*.65+time*1.4+row*1.7)*ry*.045;
      if(step===0)ctx.moveTo(x,py);else ctx.lineTo(x,py);
    }
    ctx.strokeStyle=row%2?'#c6f8ff38':'#66bfe827';ctx.lineWidth=row%2?1.5:3;ctx.stroke();
  }
  for(let i=0;i<18;i++){
    const angle=i*2.399963,r=Math.sqrt((i+.5)/18)*.88;
    const x=Math.cos(angle)*rx*r,y=Math.sin(angle)*ry*r;
    const twinkle=reducedMotion?.75:.55+.45*Math.sin(time*2.2+i*1.9)**2;
    const star=(i%3===0?3.8:2.1)*Math.min(1,scale*2)*twinkle;
    ctx.fillStyle=i%3?'#e6fbff':'#fff2b5';ctx.beginPath();
    ctx.moveTo(x,y-star*1.5);ctx.lineTo(x+star*.4,y-star*.35);ctx.lineTo(x+star,y);
    ctx.lineTo(x+star*.4,y+star*.35);ctx.lineTo(x,y+star*1.5);
    ctx.lineTo(x-star*.4,y+star*.35);ctx.lineTo(x-star,y);ctx.lineTo(x-star*.4,y-star*.35);
    ctx.closePath();ctx.fill();
  }
  for(let i=0;i<4;i++){
    const pulse=reducedMotion?.5:(time*.25+i*.25)%1;
    ctx.strokeStyle=`rgba(208,249,255,${.18*Math.sin(pulse*Math.PI)})`;ctx.lineWidth=1.2;
    ctx.beginPath();ctx.ellipse(Math.cos(i*2)*rx*.32,Math.sin(i*2)*ry*.3,
      rx*(.07+pulse*.13),ry*(.07+pulse*.13),0,.2,Math.PI*1.85);ctx.stroke();
  }
  const {growMs,holdMs}=aquariusTimingOf(cast);
  if(elapsedMs>=growMs&&elapsedMs<growMs+holdMs){
    // 최대 범위 유지 중 수면 안쪽에서 낮게 피어오르는 물방울입니다.
    for(let i=0;i<12;i++){
      const phase=reducedMotion?.45:((elapsedMs-growMs)/2400+i*.618034)%1;
      const angle=i*2.399963,r=.2+(i%5)*.12;
      const x=Math.cos(angle)*rx*r,y=Math.sin(angle)*ry*r-phase*cast.size*.15;
      const radius=(1.7+i%3*.6)*Math.min(1,phase*5,(1-phase)*5);
      if(radius<=0)continue;
      ctx.fillStyle='#b6efff9c';ctx.strokeStyle='#e3fbffc9';ctx.lineWidth=.8;
      ctx.beginPath();ctx.ellipse(x,y,radius,radius*1.25,0,0,Math.PI*2);ctx.fill();ctx.stroke();
      ctx.fillStyle='#f0ffff';ctx.beginPath();ctx.arc(x-radius*.25,y-radius*.4,radius*.25,0,Math.PI*2);ctx.fill();
    }
  }
  ctx.restore();
}
export function createAquariusEffects(canvas){
  let active=[];
  return {
    clear(){active=[];},
    sync(list){const now=performance.now(),old=new Map(active.map(c=>[c.id,c]));active=list.map(c=>{
      const previous=old.get(c.id),expected=now-c.elapsedMs;
      return {...c,startsAt:previous&&Math.abs(previous.startsAt-expected)<150?previous.startsAt:expected};
    });},
    draw(ctx,now,reducedMotion){
      active=active.filter(c=>now-c.startsAt<c.durationMs);
      for(const c of active)drawAquarius(ctx,c,now-c.startsAt,reducedMotion);
      canvas.dataset.aquariusCasts=String(active.length);
      if(active.length)canvas.dataset.aquariusFrame=String(aquariusFrameAt(now-active[0].startsAt,false,active[0]));
    }
  };
}
