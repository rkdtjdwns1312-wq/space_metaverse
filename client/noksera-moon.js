import {NOKSERA_MOON_PHASE as MOON} from '../shared/boss-skills.js';
import {nokseraPoseCells} from './noksera-pose-cells.js';

export const NOKSERA_MOON_ART=Object.freeze({src:'/assets/monsters/noksera-moon-summon.png',moon:'/assets/maps/paradise-moon.png'});
let sheet,moon,frames,loading;
const clamp=x=>Math.max(0,Math.min(1,x));
export function preloadNokseraMoon(){
  if(typeof Image==='undefined')return;
  if(!sheet){sheet=new Image();sheet.src=NOKSERA_MOON_ART.src;moon=new Image();moon.src=NOKSERA_MOON_ART.moon;}
  if(!loading)loading=Promise.all([sheet.decode(),moon.decode()]).then(()=>{frames=nokseraPoseCells(sheet);}).catch(error=>{loading=null;throw error;});
  return loading;
}
export function nokseraMoonPhase(m,now=Date.now()){
  const aura=m.moonAura;if(!aura||now>=aura.endsAt)return null;
  const cast=m.moonCast,forming=now<aura.startsAt;
  if(forming&&!cast)return null;
  const full=now>=aura.fullStartsAt&&now<aura.fullEndsAt;
  const waning=now>=aura.fullEndsAt;
  const fraction=forming?.08:full?1:waning?1-.94*clamp((now-aura.fullEndsAt)/MOON.waneMs):.08+.92*clamp((now-aura.startsAt)/MOON.waxMs);
  return {forming,full,waning,fraction,descent:forming?clamp((now-cast.startsAt)/MOON.castMs):1,
    alpha:forming?clamp((now-cast.startsAt)/450):clamp((aura.endsAt-now)/700),remaining:Math.max(0,(aura.fullEndsAt-now)/1000)};
}
export function drawNokseraMoonCast(ctx,m,now=Date.now()){
  if(m.shape!=='noksera'||!m.moonCast||now>=m.moonCast.endsAt)return false;
  if(!sheet)void preloadNokseraMoon()?.catch(()=>{});if(!frames)return false;
  const elapsed=now-m.moonCast.startsAt,p=elapsed<700?clamp(elapsed/700):elapsed<1600?1:clamp((MOON.castMs-elapsed)/400);
  const frame=frames[Math.round(p*7)],w=m.radius*2.05;
  ctx.save();ctx.translate(m.x,m.y+m.radius*.9);ctx.scale(m.facingX<0?1:-1,1);ctx.drawImage(frame.canvas,-w/2,-w*frame.footY,w,w);ctx.restore();return true;
}
export function drawNokseraMoon(ctx,m,now=Date.now()){
  if(m.shape!=='noksera')return;
  const phase=nokseraMoonPhase(m,now);if(!phase)return;
  if(!moon)void preloadNokseraMoon()?.catch(()=>{});if(!moon?.complete||!moon.naturalWidth)return;
  const r=m.radius*.25,top=m.y+m.radius*.9-m.radius*2.05*1221/1289;
  const ease=1-(1-phase.descent)**2,x=m.x+(m.facingX<0?-1:1)*m.radius*.25,y=top-r*1.55-m.radius*.6*(1-ease);
  ctx.save();ctx.translate(x,y);ctx.globalAlpha=phase.alpha;
  // Reuse the painted moon from this map; phase changes reveal its texture.
  ctx.save();ctx.scale(phase.waning?-1:1,1);ctx.beginPath();ctx.arc(0,0,r,-Math.PI/2,Math.PI/2);
  const k=1-2*phase.fraction;
  for(let i=0;i<=80;i++){const yy=r-2*r*i/80;ctx.lineTo(k*Math.sqrt(Math.max(0,r*r-yy*yy)),yy);}
  ctx.closePath();ctx.save();ctx.clip();ctx.drawImage(moon,-r*1.16,-r*1.16,r*2.32,r*2.32);ctx.restore();
  ctx.lineWidth=1.5;ctx.strokeStyle=phase.full?'#fff7b9':'#e4f3ff';ctx.shadowColor=phase.full?'#fff0a1':'#b2d7ff';ctx.shadowBlur=phase.full?18:8;ctx.stroke();ctx.restore();
  if(phase.full){ctx.shadowBlur=0;ctx.font='bold 15px "Jua","Malgun Gothic",sans-serif';ctx.textAlign='center';ctx.fillStyle='#fff4bf';ctx.strokeStyle='#343454';ctx.lineWidth=4;
    const text=`피해 반사 ${Math.ceil(phase.remaining)}초`;ctx.strokeText(text,0,-r-14);ctx.fillText(text,0,-r-14);}
  ctx.restore();
}
