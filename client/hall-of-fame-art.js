import {mapImage,mapImageReady,decodeMapImages} from './map-image.js';

const trophy=mapImage('/assets/interior/v2/hall-trophy.webp'),pedestal=mapImage('/assets/interior/v2/hall-pedestal.webp');
export function preloadHallOfFame(){return decodeMapImages([trophy,pedestal]);}
export function drawHallOfFame(ctx,object,time=0){
  if(!mapImageReady(trophy)||!mapImageReady(pedestal))return false;
  const scale=Math.min(1,Math.max(.65,(object.radius||48)/48)),baseY=object.y+22*scale;
  ctx.save();ctx.drawImage(pedestal,object.x-86*scale,baseY-102*scale,172*scale,110*scale);
  const bob=Math.sin(time/520)*5*scale;
  ctx.shadowColor='#fff0a8';ctx.shadowBlur=16*scale;
  ctx.drawImage(trophy,object.x-46*scale,baseY-192*scale+bob,92*scale,122.67*scale);
  ctx.shadowBlur=0;ctx.textAlign='center';ctx.textBaseline='middle';ctx.font=`bold ${17*scale}px Jua,"Malgun Gothic",sans-serif`;
  ctx.lineJoin='round';ctx.lineWidth=4*scale;ctx.strokeStyle='#fff9e8';ctx.strokeText('명예의 전당',object.x,object.y+78*scale);
  ctx.fillStyle='#594875';ctx.fillText('명예의 전당',object.x,object.y+78*scale);ctx.restore();return true;
}
