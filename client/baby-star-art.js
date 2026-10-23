import {drawPaintedMonsterFrame,monsterAttackPose} from './monster-attack-frames.js';

// 따뜻한 기운과 서늘한 기운이 번갈아 빛나고, 공격 때 작은 별이 앞으로 굴러갑니다.
export function drawBabyStar(ctx,monster,time=0,attack=null){
  if(monster.shape!=='baby-energy-star')return false;
  if(!ctx)return true;
  const r=monster.radius;
  const pose=monsterAttackPose(time,attack),phase=pose.progress;
  const face=pose.active&&Math.abs(attack.dx)>.05?Math.sign(attack.dx):monster.facingX<0?-1:1;
  const lunge=pose.active?Math.sin(Math.PI*phase)*r*.18:0;
  const bob=pose.active?0:monster.moving?Math.sin(time/125)*r*.055:Math.sin(time/580)*r*.025;
  ctx.save();
  ctx.translate(monster.x+face*lunge,monster.y+r*.8+bob);ctx.scale(face,1);
  drawPaintedMonsterFrame(ctx,monster.shape,pose.frame,r);
  ctx.restore();
  return true;
}
