import {CAPRICORN_VFX} from '/shared/capricorn-skills.js';
const images=new Map();
const icons=new Map();
function frame(ctx,id,index,size){let image=images.get(id);
  if(!image){image=new Image();image.src=CAPRICORN_VFX[id].url;images.set(id,image);}
  if(!image.complete||!image.naturalWidth)return;
  ctx.drawImage(image,(index%6)*256,Math.floor(index/6)*256,256,256,-size/2,-size/2,size,size);
}
export function drawCapricornAttack(ctx,hit,elapsedMs,reducedMotion=false){
  if(hit.kind!=='capricorn-attack')return false;
  ctx.save();ctx.translate(hit.x+hit.dx*hit.reach,hit.y+hit.dy*hit.reach);ctx.rotate(Math.atan2(hit.dy,hit.dx));
  frame(ctx,'attack',reducedMotion?12:Math.min(23,Math.floor(elapsedMs/(hit.durationMs||500)*24)),hit.size*1.15);
  ctx.restore();return true;
}
export function drawCapricornBlessing(ctx,blessing,elapsedMs,size,reducedMotion=false){
  if(elapsedMs<1000){ctx.save();ctx.translate(0,-size*.13);
    frame(ctx,`skill-lv${blessing.stage}`,reducedMotion?12:Math.min(23,Math.floor(elapsedMs/1000*24)),size*1.75);ctx.restore();}
  let image=icons.get(blessing.stage);
  if(!image){image=new Image();image.src=CAPRICORN_VFX[`skill-lv${blessing.stage}`].iconUrl;icons.set(blessing.stage,image);}
  // The small horn follows the recipient even after the summoning animation ends.
  if(image.complete&&image.naturalWidth)ctx.drawImage(image,-14,-size*.68-22,28,28);
  else{ctx.fillStyle='#ffe9a3';ctx.font='22px serif';ctx.textAlign='center';ctx.fillText('♑',0,-size*.64);}
}
