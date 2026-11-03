import {MONSTER_ATTACK_ART,monsterAttackPose} from './monster-attack-frames.js';

export function monsterManaLayout(boss,barY,barHeight){
  const y=barY+barHeight+(boss?3:18),height=boss?12:7;
  return {y,height,textY:boss?y+10:y+height+11};
}

// Spirit King is drawn from cropped pose sheets. Its old safety box included
// the tallest staff pose even while idle, leaving a large empty gap above it.
// Follow the registered painted top of the current pose; do not alter its art,
// collision radius or the other bosses' label positions.
export function spiritKingLabelTop(monster,time,attack){
  const pose=monsterAttackPose(time,attack),walking=monster.moving&&!pose.active;
  const art=MONSTER_ATTACK_ART[pose.active?'spirit-king':'spirit-king-walk'];
  const index=pose.active?pose.frame:walking?Math.floor(time/130)%8:0;
  const bounds=art.bounds[index],base=art.bounds[0];
  const height=monster.radius*art.height*(bounds[3]-bounds[1])/(base[3]-base[1]);
  const bob=walking?Math.sin(time*.012)*monster.radius*.025:0;
  return monster.y+monster.radius*.9+bob-height;
}
