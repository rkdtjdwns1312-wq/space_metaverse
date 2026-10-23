// 실제로 그린 8포즈 시트. 좌표는 443px 셀 안의 몸체 범위이며 원본은 1774×887입니다.
// 모든 프레임은 같은 배율을 사용하고 발 아래를 고정합니다. 그림을 겹쳐 잔상을 만들지 않습니다.
export const MONSTER_ATTACK_ART=Object.freeze({
  'baby-energy-star':{height:1.95,face:1,bounds:[[59,83,391,386],[81,122,393,399],[86,108,379,399],[88,86,421,399],[57,77,435,390],[66,77,408,389],[76,89,397,389],[61,85,393,388]]},
  'star-crab':{height:2.2,face:1,bounds:[[75,161,397,390],[89,157,394,388],[76,179,379,391],[61,176,385,390],[59,94,417,312],[96,94,427,315],[82,99,401,319],[84,96,395,321]]},
  'water-star':{height:2.55,face:1,bounds:[[114,157,383,387],[112,158,368,376],[112,159,373,383],[105,157,360,382],[106,107,374,321],[100,103,377,314],[103,109,374,327],[106,107,377,331]]},
  leoon:{height:1.86,face:1,bounds:[[82,140,344,380],[94,163,370,380],[74,142,342,380],[66,143,348,378],[74,83,379,320],[74,88,366,322],[63,79,355,328],[65,77,352,326]]},
  noksera:{height:1.85,face:-1,bounds:[[104,136,355,389],[104,153,383,386],[108,132,342,388],[67,193,346,391],[95,143,397,333],[137,83,370,332],[96,86,360,337],[107,84,356,337]]},
  'spirit-king':{height:2.35,face:1,src:'/assets/monsters/spirit-king-attack-v2.png',bounds:[[111,160,319,404],[105,167,335,404],[98,165,339,405],[121,118,339,405],[102,105,390,346],[95,105,397,346],[94,105,373,346],[121,102,334,348]]},
  'spirit-king-walk':{height:2.35,face:1,src:'/assets/monsters/spirit-king-walk-v2.png',bounds:[[77,152,322,437],[85,153,340,438],[82,153,330,437],[116,152,360,437],[78,86,328,371],[103,86,355,371],[82,86,339,371],[112,83,366,370]]}
});
const images=new Map();
export function paintedMonsterImage(shape){
  const art=MONSTER_ATTACK_ART[shape];if(!art||typeof Image==='undefined')return null;
  if(!images.has(shape)){const image=new Image();image.src=art.src||`/assets/monsters/${shape}-attack.png`;images.set(shape,image);}
  return images.get(shape);
}
export async function preloadMonsterAttack(shape){
  const shapes=shape?[shape]:Object.keys(MONSTER_ATTACK_ART);
  await Promise.all(shapes.map(id=>paintedMonsterImage(id)?.decode()));
}
export function monsterAttackPose(time,attack){
  if(!Number.isFinite(time)||!Number.isFinite(attack?.startedAt))return {active:false,frame:0,progress:0};
  const duration=Number.isFinite(attack.durationMs)&&attack.durationMs>0?attack.durationMs:600;
  const progress=(time-attack.startedAt)/duration;
  if(progress<0||progress>=1)return {active:false,frame:0,progress:0};
  const stops=[.1,.2,.3,.42,.57,.72,.86,1];
  return {active:true,frame:stops.findIndex(end=>progress<end),progress};
}
// 호출부에서 좌우 반전·이동을 적용합니다. x/y는 발밑 좌표입니다.
export function drawPaintedMonsterFrame(ctx,shape,frame,radius,x=0,y=0){
  const art=MONSTER_ATTACK_ART[shape],image=paintedMonsterImage(shape);
  if(!art||!image?.complete||!image.naturalWidth)return false;
  const index=Math.max(0,Math.min(7,Math.floor(frame)||0)),b=art.bounds[index],base=art.bounds[0];
  const scale=radius*art.height/(base[3]-base[1]),cell=443;
  const ax=(b[0]+b[2])/2,ay=b[3];
  ctx.drawImage(image,index%4*cell,Math.floor(index/4)*cell,cell,cell,x-ax*scale,y-ay*scale,cell*scale,cell*scale);
  return true;
}
