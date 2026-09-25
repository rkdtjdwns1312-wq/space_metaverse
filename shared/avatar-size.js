// 맵에서 그리는 가로·세로 길이입니다. 이동 충돌 크기와 프로필 카드 크기는 별개입니다.
export const AVATAR_SIZE=Object.freeze({asteroid:32,firstConstellationScale:2.5,growth:1.15,teacher:96});
export function avatarSizeOf(player){
  if(player?.role==='teacher')return AVATAR_SIZE.teacher;
  const level=player?.avatar?.level;
  if(!Number.isInteger(level)||level<2)return AVATAR_SIZE.asteroid;
  return AVATAR_SIZE.asteroid*AVATAR_SIZE.firstConstellationScale*AVATAR_SIZE.growth**(Math.min(5,level)-2);
}
