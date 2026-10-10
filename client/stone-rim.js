// 바닥의 끝은 이동 판정과 별개입니다. 네모 돌담 대신 흐릿한 그림자만 남깁니다.
const colors={silver:'#756e9e',sun:'#a78057',moon:'#6677ae'};
export const rimEdges=points=>points.map((point,index)=>[point,points[(index+1)%points.length]]);
export function drawStoneRim(ctx,edges,theme='silver'){
  if(!edges?.length)return;
  ctx.save();ctx.beginPath();
  for(const [a,b] of edges){ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);}
  ctx.lineJoin='round';ctx.lineCap='round';ctx.lineWidth=9;
  ctx.strokeStyle=colors[theme]||colors.silver;ctx.globalAlpha=.13;
  ctx.shadowColor=colors[theme]||colors.silver;ctx.shadowBlur=18;
  ctx.stroke();ctx.restore();
}
