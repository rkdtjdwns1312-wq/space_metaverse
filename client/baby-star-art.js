const sprite=new Image();
sprite.src='/assets/monsters/baby-energy-star.png';

// 따뜻한 기운과 서늘한 기운이 번갈아 빛나고, 공격 때 작은 별이 앞으로 굴러갑니다.
export function drawBabyStar(ctx,monster,time=0,attack=null){
  if(monster.shape!=='baby-energy-star')return false;
  const r=monster.radius;
  const phase=attack?Math.max(0,Math.min(1,(time-attack.startedAt)/attack.durationMs)):0;
  const lunge=attack?Math.sin(Math.PI*phase)*r*.27:0;
  const bob=monster.moving?Math.sin(time/125)*r*.055:Math.sin(time/580)*r*.035;
  const turn=attack?Math.sin(Math.PI*phase)*.19*(monster.facingX||1):Math.sin(time/850)*.025;
  ctx.save();
  ctx.translate(monster.x+(monster.facingX||1)*lunge,monster.y+bob);
  ctx.rotate(turn);
  if((monster.facingX||1)<0)ctx.scale(-1,1);
  const side=r*2.75;
  if(sprite.complete&&sprite.naturalWidth)ctx.drawImage(sprite,-side/2,-side*.69,side,side);
  if(attack){
    const glow=ctx.createRadialGradient(r*.42,-r*.15,r*.12,r*.42,-r*.15,r*1.15);
    glow.addColorStop(0,'#fff7d8cc');glow.addColorStop(.45,'#c9d9ff88');glow.addColorStop(1,'#c9d9ff00');
    ctx.fillStyle=glow;ctx.beginPath();ctx.arc(r*.42,-r*.15,r*1.15,0,Math.PI*2);ctx.fill();
  }
  ctx.restore();
  return true;
}
