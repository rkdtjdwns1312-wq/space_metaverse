import {paradiseFloor,PARADISE_FLOOR} from '/shared/paradise-floor.js';
import {drawParadiseArt} from './paradise-art.js';
import {drawStoneRim,rimEdges} from './stone-rim.js';

function outline(ctx,points){ctx.beginPath();points.forEach((p,i)=>i?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y));ctx.closePath();}

// 이동 가능한 외곽선은 공용 지형 정의를 따르며, 석재 장식은 바닥 캐시에 그립니다.
export function drawParadiseFloor(ctx,map,mini=false){
  const f=paradiseFloor(map);if(!f)return;
  const moon=map.theme==='moon-paradise',sun=map.theme==='sun-paradise';
  const rim=moon?'#8a8caf':sun?'#b39480':'#9989a8';
  ctx.save();ctx.translate(0,12);outline(ctx,f.points);ctx.fillStyle=rim;
  if(!mini){ctx.shadowColor='#30283c66';ctx.shadowBlur=20;ctx.shadowOffsetY=12;}
  ctx.fill();ctx.shadowBlur=0;ctx.shadowOffsetY=0;ctx.translate(0,-12);
  if(!mini)drawParadiseArt(ctx,map,f);
  else{outline(ctx,f.points);ctx.fillStyle=moon?'#e6e9f5':sun?'#f4e8d9':'#ece6f1';ctx.fill();}
  if(mini){outline(ctx,f.points);ctx.strokeStyle=rim;ctx.lineWidth=PARADISE_FLOOR.wallWidth;ctx.lineJoin='round';ctx.stroke();}
  else drawStoneRim(ctx,rimEdges(f.points),moon?'moon':sun?'sun':'silver');
  ctx.restore();
}
