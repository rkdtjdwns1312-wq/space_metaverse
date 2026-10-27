// 별의 기원 1~3단계 몬스터 전용 2×2 투명 걷기 프레임 시트입니다.
export const ORIGIN_WALK_ART=Object.freeze(Object.fromEntries([
  'star-crab','water-star','star-scorpion','chameleon-star','star-dragon','star-phoenix'
].map(shape=>[shape,`/assets/monsters/${shape}-walk.png`])));
const images=new Map();
export const originWalkFrame=time=>Math.floor((Number.isFinite(time)?Math.max(0,time):0)/160)%4;
export function originWalkImage(shape){
  const src=ORIGIN_WALK_ART[shape];if(!src||typeof Image==='undefined')return null;
  if(!images.has(shape)){const image=new Image();image.src=src;images.set(shape,image);}
  return images.get(shape);
}
export async function preloadOriginWalkArt(shape){await originWalkImage(shape)?.decode();}
export function drawOriginWalkFrame(ctx,shape,time,x,y,size){
  const image=originWalkImage(shape);if(!image?.complete||!image.naturalWidth)return false;
  const frame=originWalkFrame(time),width=image.naturalWidth/2,height=image.naturalHeight/2;
  ctx.drawImage(image,frame%2*width,Math.floor(frame/2)*height,width,height,x,y,size,size);
  return true;
}
