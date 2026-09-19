import {SKILL_EFFECTS} from '/shared/skill-effects.js';
import {drawSkillEffect} from '/skill-effects.js';
const gallery=document.querySelector('#effects-gallery');
const reducedMotion=document.querySelector('#reduced-motion');
const preference=matchMedia('(prefers-reduced-motion: reduce)');
reducedMotion.checked=preference.matches;
preference.addEventListener('change',event=>{reducedMotion.checked=event.matches;});
const canvases=new Map(),visible=new Set(),groups=new Map();
let playing=true,frame=0,lastTime=performance.now();
for(const effect of SKILL_EFFECTS){
  if(!groups.has(effect.constellationId))groups.set(effect.constellationId,[]);
  groups.get(effect.constellationId).push(effect);
}
for(const effects of groups.values()){
  const row=document.createElement('section');row.className='constellation-row';
  const title=document.createElement('h2');title.textContent=effects[0].constellationName;row.append(title);
  const cells=document.createElement('div');cells.className='level-grid';
  for(const effect of effects){
    const card=document.createElement('article');card.className='effect-card';card.dataset.effectId=effect.id;
    card.style.setProperty('--accent',effect.accent);card.style.setProperty('--color',effect.color);
    card.innerHTML=`<div class="card-top"><span>LV${effect.level}</span><button type="button" class="play-one">재생</button></div><canvas width="320" height="230" aria-label="${effect.constellationName} LV${effect.level} ${effect.name}"></canvas><h3>${effect.name}</h3>`;
    const canvas=card.querySelector('canvas'),item={canvas,effect,progress:.5,oneShot:false,lastDraw:null};
    canvases.set(canvas,item);
    // 전체가 정지되어 있어도 선택한 카드만 한 번 재생할 수 있습니다.
    card.querySelector('.play-one').addEventListener('click',()=>{item.progress=0;item.oneShot=true;});
    cells.append(card);
  }
  row.append(cells);gallery.append(row);
}
const observer=new IntersectionObserver(entries=>{
  for(const entry of entries){const item=canvases.get(entry.target);if(entry.isIntersecting)visible.add(item);else visible.delete(item);}
},{rootMargin:'180px 0px'});
for(const canvas of canvases.keys())observer.observe(canvas);
document.querySelector('#play-all').addEventListener('click',()=>{playing=true;});
document.querySelector('#pause-all').addEventListener('click',()=>{playing=false;for(const item of canvases.values())item.oneShot=false;});
function render(now){
  const delta=Math.min(80,now-lastTime);lastTime=now;
  for(const item of visible){
    if((playing||item.oneShot)&&!reducedMotion.checked){
      item.progress+=delta/item.effect.durationMs;
      if(item.progress>=1){item.progress=playing?item.progress%1:.55;item.oneShot=false;}
    }
    const progress=reducedMotion.checked?.55:item.progress;
    const signature=progress+':'+reducedMotion.checked;
    if(item.lastDraw===signature)continue;
    item.lastDraw=signature;item.canvas.dataset.progress=String(progress);
    const ctx=item.canvas.getContext('2d');ctx.clearRect(0,0,320,230);
    ctx.save();ctx.translate(80,125);
    drawSkillEffect(ctx,item.effect,progress,{reducedMotion:reducedMotion.checked});ctx.restore();
  }
  frame=requestAnimationFrame(render);
}
frame=requestAnimationFrame(render);
window.addEventListener('pagehide',()=>{cancelAnimationFrame(frame);});
window.addEventListener('pageshow',event=>{if(event.persisted){lastTime=performance.now();frame=requestAnimationFrame(render);}});
