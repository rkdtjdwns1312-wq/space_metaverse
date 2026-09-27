import {paradiseFloor,PARADISE_FLOOR} from '/shared/paradise-floor.js';
function outline(ctx,points){ctx.beginPath();points.forEach((p,i)=>i?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y));ctx.closePath();}
// 바닥과 다리가 이어지는 하나의 외곽에만 낮은 벽을 그립니다.
// 미니맵도 이 함수를 사용하므로 실제 이동 가능한 모양과 항상 일치합니다.
export function drawParadiseFloor(ctx,map,mini=false){
  const f=paradiseFloor(map);if(!f)return;
  const moon=map.theme==='moon-paradise',sun=map.theme==='sun-paradise';
  const rim=moon?'#8988b7':sun?'#b18b95':'#9a89b6';
  ctx.save();
  ctx.translate(0,mini?12:24);outline(ctx,f.points);ctx.fillStyle=rim;
  if(!mini){ctx.shadowColor='#39335088';ctx.shadowBlur=28;ctx.shadowOffsetY=18;}
  ctx.fill();ctx.shadowBlur=0;ctx.shadowOffsetY=0;ctx.translate(0,mini?-12:-24);
  const gradient=ctx.createLinearGradient(f.cx-f.rx,f.cy-f.ry,f.cx+f.rx,f.cy+f.ry);
  gradient.addColorStop(0,sun?'#fff7df':moon?'#eff2ff':'#fff1e4');
  gradient.addColorStop(1,sun?'#f5d9bb':moon?'#cbd5f0':'#dce5f7');
  outline(ctx,f.points);ctx.fillStyle=gradient;ctx.fill();
  // 다리의 가로 이음선은 장식이며, 폭과 벽 위치는 공통 좌표를 따릅니다.
  if(!mini){
    ctx.save();outline(ctx,f.points);ctx.clip();ctx.strokeStyle=sun?'#d8b69a55':'#aaa7d355';ctx.lineWidth=2;
    for(const b of f.bridges){
      ctx.save();ctx.translate(f.cx,f.cy);ctx.rotate(b.angle);
      const start=b.direction%2?f.ry:f.rx;
      for(let d=start-10;d<b.end;d+=38){ctx.beginPath();ctx.moveTo(d,-f.half);ctx.lineTo(d,f.half);ctx.stroke();}
      ctx.restore();
    }
    for(const scale of [.4,.72,.92]){ctx.beginPath();ctx.ellipse(f.cx,f.cy,f.rx*scale,f.ry*scale,0,0,Math.PI*2);ctx.stroke();}
    ctx.restore();
  }
  outline(ctx,f.points);ctx.strokeStyle=rim;ctx.lineWidth=PARADISE_FLOOR.wallWidth;ctx.lineJoin='round';ctx.stroke();
  // 밝은 벽 윗면과 그림자가 바닥/우주 배경 사이의 경계를 분명하게 합니다.
  ctx.translate(0,-4);outline(ctx,f.points);ctx.strokeStyle='#fffaf4';ctx.lineWidth=5;ctx.stroke();
  ctx.restore();
}
