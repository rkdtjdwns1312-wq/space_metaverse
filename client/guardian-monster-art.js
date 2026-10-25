import {drawPaintedMonsterFrame,paintedMonsterImage,preloadMonsterAttack,monsterAttackPose} from './monster-attack-frames.js';

export async function preloadGuardianArt(){
  await Promise.all([preloadMonsterAttack('star-guardian'),preloadMonsterAttack('star-guardian-walk')]);
}

export function drawGuardianMonster(ctx,m,time=0,attack){
  if(m?.shape!=='star-guardian')return false;
  if(!ctx)return true;
  const pose=monsterAttackPose(time,attack);
  const sheet=pose.active?'star-guardian':'star-guardian-walk';
  const image=paintedMonsterImage(sheet);
  if(!image?.complete||!image.naturalWidth)return false;
  const direction=pose.active&&Math.abs(Number(attack?.dx)||0)>.05?Math.sign(attack.dx):m.facingX<0?-1:1;
  const frame=pose.active?pose.frame:m.moving?Math.floor(time/130)%8:0;
  const r=m.radius,bob=m.moving&&!pose.active?Math.sin(time/130)*r*.025:0;
  const lunge=pose.active?Math.sin(pose.progress*Math.PI)*r*.1:0;
  ctx.save();
  ctx.translate(m.x+direction*lunge,m.y+r*.8+bob);
  ctx.scale(direction,1);
  // One cell per frame keeps the shield, cape and attack glow from leaving image trails.
  drawPaintedMonsterFrame(ctx,sheet,frame,r);
  ctx.restore();
  return true;
}
