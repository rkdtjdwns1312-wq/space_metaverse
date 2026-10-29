import {preloadDarkStarArt,darkStarBounds,drawDarkStar} from './dark-star-art.js';
import {drawMonsterArtLoading} from './monster-art-loading.js';
import {preloadSerenaArt,serenaBounds,drawSerena} from './serena-art.js';
import {preloadNokseraSkill,drawNokseraSkill} from './noksera-skill.js';
import {preloadNokseraMoon,drawNokseraMoonCast} from './noksera-moon.js';
import {drawLeoonAura,leoonPoseFrame} from './leoon-skill.js';
import {drawPaintedMonsterFrame,paintedMonsterImage,preloadMonsterAttack,monsterAttackPose} from './monster-attack-frames.js';

const ART=Object.freeze({
  noksera:{src:'/assets/monsters/noksera-v2.png',walkSrc:'/assets/monsters/noksera-walk.png',color:'#c9d6ff',face:-1,width:2.05,aspect:1221/1289,walkAspect:1},
  leoon:{src:'/assets/monsters/leoon.png',walkSrc:'/assets/monsters/leoon-walk.png',color:'#ffd47a',face:1,width:2,aspect:1254/1254,walkAspect:1145/1374},
  'spirit-king':{src:'/assets/monsters/spirit-king-walk-v3.png',walkSrc:'/assets/monsters/spirit-king-walk-v3.png',color:'#bcb3ff',face:1,width:2.2,aspect:512/384,walkAspect:512/384,frames:8}
});
const images=new Map();
function sprite(shape,walking=false){
  const art=ART[shape],key=walking&&art.walkSrc?`${shape}:walk`:shape;
  if(!images.has(key)&&typeof Image!=='undefined'){
    const image=new Image();image.src=walking&&art.walkSrc?art.walkSrc:art.src;images.set(key,image);
  }
  return images.get(key);
}
export async function preloadBossArt(shape){if(shape==='dark-star')return preloadDarkStarArt();if(shape==='serena')return preloadSerenaArt();await Promise.all((shape?[shape]:Object.keys(ART)).flatMap(id=>{
  const art=ART[id],files=[sprite(id)?.decode(),art.walkSrc&&sprite(id,true)?.decode(),preloadMonsterAttack(id),id==='spirit-king'&&preloadMonsterAttack('spirit-king-walk'),id==='noksera'&&preloadNokseraSkill(),id==='noksera'&&preloadNokseraMoon()];
  return files.filter(Boolean);
}));}
export function bossMonsterBounds(m,walking=false){
  if(m.shape==='dark-star')return darkStarBounds(m);
  if(m.shape==='serena')return serenaBounds(m);
  const art=ART[m.shape],r=m.radius,w=r*art.width;
  // 새 성령왕 시트의 지팡이를 든 최대 높이까지 이름/상태 아이콘 위 공간을 확보합니다.
  const h=m.shape==='spirit-king'?r*3.05:w*(walking?art.walkAspect:art.aspect);
  const top=m.y+r*.9-h,bottom=m.y+r*.9;
  return {top,bottom,width:w,height:h};
}
export function drawBossMonster(ctx,m,time=0,attack){
  if(m?.shape==='dark-star')return drawDarkStar(ctx,m,time,attack);
  if(m?.shape==='serena')return drawSerena(ctx,m,time,attack);
  const art=ART[m?.shape];if(!art)return false;if(!ctx)return true;
  if(drawNokseraMoonCast(ctx,m))return true;
  if(drawNokseraSkill(ctx,m,time,attack))return true;
  const r=m.radius,pose=monsterAttackPose(time,attack),active=pose.active;
  const walking=!!art.walkSrc&&(m.moving||m.leoonSkill?.stage==='stomp')&&!active;
  const paintedShape=m.shape==='spirit-king'?(active?'spirit-king':'spirit-king-walk'):active?m.shape:null;
  const image=paintedShape?paintedMonsterImage(paintedShape):sprite(m.shape,walking);if(!image?.complete||!image.naturalWidth)return drawMonsterArtLoading(ctx,m,image);
  const direction=active&&Math.abs(attack.dx)>.05?Math.sign(attack.dx):m.facingX<0?-1:1,flip=direction===art.face?1:-1;
  const progress=pose.progress,brace=active&&progress<.36?Math.sin(progress/.36*Math.PI):0;
  const strike=active&&progress>=.36&&progress<.8?Math.sin((progress-.36)/.44*Math.PI):0;
  const leoonPose=m.shape==='leoon'?leoonPoseFrame(m.leoonSkill,Date.now()):null;
  const bob=m.moving&&!active?Math.sin(time*.012)*r*.025:0;
  const {width:w,height:h}=bossMonsterBounds(m,walking);
  ctx.save();
  ctx.translate(m.x,m.y+r*.9+bob+(leoonPose?.bob||0)*r);
  ctx.scale(flip,1);
  ctx.translate((-direction*r*.06*brace+direction*r*.1*strike)*flip,0);
  if(leoonPose?.lift)ctx.rotate(-flip*.045*leoonPose.lift);
  ctx.shadowColor=art.color;ctx.shadowBlur=active?10+strike*24:leoonPose?8+leoonPose.glow*25:8;
  if(paintedShape){
    const index=active?pose.frame:walking?Math.floor(time/130)%8:0;
    // 기존 대기 원화의 아래쪽 투명 여백만큼 발 기준을 맞춥니다.
    const footInset=m.shape==='leoon'?.07:m.shape==='noksera'?.05:0;
    drawPaintedMonsterFrame(ctx,paintedShape,index,r,0,-r*footInset);
  }else if(walking){
    const index=m.leoonSkill?.stage==='stomp'?
      Math.floor(Math.max(0,Date.now()-m.leoonSkill.startsAt)/75)%4:Math.floor(time/180)%4;
    const sw=image.naturalWidth/2,sh=image.naturalHeight/2;
    ctx.drawImage(image,(index%2)*sw,Math.floor(index/2)*sh,sw,sh,-w/2,-h,w,h);
  }else ctx.drawImage(image,-w/2,-h,w,h);
  ctx.restore();
  if(m.shape==='leoon')drawLeoonAura(ctx,m,Date.now());
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
