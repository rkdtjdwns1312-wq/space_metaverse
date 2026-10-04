import {lv2MonsterPose} from './lv2-monster-art.js';

const ART=Object.freeze({
  noksera:{src:'/assets/monsters/noksera-v2.png',color:'#c9d6ff',face:-1,width:2.05,aspect:1221/1289},
  leoon:{src:'/assets/monsters/leoon.png',walkSrc:'/assets/monsters/leoon-walk.png',color:'#ffd47a',face:1,width:2,aspect:1254/1254,walkAspect:1145/1374}
});
const images=new Map();
function sprite(shape,walking=false){
  const art=ART[shape],key=walking&&art.walkSrc?`${shape}:walk`:shape;
  if(!images.has(key)&&typeof Image!=='undefined'){
    const image=new Image();image.src=walking&&art.walkSrc?art.walkSrc:art.src;images.set(key,image);
  }
  return images.get(key);
}
export async function preloadBossArt(){await Promise.all(Object.keys(ART).flatMap(id=>[sprite(id)?.decode(),ART[id].walkSrc&&sprite(id,true)?.decode()].filter(Boolean)));}
export function bossMonsterBounds(m,walking=false){
  const art=ART[m.shape],r=m.radius,w=r*art.width,h=w*(walking?art.walkAspect:art.aspect);
  const top=m.y+r*.9-h,bottom=m.y+r*.9;
  return {top,bottom,width:w,height:h};
}
export function drawBossMonster(ctx,m,time=0,attack){
  const art=ART[m?.shape];if(!art)return false;if(!ctx)return true;
  const r=m.radius,pose=lv2MonsterPose(time,attack),active=pose.active;
  const walking=!!art.walkSrc&&m.moving&&!active;
  const image=sprite(m.shape,walking);if(!image?.complete||!image.naturalWidth)return false;
  const direction=m.facingX<0?-1:1,flip=direction===art.face?1:-1;
  const progress=pose.progress,brace=active&&progress<.36?Math.sin(progress/.36*Math.PI):0;
  const strike=active&&progress>=.36&&progress<.8?Math.sin((progress-.36)/.44*Math.PI):0;
  const bob=m.moving&&!active?Math.sin(time*.012)*r*.025:0;
  const {width:w,height:h}=bossMonsterBounds(m,walking);
  ctx.save();
  ctx.translate(m.x,m.y+r*.9+bob);
  ctx.scale(flip,1);
  ctx.translate(-direction*r*.12*brace+direction*r*.22*strike,-r*.05*brace);
  if(active)ctx.rotate(-flip*.035*brace);
  ctx.shadowColor=art.color;ctx.shadowBlur=active?10+strike*24:8;
  if(walking){
    const index=Math.floor(time/180)%4,sw=image.naturalWidth/2,sh=image.naturalHeight/2;
    ctx.drawImage(image,(index%2)*sw,Math.floor(index/2)*sh,sw,sh,-w/2,-h,w,h);
  }else ctx.drawImage(image,-w/2,-h,w,h);
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
