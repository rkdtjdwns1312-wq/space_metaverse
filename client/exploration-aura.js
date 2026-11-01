// 기운 15/15일 때만 재생하는 24장의 반복 별빛. 같은 장치 좌표에서 별이 밖으로 퍼집니다.
export const EXPLORATION_AURA_FRAMES=24;
export function explorationAuraFrame(time){return Math.floor(Math.max(0,time)/125)%EXPLORATION_AURA_FRAMES;}
export function explorationAuraStars(frame,radius){
  const stars=[];
  for(let i=0;i<12;i++){
    const age=(frame-i*2+EXPLORATION_AURA_FRAMES)%EXPLORATION_AURA_FRAMES;
    const progress=age/(EXPLORATION_AURA_FRAMES-1);
    const angle=i*Math.PI*(3-Math.sqrt(5))+(i%3-1)*.13;
    const distance=radius*(.16+.84*progress);
    stars.push({x:Math.cos(angle)*distance,y:Math.sin(angle)*distance*.72,
      size:2.8+(i%3)*1.15,alpha:Math.sin(Math.PI*progress)*.8});
  }
  return stars;
}
export function drawExplorationAura(ctx,o,time,reducedMotion=false){
  const radius=o.radius*3,frame=reducedMotion?12:explorationAuraFrame(time);
  ctx.save();
  const glow=ctx.createRadialGradient(o.x,o.y-69,8,o.x,o.y-69,radius);
  glow.addColorStop(0,'#fff8d24d');glow.addColorStop(.44,'#ffedb921');glow.addColorStop(1,'#fff0b900');
  ctx.fillStyle=glow;ctx.beginPath();ctx.ellipse(o.x,o.y-69,radius,radius*.72,0,0,Math.PI*2);ctx.fill();
  for(const star of explorationAuraStars(frame,radius)){
    if(star.alpha<.02)continue;
    const x=o.x+star.x,y=o.y-69+star.y;
    ctx.globalAlpha=star.alpha;
    ctx.fillStyle='#fff9de';ctx.beginPath();ctx.arc(x,y,star.size*.55,0,Math.PI*2);ctx.fill();
    ctx.strokeStyle='#fff0ac';ctx.lineWidth=1.6;ctx.beginPath();ctx.moveTo(x-star.size*2.1,y);ctx.lineTo(x+star.size*2.1,y);ctx.moveTo(x,y-star.size*2.1);ctx.lineTo(x,y+star.size*2.1);ctx.stroke();
  }
  ctx.restore();
}
