import {mapImage,mapImageReady,decodeMapImages} from './map-image.js';
import {drawMonsterArtLoading} from './monster-art-loading.js';

const book=mapImage('/assets/monsters/star-record-origin.png');
const statue=mapImage('/assets/monsters/star-record-statue.png');
export const preloadStarRecordArt=()=>decodeMapImages([book,statue]);
export function starRecordBounds(monster){
  const width=monster.radius*2.4,height=width,bottom=monster.y+monster.radius*.9;
  // The 512px source has 86px of transparent padding above the visible book.
  // Anchor labels to the artwork, allowing 2px for its floating motion.
  return {width,height,top:bottom-height+height*(86/512)-2,bottom};
}
export function drawStarRecord(ctx,monster,time=0,attack){
  if(monster?.shape!=='star-record')return false;
  if(!ctx)return true;
  if(!mapImageReady(book))return drawMonsterArtLoading(ctx,monster,book);
  const {width,height,bottom}=starRecordBounds(monster);
  const quiet=typeof matchMedia==='function'&&matchMedia('(prefers-reduced-motion: reduce)').matches;
  // 책등은 고정하고 양쪽 펼쳐진 페이지를 8단계로 미세하게 움직입니다.
  const phase=quiet?0:Math.round(Math.sin(time/850)*4)/4;
  const left=width/2*(1+phase*.012),right=width/2*(1-phase*.012);
  const strike=attack?Math.max(0,1-Math.abs(time-attack.startedAt-300)/400):0;
  ctx.save();ctx.translate(monster.x,bottom-height/2+(quiet?0:Math.sin(time/1100)*2));
  if(strike){ctx.shadowColor='#ffe29a';ctx.shadowBlur=18*strike;}
  ctx.drawImage(book,0,0,book.naturalWidth/2,book.naturalHeight,-left,-height/2,left,height);
  ctx.drawImage(book,book.naturalWidth/2,0,book.naturalWidth/2,book.naturalHeight,0,-height/2,right,height);
  ctx.restore();return true;
}
export function drawStarRecordStatue(ctx,object){
  if(!mapImageReady(statue)){drawMonsterArtLoading(ctx,object,statue);return;}
  const size=230;ctx.drawImage(statue,object.x-size/2,object.y-size+30,size,size);
  ctx.save();ctx.font='16px "Jua","Malgun Gothic",sans-serif';ctx.textAlign='center';ctx.lineWidth=4;
  ctx.strokeStyle='#171521';ctx.fillStyle='#e6d6aa';
  ctx.strokeText(object.name,object.x,object.y+51);ctx.fillText(object.name,object.x,object.y+51);ctx.restore();
}
export function drawStarRecordRays(ctx,effects,now=Date.now()){
  const warning=effects?.warning,burst=effects?.burst;
  const cast=warning||burst;if(!cast)return;
  const progress=warning?Math.max(0,Math.min(1,(now-cast.startsAt)/(cast.endsAt-cast.startsAt))):
    Math.max(0,Math.min(1,(now-cast.startsAt)/(cast.endsAt-cast.startsAt)));
  const alpha=warning?.38+.18*Math.sin(progress*Math.PI*6):.7*(1-progress);
  const width=warning?64:95;
  ctx.save();ctx.lineCap='round';ctx.lineJoin='round';
  for(const ray of cast.rays){
    const endX=cast.x+ray.dx*520,endY=cast.y+ray.dy*520;
    ctx.beginPath();ctx.moveTo(cast.x,cast.y);ctx.lineTo(endX,endY);
    ctx.lineWidth=width;ctx.strokeStyle=warning?`rgba(245,161,82,${alpha*.48})`:`rgba(255,228,151,${alpha*.55})`;ctx.stroke();
    ctx.beginPath();ctx.moveTo(cast.x,cast.y);ctx.lineTo(endX,endY);
    ctx.lineWidth=warning?3:12;ctx.strokeStyle=warning?`rgba(255,222,142,${alpha})`:`rgba(255,250,220,${alpha})`;
    if(warning)ctx.setLineDash([16,12]);ctx.stroke();ctx.setLineDash([]);
    if(burst){ctx.beginPath();ctx.arc(endX,endY,28*(1-progress)+10,0,Math.PI*2);
      ctx.lineWidth=5;ctx.strokeStyle=`rgba(255,233,162,${alpha})`;ctx.stroke();}
  }
  ctx.restore();
}
export function drawStarRecordMath(ctx,math,now=Date.now(),{stars=true,timer=true}={}){
  if(!math)return;
  const seconds=Math.max(0,Math.ceil((math.endsAt-now)/1000));
  ctx.save();ctx.textAlign='center';
  for(const star of stars?math.stars:[]){
    const pulse=.5+.5*Math.sin(now/420+star.x*.02),radius=35+pulse*3;
    ctx.shadowColor='#ffd977';ctx.shadowBlur=16;ctx.fillStyle='rgba(79,54,115,.9)';
    ctx.beginPath();ctx.arc(star.x,star.y,radius,0,Math.PI*2);ctx.fill();
    ctx.strokeStyle='#f4d883';ctx.lineWidth=3;ctx.stroke();
    for(let i=0;i<6;i++){const angle=i*Math.PI/3+now/6500;ctx.fillStyle='rgba(255,239,182,.75)';
      ctx.font='bold 14px "Jua","Malgun Gothic",sans-serif';ctx.fillText(String((star.left+i*star.right)%10),star.x+Math.cos(angle)*(radius-9),star.y+Math.sin(angle)*(radius-9));}
    ctx.shadowBlur=0;ctx.font='bold 23px "Jua","Malgun Gothic",sans-serif';ctx.fillStyle='#fff5cf';ctx.fillText('✦',star.x,star.y+8);
  }
  if(timer&&math.stars.length){const cx=math.stars.reduce((sum,s)=>sum+s.x,0)/math.stars.length;
    ctx.font='bold 22px "Jua","Malgun Gothic",sans-serif';ctx.fillStyle='#ffe9a9';ctx.strokeStyle='#31284b';ctx.lineWidth=5;
    ctx.strokeText('숫자 별 · '+seconds+'초',cx,Math.min(...math.stars.map(s=>s.y))-64);
    ctx.fillText('숫자 별 · '+seconds+'초',cx,Math.min(...math.stars.map(s=>s.y))-64);}
  ctx.restore();
}
