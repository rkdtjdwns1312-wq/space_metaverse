import {mapImage,mapImageReady,decodeMapImages} from './map-image.js';
import {drawMonsterArtLoading} from './monster-art-loading.js';
const boss=mapImage('/assets/monsters/dark-star.webp'),body=mapImage('/assets/monsters/dark-star-body.webp'),statue=mapImage('/assets/maps/dark-star-statue.webp');
export const DARK_STAR_TIPS={red:[320,60],purple:[590,254],indigo:[503,559],green:[138,559],blue:[49,254]};
const satellites=Object.fromEntries(Object.keys(DARK_STAR_TIPS).map(color=>[color,mapImage('/assets/monsters/dark-star-satellite-'+color+'.webp')]));
export function drawDarkStarSatellite(ctx,color,x,y,size){const img=satellites[color];if(img&&mapImageReady(img))ctx.drawImage(img,x-size/2,y-size/2,size,size);}
const reduced=()=>typeof matchMedia==='function'&&matchMedia('(prefers-reduced-motion: reduce)').matches;
export const preloadDarkStarArt=()=>decodeMapImages([boss,body,statue,...Object.values(satellites)]);
export function darkStarBounds(m){const width=m.radius*2.4,height=width,bottom=m.y+m.radius*.9;return {width,height,top:bottom-height-8,bottom};}
export function drawDarkStar(ctx,m,time=0,attack){
 if(m?.shape!=='dark-star')return false;if(!ctx)return true;
 if(!mapImageReady(boss))return drawMonsterArtLoading(ctx,m,boss);
 const {width,height,bottom}=darkStarBounds(m),effects=m.darkStarEffects,quiet=reduced()||!!effects?.absorption,bob=quiet?0:Math.sin(time/650)*6;
 const elapsed=attack?time-attack.startedAt:Infinity,strike=!quiet&&elapsed>=0&&elapsed<650?Math.sin(elapsed/650*Math.PI):0;
 ctx.save();ctx.translate(m.x+(attack?.dx||0)*strike*14,bottom-height/2+bob+(attack?.dy||0)*strike*14);
 if(!quiet)ctx.rotate(Math.sin(time/1200)*.015);
 if(mapImageReady(body)){
  ctx.drawImage(body,-width/2,-height/2,width,height);
  for(const [color,point] of Object.entries(DARK_STAR_TIPS))if(!effects?.absorbedColors?.includes(color))drawDarkStarSatellite(ctx,color,(point[0]/640-.5)*width,(point[1]/640-.5)*height,width*60/640);
  if(effects?.absorption){const a=effects.absorption,point=DARK_STAR_TIPS[a.color],progress=Math.max(0,Math.min(1,(Date.now()-a.startsAt)/(a.endsAt-a.startsAt)));if(point)drawDarkStarSatellite(ctx,a.color,(point[0]/640-.5)*width*(1-progress),(point[1]/640-.5)*height*(1-progress),width*60/640*(1-progress));}
 }else ctx.drawImage(boss,-width/2,-height/2,width,height);
 ctx.restore();return true;
}
export function drawDarkStarStatue(ctx,o){
 if(!mapImageReady(statue)){drawMonsterArtLoading(ctx,o,statue);return;}
 const size=230;ctx.drawImage(statue,o.x-size/2,o.y-size+30,size,size);
 ctx.save();ctx.font='16px "Jua","Malgun Gothic",sans-serif';ctx.textAlign='center';ctx.lineWidth=4;ctx.strokeStyle='#171521';ctx.fillStyle='#e2daee';ctx.strokeText(o.name,o.x,o.y+51);ctx.fillText(o.name,o.x,o.y+51);ctx.restore();
}
