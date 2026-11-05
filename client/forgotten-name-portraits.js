import {mapImage,mapImageReady,decodeMapImages} from './map-image.js';

// The atlas contains scaled copies of the actual Lv5 transformed avatars.
// Keep the cell order explicit so a future constellation cannot shift old cells.
const ids=['aquarius','aries','cancer','capricorn','cetus','corona-borealis','corvus','cygnus',
  'gemini','hercules','leo','libra','ophiuchus','pisces','sagittarius','taurus'];
const atlas=mapImage('/assets/monsters/forgotten-name-portraits.png');
export const preloadNamePortraits=()=>decodeMapImages([atlas]);
export function drawNamePortrait(ctx,id,x,y,size){
  const index=ids.indexOf(id);
  if(index<0||!mapImageReady(atlas))return false;
  const cell=atlas.naturalWidth/4;
  ctx.drawImage(atlas,(index%4)*cell,Math.floor(index/4)*cell,cell,cell,x-size/2,y-size/2,size,size);
  return true;
}
