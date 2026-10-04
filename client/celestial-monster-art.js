import {lv2MonsterPose} from './lv2-monster-art.js';

// 첨부 원화에서 만든 4포즈. 좌표는 1280 기준이며 실제 이미지 크기에 맞춰 환산합니다.
// 각 포즈의 발밑을 고정하여 공격 중 그림 크기/위치가 튀지 않게 합니다.
export const CELESTIAL_MONSTER_ART=Object.freeze({
  'star-dragon':{src:'/assets/monsters/star-dragon-poses.png',effect:'wind',scale:.55,
    frames:[[0,0,640,640,340,555],[640,0,640,640,340,560],[0,640,700,640,320,470],[700,640,580,640,300,485]]},
  'star-phoenix':{src:'/assets/monsters/star-phoenix-poses.png',effect:'flame',scale:.55,
    frames:[[0,0,640,640,350,555],[640,0,640,640,340,555],[0,640,700,640,320,465],[700,640,580,640,300,472]]},
  'cool-star':{src:'/assets/monsters/cool-star-poses.png',effect:'moon',scale:1,
    frames:[[0,0,640,640,330,590],[640,0,640,640,335,586],[0,640,700,640,290,510],[700,640,580,640,280,530]]},
  'grown-cool-star':{src:'/assets/monsters/grown-cool-star-poses.png',effect:'moon',scale:.9,
    frames:[[0,0,640,640,355,590],[640,0,640,640,350,600],[0,640,700,640,290,510],[700,640,580,640,265,510]]},
});
const images=new Map();
function sprite(shape){
  if(!images.has(shape)&&typeof Image!=='undefined'){const image=new Image();image.src=CELESTIAL_MONSTER_ART[shape].src;images.set(shape,image);}
  return images.get(shape);
}
export async function preloadCelestialArt(){await Promise.all(Object.keys(CELESTIAL_MONSTER_ART).map(id=>sprite(id)?.decode()));}
function effect(ctx,m,attack,pose,art,r,dx,dy){
  const p=pose.progress;if(p<.25||p>.88)return;
  const alpha=Math.sin((p-.25)/.63*Math.PI);
  ctx.save();ctx.translate(m.x,m.y);ctx.rotate(Math.atan2(dy,dx));ctx.globalAlpha=alpha;
  const reach=Math.min(Number(attack.reach)||r,r*2.5);
  ctx.translate(reach,0);ctx.lineCap='round';
  const color=art.effect==='flame'?'#ffb650':art.effect==='moon'?'#d3ceff':'#bfeaff';
  ctx.strokeStyle=color;ctx.fillStyle=color;ctx.shadowColor=color;ctx.shadowBlur=r*.2;
  if(art.effect==='wind'){
    // 회오리의 소용돌이도 실제 반격 방향을 따르며 별도 피해는 만들지 않습니다.
    for(let i=0;i<4;i++){ctx.lineWidth=r*.04;ctx.beginPath();ctx.ellipse(0,(i-1.5)*r*.21,r*(.15+i*.065),r*.11,p*5+i,0,Math.PI*1.65);ctx.stroke();}
  }else if(art.effect==='moon'){
    ctx.lineWidth=r*.11;ctx.beginPath();ctx.arc(-r*.15,0,r*.65,-Math.PI*.48,Math.PI*.48);ctx.stroke();
    ctx.strokeStyle='#fffaff';ctx.lineWidth=r*.035;ctx.stroke();
  }else{
    for(let i=0;i<7;i++){const a=i*Math.PI*2/7;ctx.lineWidth=r*.065;ctx.beginPath();ctx.moveTo(Math.cos(a)*r*.15,Math.sin(a)*r*.15);ctx.lineTo(Math.cos(a)*r*(.3+alpha*.35),Math.sin(a)*r*(.3+alpha*.35));ctx.stroke();}
    ctx.fillStyle='#fff2c2';ctx.beginPath();ctx.arc(0,0,r*.14,0,Math.PI*2);ctx.fill();
  }
  ctx.restore();
}
export function drawCelestialMonster(ctx,m,time=0,attack){
  const art=CELESTIAL_MONSTER_ART[m?.shape];if(!art)return false;if(!ctx)return true;
  const image=sprite(m.shape);if(!image?.complete||!image.naturalWidth)return false;
  const pose=lv2MonsterPose(time,attack),r=Math.max(1,Number(m.radius)||48)*art.scale;
  let dx=Number(attack?.dx)||0,dy=Number(attack?.dy)||0,len=Math.hypot(dx,dy);
  if(len){dx/=len;dy/=len;}else{dx=m.facingX<0?-1:1;dy=0;}
  const face=pose.active&&Math.abs(dx)>.05?Math.sign(dx):m.facingX<0?-1:1;
  const bob=m.moving&&!pose.active?Math.sin(time*.011)*r*.035:0;
  const [sx,sy,sw,sh,ax,ay]=art.frames[pose.frame],scale=r*3/640;
  ctx.save();ctx.fillStyle='#29223d33';ctx.beginPath();ctx.ellipse(m.x,m.y+r,r*.85,r*.2,0,0,Math.PI*2);ctx.fill();
  ctx.translate(m.x,m.y+r+bob);ctx.scale(face,1);
  if(m.moving&&!pose.active)ctx.rotate(Math.sin(time*.011)*.018);
  if(pose.frame===3&&m.shape!=='cool-star'){
    // 회복 칸의 빈 왼쪽 여백으로 번진 이웃 타격 칸 빛만 제외합니다. 꼬리와 발은 보존합니다.
    const outline=[[40,0],[sw,0],[sw,sh],[0,sh],[0,460],[40,400]];
    ctx.beginPath();outline.forEach(([px,py],i)=>{const x=(px-ax)*scale,y=(py-ay)*scale;i?ctx.lineTo(x,y):ctx.moveTo(x,y);});ctx.closePath();ctx.clip();
  }
  ctx.drawImage(image,sx*image.naturalWidth/1280,sy*image.naturalHeight/1280,sw*image.naturalWidth/1280,sh*image.naturalHeight/1280,-ax*scale,-ay*scale,sw*scale,sh*scale);
  ctx.restore();if(pose.active)effect(ctx,m,attack,pose,art,r,dx,dy);return true;
}
