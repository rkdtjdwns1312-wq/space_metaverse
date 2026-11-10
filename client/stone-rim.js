// 바닥의 끝은 이동 판정과 별개입니다. 네모 돌담 대신 흐릿한 그림자만 남깁니다.
const colors={silver:'#756e9e',sun:'#a78057',moon:'#6677ae'};
export const rimEdges=points=>points.map((point,index)=>[point,points[(index+1)%points.length]]);
// 화면 끝으로 이어지는 다리에는 막힌 끝단 돌 장식을 그리지 않습니다.
// 보행/충돌 외곽선은 유지하고 렌더링에만 적용합니다.
export function openMapRimEdges(edges,bounds){
  if(!bounds)return edges;
  const near=(a,b)=>Math.abs(a-b)<.01;
  return edges.filter(([a,b])=>![['x',bounds.x],['x',bounds.x+bounds.width],['y',bounds.y],['y',bounds.y+bounds.height]]
    .some(([axis,value])=>near(a[axis],value)&&near(b[axis],value)));
}
export function drawStoneRim(ctx,edges,theme='silver'){
  if(!edges?.length)return;
  ctx.save();ctx.beginPath();
  for(const [a,b] of edges){ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);}
  ctx.lineJoin='round';ctx.lineCap='round';ctx.lineWidth=9;
  ctx.strokeStyle=colors[theme]||colors.silver;ctx.globalAlpha=.13;
  ctx.shadowColor=colors[theme]||colors.silver;ctx.shadowBlur=18;
  ctx.stroke();ctx.restore();
}
