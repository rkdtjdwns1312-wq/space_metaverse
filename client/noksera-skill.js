import {NOKSERA_HORN_BURST as SKILL} from '../shared/boss-skills.js';
import {nokseraPoseCells} from './noksera-pose-cells.js';

export const NOKSERA_SKILL_ART=Object.freeze({src:'/assets/monsters/noksera-horn-burst.png',columns:4,rows:2,frames:8,footY:.975});
let sheet,frames,loading;
const clamp=n=>Math.max(0,Math.min(1,n));
export function preloadNokseraSkill(){
  if(!sheet&&typeof Image!=='undefined'){sheet=new Image();sheet.src=NOKSERA_SKILL_ART.src;}
  if(sheet&&!loading)loading=sheet.decode().then(()=>{frames=nokseraPoseCells(sheet);}).catch(error=>{loading=null;throw error;});
  return loading;
}
export function nokseraSkillPose(m,time,attack,now=Date.now()){
  // Release takes priority over a warning snapshot received just before the hit.
  if(attack?.skillKind===SKILL.kind){
    const elapsed=time-attack.startedAt;
    if(elapsed>=0&&elapsed<SKILL.durationMs)return 7*(1-clamp(elapsed/SKILL.durationMs));
  }
  const mark=m.warning;
  if(mark?.kind!==SKILL.kind||mark.endsAt<=now)return null;
  const elapsed=Math.max(0,now-mark.startsAt);
  return elapsed<1000?4*elapsed/1000:4+3*clamp((elapsed-1000)/1600);
}
export function drawNokseraSkill(ctx,m,time,attack){
  if(m.shape!=='noksera')return false;
  const pose=nokseraSkillPose(m,time,attack);if(pose===null)return false;
  if(!sheet)void preloadNokseraSkill()?.catch(()=>{});
  if(!frames)return false;
  const frame=frames[Math.round(pose)],w=m.radius*2.05;
  ctx.save();ctx.translate(m.x,m.y+m.radius*.9);ctx.scale(m.facingX<0?1:-1,1);
  // Real poses, one at a time: no warped face, vertical flip, or layered ghost images.
  ctx.drawImage(frame.canvas,-w/2,-w*frame.footY,w,w);
  ctx.restore();return true;
}

export function drawNokseraWarning(ctx,mark,now=Date.now()){
  const p=clamp((now-mark.startsAt)/(mark.endsAt-mark.startsAt));
  ctx.save();ctx.translate(mark.x,mark.y);ctx.lineWidth=4;
  ctx.fillStyle='#a4bfff24';ctx.strokeStyle='#ffe8a2';
  ctx.beginPath();ctx.arc(0,0,mark.radius,0,Math.PI*2);ctx.fill();ctx.stroke();
  ctx.lineWidth=6;ctx.strokeStyle='#fff8d9';ctx.beginPath();ctx.arc(0,0,mark.radius,-Math.PI/2,-Math.PI/2+Math.PI*2*p);ctx.stroke();
  // Static hatching remains readable without rapid flashing.
  ctx.strokeStyle='#c3d8ff';ctx.lineWidth=2;
  for(let i=0;i<20;i++){const a=i*Math.PI/10;ctx.beginPath();ctx.moveTo(Math.cos(a)*mark.radius*.94,Math.sin(a)*mark.radius*.94);ctx.lineTo(Math.cos(a)*mark.radius,Math.sin(a)*mark.radius);ctx.stroke();}
  ctx.font='bold 25px "Jua","Malgun Gothic",sans-serif';ctx.textAlign='center';ctx.fillStyle='#fff9df';ctx.strokeStyle='#343960';ctx.lineWidth=5;
  const text=`달빛 뿔 · ${Math.max(0,(mark.endsAt-now)/1000).toFixed(1)}초`;
  ctx.strokeText(text,0,mark.radius*.68);ctx.fillText(text,0,mark.radius*.68);ctx.restore();
}

export function drawNokseraBurst(ctx,hit,progress,reduced=false){
  if(hit.skillKind!==SKILL.kind||!hit.warningRadius)return;
  const p=clamp(progress);if(p>=1)return;
  const radius=hit.warningRadius,dir=hit.dx<0?-1:1;
  ctx.save();
  // First light comes from the lowered antlers and expands into the warned ground circle.
  const travel=reduced?1:Math.sin(Math.min(1,p*2)*Math.PI/2);
  ctx.translate(hit.warningX+dir*100*(1-travel),hit.warningY-125*(1-travel));
  ctx.globalAlpha=(1-p)*.75;
  const r=Math.max(1,radius*(.04+.96*travel)),glow=ctx.createRadialGradient(0,0,r*.02,0,0,r);
  glow.addColorStop(0,'#fff9ddaa');glow.addColorStop(.32,'#cce8ff44');glow.addColorStop(.88,'#d6e9ff22');glow.addColorStop(1,'#f9e9b900');
  ctx.fillStyle=glow;ctx.beginPath();ctx.arc(0,0,r,0,Math.PI*2);ctx.fill();
  ctx.shadowColor='#d5e9ff';ctx.shadowBlur=14;
  for(let i=0;i<3;i++){
    const rr=r*(1-i*.14);ctx.lineWidth=5-i;ctx.strokeStyle=i%2?'#bedcff':'#fff4cf';ctx.beginPath();ctx.arc(0,0,rr,0,Math.PI*2);ctx.stroke();
  }
  for(let i=0;i<24;i++){
    const angle=i*Math.PI/12,d=r*(.7+(i%3)*.1),x=Math.cos(angle)*d,y=Math.sin(angle)*d,s=(1-p)*(i%2?7:12);
    ctx.fillStyle=i%2?'#d9ecff':'#fff4c9';ctx.beginPath();ctx.moveTo(x,y-s);ctx.lineTo(x+s*.28,y);ctx.lineTo(x,y+s);ctx.lineTo(x-s*.28,y);ctx.closePath();ctx.fill();
  }
  ctx.restore();
}
