import {drawQuietStar} from './forgotten-links-art.js';
import {preloadNamePortraits} from './forgotten-name-portraits.js';
import {mapImage,mapImageReady,decodeMapImages} from './map-image.js';
import {drawMonsterArtLoading} from './monster-art-loading.js';
const boss=mapImage('/assets/monsters/forgotten-constellation.webp');
const statue=mapImage('/assets/monsters/forgotten-constellation-statue.webp');
export const preloadForgottenArt=()=>Promise.all([decodeMapImages([boss,statue]),preloadNamePortraits()]);
export function forgottenBounds(monster){
 const width=monster.radius*2.4,height=width*(boss?.naturalHeight||1)/(boss?.naturalWidth||1),bottom=monster.y+monster.radius*.85;
 return {width,height,top:bottom-height-8,bottom};
}
const reduced=typeof matchMedia==='function'?matchMedia('(prefers-reduced-motion: reduce)'):null;
export function drawForgottenBoss(ctx,m,time=0){
 if(!ctx)return true;
 if(!mapImageReady(boss))return drawMonsterArtLoading(ctx,m,boss);
 const {width,height,bottom}=forgottenBounds(m),phase=reduced?.matches?0:time/1350;
 ctx.save();ctx.translate(m.x,bottom+(reduced?.matches?0:Math.sin(phase)*4));
 ctx.drawImage(boss,-width/2,-height,width,height);
 if(!reduced?.matches){
  for(const [u,v,offset] of [[-.32,-.54,0],[.18,-.32,2.2],[.37,-.7,4.4]]){
   const light=Math.max(0,Math.sin(phase+offset));if(!light)continue;
   const x=width*u,y=height*v,r=3+light*3;ctx.globalAlpha=.74*light;ctx.fillStyle='#fff6d5';
   ctx.beginPath();ctx.moveTo(x-r,y);ctx.lineTo(x-1,y-1);ctx.lineTo(x,y-r);ctx.lineTo(x+1,y-1);ctx.lineTo(x+r,y);ctx.lineTo(x+1,y+1);ctx.lineTo(x,y+r);ctx.lineTo(x-1,y+1);ctx.closePath();ctx.fill();
  }
 }
 ctx.restore();return true;
}
export function drawForgottenStatue(ctx,o){
 if(!mapImageReady(statue)){drawMonsterArtLoading(ctx,o,statue);return;}
 const width=230,height=width*statue.naturalHeight/statue.naturalWidth;
 ctx.drawImage(statue,o.x-width/2,o.y+30-height,width,height);
 ctx.save();ctx.font='16px "Jua","Malgun Gothic",sans-serif';ctx.textAlign='center';ctx.lineWidth=4;ctx.strokeStyle='#171521';ctx.fillStyle='#e8d9ff';
 ctx.strokeText(o.name,o.x,o.y+51);ctx.fillText(o.name,o.x,o.y+51);ctx.restore();
}

export function drawHomingStar(ctx,shot,now,quiet=false){
 if(now>=shot.endsAt)return;
 // Stop interpolation at the next server-owned turn or hit update.
 const elapsed=Math.max(0,Math.min(100,now-shot.lastAt,shot.nextTurnAt-shot.lastAt));
 const x=shot.x+shot.dx*elapsed/1000*shot.speed,y=shot.y+shot.dy*elapsed/1000*shot.speed,r=shot.radius;
 if(shot.color!=='blue'){drawQuietStar(ctx,x,y,r,quiet?0:now);return;}
 const pulse=quiet?1:1+.065*Math.sin(now/530);
 ctx.save();ctx.translate(x,y);ctx.rotate(Math.PI/4);ctx.scale(r*pulse,r*pulse);
 ctx.fillStyle='#70dcff';ctx.strokeStyle='#263d70';ctx.lineWidth=.12;
 ctx.beginPath();ctx.moveTo(0,-1);ctx.quadraticCurveTo(.13,-.13,.86,0);ctx.quadraticCurveTo(.13,.13,0,1);ctx.quadraticCurveTo(-.13,.13,-.86,0);ctx.quadraticCurveTo(-.13,-.13,0,-1);ctx.closePath();ctx.fill();ctx.stroke();
 ctx.fillStyle='#effcff';ctx.beginPath();ctx.arc(0,0,.2,0,2*Math.PI);ctx.fill();ctx.restore();
}
