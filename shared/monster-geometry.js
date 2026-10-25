import {monsterVisualScale} from './monsters.js';

// 대기 원화 alpha>=128 몸체 좌우 끝(픽셀, 오른쪽 exclusive).
// 4포즈는 첫 셀의 실제627px와 기존1280 기준 발 anchor를 환산합니다.
// 공격 빛/그림자/투명 여백은 제외. sourceWidth,left,right,anchorX,drawWidth/radius,원화 방향.
const body=(sourceWidth,left,right,anchorX,width,face=1)=>Object.freeze({sourceWidth,left,right,anchorX,width,face});
const pose=(left,right,anchorX,width)=>body(627,left,right,anchorX*627/640,width);
export const MONSTER_BODY_GEOMETRY=Object.freeze({
  'star-crab':body(1254,90,1210,627,3.6),
  'water-star':body(1254,125,1176,627,3.6),
  'star-scorpion':pose(86,597,355,3.6),
  'chameleon-star':pose(50,579,340,3.6),
  'baby-energy-star':body(1312,266,1062,656,2.75),
  'warm-star':pose(84,570,343,3),
  'grown-warm-star':pose(42,614,344,3*.9),
  'cool-star':pose(92,494,330,3),
  'grown-cool-star':pose(68,611,355,3*.9),
  'star-dragon':pose(74,587,340,3*.55),
  'star-phoenix':pose(61,551,350,3*.55),
  noksera:body(1289,77,1258,1289/2,2.05,-1),
  leoon:body(1374,104,1314,1374/2,2),
  'spirit-king':body(384,13,372,192,2.2),
  'star-guardian':body(443,25,424,224,2.85),
  serena:body(256,14,242,128,1.35)
});
// 포즈 변화로 통로 폭이 흔들리지 않게 대기 몸체 기준. 발 깊이는 기존보다 40% 넓힙니다.
export function monsterFootprint(monster){
  const art=MONSTER_BODY_GEOMETRY[monster.typeId||monster.shape],r=monster.radius;
  let left=-r*.55,right=r*.55;
  if(art){
    const scale=r*monsterVisualScale(monster.mapId,monster.typeId||monster.shape)*art.width/art.sourceWidth;
    left=(art.left-art.anchorX)*scale;right=(art.right-art.anchorX)*scale;
    if((monster.facingX<0?-1:1)!==art.face)[left,right]=[-right,-left];
  }
  return {x:monster.x+(left+right)/2,y:monster.y+r*.8,rx:(right-left)/2,ry:r*.28,
    left:monster.x+left,right:monster.x+right};
}
