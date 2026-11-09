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
export function drawExplorationAura(ctx,o,time,reducedMotion=false,lowQuality=false){
  const still=reducedMotion||lowQuality;
  const pulse=still?1:1+Math.sin(time/650)*.06;
  const radius=o.radius*3.3*pulse,frame=still?12:explorationAuraFrame(time);
  ctx.save();
  const glow=ctx.createRadialGradient(o.x,o.y-69,8,o.x,o.y-69,radius);
  glow.addColorStop(0,'#fffbeedb');glow.addColorStop(.35,'#ffe7a6a8');glow.addColorStop(.68,'#ffce574d');glow.addColorStop(1,'#fff0b900');
  ctx.fillStyle=glow;ctx.beginPath();ctx.ellipse(o.x,o.y-69,radius,radius*.72,0,0,Math.PI*2);ctx.fill();
  // A full device remains recognizable at low quality: static light and four
  // large glints, with no blur, particles, or animation buffers.
  const stars=lowQuality?[{x:-72,y:-42,size:6,alpha:1},{x:72,y:-15,size:7,alpha:1},{x:-65,y:45,size:5,alpha:1},{x:30,y:-99,size:6,alpha:1}]:explorationAuraStars(frame,radius);
  for(const star of stars){
    if(star.alpha<.02)continue;
    const x=o.x+star.x,y=o.y-69+star.y;
    ctx.globalAlpha=star.alpha;
    ctx.fillStyle='#fff9de';ctx.beginPath();ctx.arc(x,y,star.size*.55,0,Math.PI*2);ctx.fill();
    ctx.strokeStyle='#fff5c4';ctx.lineWidth=2.4;ctx.beginPath();ctx.moveTo(x-star.size*2.7,y);ctx.lineTo(x+star.size*2.7,y);ctx.moveTo(x,y-star.size*2.7);ctx.lineTo(x,y+star.size*2.7);ctx.stroke();
  }
  ctx.restore();
}
