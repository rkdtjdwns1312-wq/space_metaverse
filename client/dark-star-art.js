import {mapImage,mapImageReady,decodeMapImages} from './map-image.js';
import {drawMonsterArtLoading} from './monster-art-loading.js';
const boss=mapImage('/assets/monsters/dark-star.webp'),statue=mapImage('/assets/maps/dark-star-statue.webp');
const reduced=()=>typeof matchMedia==='function'&&matchMedia('(prefers-reduced-motion: reduce)').matches;
export const preloadDarkStarArt=()=>decodeMapImages([boss,statue]);
export function darkStarBounds(m){const width=m.radius*2.4,height=width,bottom=m.y+m.radius*.9;return {width,height,top:bottom-height-8,bottom};}
export function drawDarkStar(ctx,m,time=0,attack){
 if(m?.shape!=='dark-star')return false;if(!ctx)return true;
 if(!mapImageReady(boss))return drawMonsterArtLoading(ctx,m,boss);
 const {width,height,bottom}=darkStarBounds(m),quiet=reduced(),bob=quiet?0:Math.sin(time/650)*6;
 const elapsed=attack?time-attack.startedAt:Infinity,strike=!quiet&&elapsed>=0&&elapsed<650?Math.sin(elapsed/650*Math.PI):0;
 ctx.save();ctx.translate(m.x+(attack?.dx||0)*strike*14,bottom-height/2+bob+(attack?.dy||0)*strike*14);
 if(!quiet)ctx.rotate(Math.sin(time/1200)*.015);ctx.drawImage(boss,-width/2,-height/2,width,height);ctx.restore();return true;
}
export function drawDarkStarStatue(ctx,o){
 if(!mapImageReady(statue)){drawMonsterArtLoading(ctx,o,statue);return;}
 const size=230;ctx.drawImage(statue,o.x-size/2,o.y-size+30,size,size);
 ctx.save();ctx.font='16px "Jua","Malgun Gothic",sans-serif';ctx.textAlign='center';ctx.lineWidth=4;ctx.strokeStyle='#171521';ctx.fillStyle='#e2daee';ctx.strokeText(o.name,o.x,o.y+51);ctx.fillText(o.name,o.x,o.y+51);ctx.restore();
}
