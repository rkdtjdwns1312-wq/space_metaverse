import {lv2MonsterPose} from './lv2-monster-art.js';

const ART=Object.freeze({
  noksera:{src:'/assets/monsters/noksera.png',color:'#c9d6ff',face:-1,width:2.05},
  leoon:{src:'/assets/monsters/leoon.png',color:'#ffd47a',face:1,width:2}
});
const images=new Map();
function sprite(shape){
  if(!images.has(shape)&&typeof Image!=='undefined'){
    const image=new Image();image.src=ART[shape].src;images.set(shape,image);
  }
  return images.get(shape);
}
export async function preloadBossArt(){await Promise.all(Object.keys(ART).map(id=>sprite(id)?.decode()));}
export function drawBossMonster(ctx,m,time=0,attack){
  const art=ART[m?.shape];if(!art)return false;if(!ctx)return true;
  const image=sprite(m.shape);if(!image?.complete||!image.naturalWidth)return false;
  const r=m.radius,pose=lv2MonsterPose(time,attack),active=pose.active;
  const direction=m.facingX<0?-1:1,flip=direction===art.face?1:-1;
  const progress=pose.progress,brace=active&&progress<.36?Math.sin(progress/.36*Math.PI):0;
  const strike=active&&progress>=.36&&progress<.8?Math.sin((progress-.36)/.44*Math.PI):0;
  const bob=m.moving&&!active?Math.sin(time*.012)*r*.025:0;
  const w=r*art.width,h=w*image.naturalHeight/image.naturalWidth;
  ctx.save();
  ctx.translate(m.x,m.y+r*.38+bob);
  ctx.scale(flip,1);
  ctx.translate(-direction*r*.12*brace+direction*r*.22*strike,-r*.05*brace);
  if(active)ctx.rotate(-flip*.035*brace);
  ctx.shadowColor=art.color;ctx.shadowBlur=active?10+strike*24:8;
  ctx.drawImage(image,-w/2,-h,w,h);
  ctx.restore();
  if(strike>0){
    const dx=Number(attack?.dx)||direction,dy=Number(attack?.dy)||0;
    ctx.save();ctx.translate(m.x+dx*r*.85,m.y+dy*r*.85);
    ctx.rotate(Math.atan2(dy,dx));ctx.globalAlpha=strike;
    ctx.strokeStyle=art.color;ctx.lineCap='round';ctx.shadowColor=art.color;ctx.shadowBlur=20;
    ctx.lineWidth=r*.085;ctx.beginPath();ctx.arc(0,0,r*.7,-1.15,1.15);ctx.stroke();
    ctx.lineWidth=r*.025;ctx.strokeStyle='#fffdf6';ctx.stroke();
    ctx.restore();
  }
  return true;
}
