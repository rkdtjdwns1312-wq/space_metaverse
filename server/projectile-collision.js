import {RULES} from '../shared/config.js';
// Swept circle entry avoids tunnelling and stops at the nearest player rather than overshooting.
export function collisionDistance(shot,player,travel){
  const dx=player.x-shot.x,dy=player.y-shot.y,radius=shot.radius+RULES.radius;
  const along=dx*shot.dx+dy*shot.dy,acrossSquared=dx*dx+dy*dy-along*along;
  if(acrossSquared>radius*radius)return null;
  const half=Math.sqrt(Math.max(0,radius*radius-acrossSquared)),entry=Math.max(0,along-half);
  return along+half>=0&&entry<=travel?entry:null;
}
