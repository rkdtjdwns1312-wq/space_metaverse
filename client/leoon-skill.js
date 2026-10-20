import {LEOON_ROAR,LEOON_CHARGE} from '../shared/boss-skills.js';

const TAU=Math.PI*2;
const smooth=x=>{const t=Math.max(0,Math.min(1,x));return t*t*(3-2*t);};
// 12개의 고정된 동작 샘플을 이어 붙여 네트워크 틱과 무관하게 자세를 재생합니다.
export function leoonPoseFrame(skill,now){
  if(!skill)return {lift:0,bob:0,glow:0};
  if(skill.kind===LEOON_ROAR.kind){
    const progress=Math.max(0,Math.min(1,(now-skill.startsAt)/LEOON_ROAR.glowMs)),frame=Math.min(11,Math.floor(progress*12));
    return {lift:smooth(frame/11),bob:0,glow:Math.sin(Math.PI*frame/11)*.9+.25};
  }
  if(skill.stage==='stomp'){
    const elapsed=Math.max(0,now-skill.startsAt),frame=Math.min(11,Math.floor(elapsed/LEOON_CHARGE.stompMs*12));
    return {lift:0,bob:Math.max(0,Math.sin(frame/12*LEOON_CHARGE.stomps*TAU))*-.085,glow:.14};
  }
  return {lift:0,bob:0,glow:skill.stage==='dash'?.65:.25};
}
export function drawLeoonAura(ctx,monster,now){
  const skill=monster.leoonSkill;if(!skill)return;
  const r=monster.radius,pose=leoonPoseFrame(skill,now);
  ctx.save();ctx.translate(monster.x,monster.y-r*.1);
  if(skill.kind===LEOON_ROAR.kind){
    const alpha=skill.stage==='glow'?pose.glow:.35;
    const halo=ctx.createRadialGradient(0,-r*.15,r*.15,0,-r*.15,r*1.65);
    halo.addColorStop(0,`rgba(255,250,197,${alpha*.33})`);halo.addColorStop(.6,`rgba(255,180,43,${alpha*.18})`);halo.addColorStop(1,'rgba(255,146,26,0)');
    ctx.fillStyle=halo;ctx.beginPath();ctx.arc(0,-r*.15,r*1.65,0,TAU);ctx.fill();
    const mouthX=(monster.facingX||1)*r*.35,mouthY=-r*.47;
    ctx.strokeStyle=`rgba(255,239,161,${Math.min(.8,alpha+.25)})`;ctx.shadowColor='#ffc43b';ctx.shadowBlur=16;ctx.lineCap='round';
    for(let i=0;i<18;i++){
      const angle=i*TAU/18,inner=r*(.18+.06*Math.sin(i*3)),outer=r*(.35+.17*smooth((now-skill.startsAt)/LEOON_ROAR.glowMs));
      ctx.lineWidth=i%3===0?4:2;ctx.beginPath();ctx.moveTo(mouthX+Math.cos(angle)*inner,mouthY+Math.sin(angle)*inner);
      ctx.lineTo(mouthX+Math.cos(angle)*outer,mouthY+Math.sin(angle)*outer);ctx.stroke();
    }
  }else if(skill.stage==='stomp'){
    const elapsed=Math.max(0,now-skill.startsAt),step=Math.min(LEOON_CHARGE.stomps-1,Math.floor(elapsed/(LEOON_CHARGE.stompMs/LEOON_CHARGE.stomps)));
    const local=elapsed/(LEOON_CHARGE.stompMs/LEOON_CHARGE.stomps)-step;
    ctx.strokeStyle=`rgba(255,208,91,${(1-smooth(local))*.75})`;ctx.lineWidth=5;ctx.shadowColor='#ffb32c';ctx.shadowBlur=10;
    ctx.beginPath();ctx.ellipse(0,r*.8,r*(.55+local*.6),r*(.15+local*.2),0,0,TAU);ctx.stroke();
  }
  ctx.restore();
}
export function drawLeoonWarning(ctx,monster,now){
  const skill=monster.leoonSkill;if(!skill||skill.stage!=='warning')return;
  const duration=skill.kind===LEOON_ROAR.kind?LEOON_ROAR.warningMs:LEOON_CHARGE.warningMs;
  const remaining=Math.max(0,(skill.stageEndsAt-now)/1000),phase=smooth(1-(skill.stageEndsAt-now)/duration);
  ctx.save();ctx.strokeStyle='#ffe992';ctx.fillStyle=`rgba(255,125,39,${.13+phase*.19})`;ctx.lineWidth=4;
  ctx.shadowColor='#ffb13b';ctx.shadowBlur=15;ctx.setLineDash([14,9]);
  if(skill.kind===LEOON_ROAR.kind){
    for(const area of skill.areas||[]){ctx.beginPath();ctx.arc(area.x,area.y,area.radius,0,TAU);ctx.fill();ctx.stroke();}
  }else{
    const dx=skill.toX-skill.fromX,dy=skill.toY-skill.fromY,length=Math.hypot(dx,dy)||1,nx=-dy/length,ny=dx/length,w=skill.halfWidth;
    const startX=skill.fromX,startY=skill.fromY,endX=skill.toX,endY=skill.toY;
    ctx.beginPath();ctx.moveTo(startX+nx*w,startY+ny*w);ctx.lineTo(endX+nx*w,endY+ny*w);
    ctx.lineTo(endX-nx*w,endY-ny*w);ctx.lineTo(startX-nx*w,startY-ny*w);ctx.closePath();ctx.fill();ctx.stroke();
    ctx.setLineDash([]);ctx.beginPath();ctx.moveTo(startX,startY);ctx.lineTo(endX,endY);ctx.stroke();
  }
  ctx.setLineDash([]);ctx.shadowBlur=0;ctx.textAlign='center';ctx.textBaseline='middle';
  ctx.font='bold 23px "Jua","Malgun Gothic",sans-serif';ctx.strokeStyle='#7a3b3e';ctx.fillStyle='#fff8d7';ctx.lineWidth=5;
  const x=skill.kind===LEOON_ROAR.kind?monster.x:(skill.fromX+skill.toX)/2;
  const y=skill.kind===LEOON_ROAR.kind?monster.y:(skill.fromY+skill.toY)/2;
  ctx.strokeText(remaining.toFixed(1),x,y);ctx.fillText(remaining.toFixed(1),x,y);ctx.restore();
}
export function drawLeoonImpact(ctx,hit,progress){
  const p=Math.max(0,Math.min(1,progress));ctx.save();ctx.globalAlpha=(1-p)*.85;
  ctx.shadowColor='#ffbb39';ctx.shadowBlur=24;ctx.strokeStyle='#ffe998';ctx.fillStyle='#fff1ad33';ctx.lineWidth=7*(1-p)+1;
  if(hit.skillKind===LEOON_ROAR.kind){
    const radius=18+p*110;ctx.beginPath();ctx.arc(hit.x,hit.y,radius,0,TAU);ctx.fill();ctx.stroke();
    for(let i=0;i<12;i++){const a=i*TAU/12;ctx.beginPath();ctx.moveTo(hit.x+Math.cos(a)*radius*.65,hit.y+Math.sin(a)*radius*.65);
      ctx.lineTo(hit.x+Math.cos(a)*radius*1.4,hit.y+Math.sin(a)*radius*1.4);ctx.stroke();}
  }else{
    const distance=hit.reach||0,nx=-hit.dy,ny=hit.dx,w=(hit.halfWidth||50)*(1-p*.6);
    ctx.beginPath();ctx.moveTo(hit.x+nx*w,hit.y+ny*w);ctx.lineTo(hit.x+hit.dx*distance+nx*w,hit.y+hit.dy*distance+ny*w);
    ctx.lineTo(hit.x+hit.dx*distance-nx*w,hit.y+hit.dy*distance-ny*w);ctx.lineTo(hit.x-nx*w,hit.y-ny*w);ctx.closePath();ctx.stroke();
  }
  ctx.restore();
}
