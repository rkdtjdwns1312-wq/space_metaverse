// 파스텔 별화살·별여우·별자리 지대. 타격 횟수/대상은 서버 이벤트만 따릅니다.
import {SAGITTARIUS_VFX} from '/shared/sagittarius-skills.js';
const fox=new Image();fox.src='/assets/skills/sagittarius/star-fox.svg';
const spriteImages=new Map();
export function preloadSagittarius(ids=Object.keys(SAGITTARIUS_VFX)){
  for(const id of ids){const spec=SAGITTARIUS_VFX[id];if(!spec||spriteImages.has(spec.url))continue;
    const image=new Image();image.src=spec.url;spriteImages.set(spec.url,image);}
}
function star(ctx,x,y,r){
  ctx.beginPath();for(let i=0;i<10;i++){const a=i*Math.PI/5-Math.PI/2,s=i%2?r*.48:r;ctx.lineTo(x+Math.cos(a)*s,y+Math.sin(a)*s);}ctx.closePath();ctx.fill();ctx.stroke();
}
function circle(ctx,x,y,r){ctx.beginPath();ctx.arc(x,y,r,0,Math.PI*2);ctx.stroke();}
// 별 모양 화살촉과 크림색 중심, 연보라 가장자리로 작은 화면에서도 구분합니다.
function arrow(ctx,x,y,length,scale=1){
  ctx.save();ctx.translate(x,y);const w=6*scale;
  const gradient=ctx.createLinearGradient(-length,0,0,0);gradient.addColorStop(0,'#cdbbff00');gradient.addColorStop(.5,'#d6c5f4aa');gradient.addColorStop(1,'#fff2bd');
  ctx.fillStyle=gradient;ctx.beginPath();ctx.moveTo(-length,-w*.3);ctx.quadraticCurveTo(-length*.4,-w*1.7,0,0);ctx.quadraticCurveTo(-length*.4,w*1.7,-length,w*.3);ctx.fill();
  ctx.strokeStyle='#fff7df';ctx.lineWidth=3*scale;ctx.beginPath();ctx.moveTo(-length*.65,0);ctx.lineTo(0,0);ctx.stroke();
  ctx.fillStyle='#fff0b0';ctx.strokeStyle='#cda775';ctx.lineWidth=1.5;star(ctx,0,0,9*scale);
  ctx.fillStyle='#fffdf2';ctx.strokeStyle='#fffdf2';star(ctx,-1,-1,3*scale);ctx.restore();
}
function sparkle(ctx,r,progress,count=5){
  ctx.globalAlpha=1-progress;for(let i=0;i<count;i++){const a=i*Math.PI*2/count;star(ctx,Math.cos(a)*r*progress,Math.sin(a)*r*progress,3+4*(1-progress));}
}
export function drawSagittarius(ctx,effect,progress,time,reducedMotion=false){
  ctx.save();ctx.translate(effect.x,effect.y);ctx.strokeStyle='#d8b789';ctx.fillStyle='#fff5ce';ctx.lineWidth=1.7;ctx.lineJoin='round';ctx.lineCap='round';
  ctx.shadowColor='#f5d995';ctx.shadowBlur=reducedMotion?0:10;
  const size=effect.size||80;
  if(effect.kind==='arrow'){
    const spec=SAGITTARIUS_VFX[effect.vfxId];if(spec){
      preloadSagittarius([spec.id]);const image=spriteImages.get(spec.url);
      if(image?.complete&&image.naturalWidth){
        const frame=reducedMotion?12:Math.min(23,Math.floor(progress*24));
        const stage=Number(spec.id.slice(-1));const scale=effect.basic?.95:stage===2?1.5:stage===3?1.75:2;
        const width=size*scale;
        if((effect.dx??1)<0){ctx.scale(-1,1);ctx.rotate(Math.atan2(effect.dy??0,-effect.dx));}
        else ctx.rotate(Math.atan2(effect.dy??0,effect.dx??1));
        ctx.drawImage(image,(frame%6)*256,Math.floor(frame/6)*256,256,256,-width/2,-width/2,width,width);
        ctx.restore();return;
      }
    }
    if(effect.dx<0){ctx.scale(-1,1);ctx.rotate(Math.atan2(effect.dy,-effect.dx));}
    else ctx.rotate(Math.atan2(effect.dy,effect.dx));
    const start=size/2,end=effect.range;
    const head=effect.projectile?0:start+(end-start)*Math.min(1,progress*1.6);
    ctx.globalAlpha=1-progress*.7;arrow(ctx,head,0,size*(effect.basic ? .7 : 1.3),effect.basic?1:1.7);
    for(let i=0;i<3;i++){ctx.fillStyle=i%2?'#e4d5fa':'#fff5ce';star(ctx,head-size*(.25+i*.22),Math.sin(i*3+1)*10,3);}
  }else if(effect.kind==='hunter'){
    ctx.scale(effect.dx<0?-1:1,1);const bounce=reducedMotion?0:Math.sin(time/240)*size*.035;
    // 한 장 원화의 부유/좌우 반전으로 복잡한 걷기 프레임 없이 동화풍을 유지합니다.
    if(fox.complete&&fox.naturalWidth)ctx.drawImage(fox,-size*.56,-size*.6+bounce,size*1.12,size*.84);
    else star(ctx,0,-size*.2,size*.2);
    ctx.globalAlpha=.6;star(ctx,-size*.38,-size*.15+bounce,4);
  }else if(effect.kind==='rain'){
    const r=effect.radius;const glow=ctx.createRadialGradient(0,0,r*.1,0,0,r);
    glow.addColorStop(0,'#fff2b921');glow.addColorStop(1,'#cbb9ed30');ctx.fillStyle=glow;
    ctx.beginPath();ctx.arc(0,0,r,0,Math.PI*2);ctx.fill();ctx.globalAlpha=.75;ctx.strokeStyle='#e3c78f';circle(ctx,0,0,r);
    ctx.strokeStyle='#ede2fa';ctx.beginPath();
    for(let i=0;i<5;i++){const a=i*Math.PI*4/5-Math.PI/2;ctx.lineTo(Math.cos(a)*r*.8,Math.sin(a)*r*.8);}ctx.closePath();ctx.stroke();
    for(let i=0;i<5;i++){const a=i*Math.PI*2/5-Math.PI/2;ctx.fillStyle='#fff2bf';star(ctx,Math.cos(a)*r*.8,Math.sin(a)*r*.8,5);}
    // 장식 화살은 만들지 않습니다. 서버의 rain-hit 5건만 실제 낙하로 표시합니다.
  }else if(effect.kind==='rain-hit'||effect.kind==='great-arrow'){
    const large=effect.kind==='great-arrow',r=effect.radius;
    const a=((effect.pulseIndex||1)-1)*Math.PI*2/5,spread=large?0:r*.42;
    ctx.translate(Math.cos(a)*spread,Math.sin(a)*spread);
    const fall=Math.min(1,progress/.48),height=large?size*2:size;
    ctx.save();ctx.translate(0,-height*(1-fall));ctx.rotate(Math.PI/2);
    ctx.globalAlpha=progress>.65?Math.max(0,(1-progress)/.35):1;
    arrow(ctx,0,0,large?size*1.7:size*.7,large?3:1.3);ctx.restore();
    if(progress>=.48){const p=(progress-.48)/.52;ctx.globalAlpha=(1-p)*.8;circle(ctx,0,0,(large?r:size*.35)*p);sparkle(ctx,large?r*.8:size*.35,p,large?8:3);}
  }else if(effect.kind==='hunter-hit'){
    ctx.rotate(Math.atan2(effect.dy,effect.dx));arrow(ctx,size*.2*progress,-size*.1,size*.4,1);sparkle(ctx,size*.24,progress,3);
  }else if(effect.kind==='hunter-fade'){
    ctx.globalAlpha=1-progress;circle(ctx,0,-size*.12,size*.35*(.5+progress));sparkle(ctx,size*.45,progress,5);
  }
  ctx.restore();
}
