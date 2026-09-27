// 여러 맵에서 같은 타원형 마당과 문으로 이어지는 직선 다리 외곽선을 씁니다.
// LV5 몸 전체가 대각선 연결부에서도 지나가도록 모든 길목의 폭을 함께 조절합니다.
export const BRIDGE_WIDTH_SCALE=1.4;
export function gateFloorGeometry(map,{rx,ry,bridgeWidth,landing}){
  const cx=map.width/2,cy=map.height/2,half=bridgeWidth/2;
  const bridges=map.objects.filter(o=>o.kind==='gate').map(o=>{
    const horizontal=Math.abs(o.x-cx)>Math.abs(o.y-cy);
    const direction=horizontal?(o.x>cx?0:2):(o.y>cy?1:3);
    return {direction,angle:direction*Math.PI/2,end:Math.abs(horizontal?o.x-cx:o.y-cy)+landing,
      gap:Math.asin(Math.min(.99,half/(horizontal?ry:rx)))};
  }).sort((a,b)=>a.direction-b.direction);
  const points=[];
  const arc=(start,end)=>{const steps=Math.max(1,Math.ceil((end-start)/(Math.PI/96)));
    for(let i=0;i<=steps;i++){const a=start+(end-start)*i/steps;points.push({x:cx+rx*Math.cos(a),y:cy+ry*Math.sin(a)});}};
  let previous=-Math.PI/4;
  for(const b of bridges){
    arc(previous,b.angle-b.gap);
    const dx=Math.cos(b.angle),dy=Math.sin(b.angle);
    for(const side of [-1,1])points.push({x:cx+dx*b.end-dy*half*side,y:cy+dy*b.end+dx*half*side});
    previous=b.angle+b.gap;
  }
  arc(previous,Math.PI*7/4);
  return {cx,cy,rx,ry,half,bridges,points};
}
function distanceToEdge(x,y,a,b){
  const dx=b.x-a.x,dy=b.y-a.y,len=dx*dx+dy*dy;
  const t=len?Math.max(0,Math.min(1,((x-a.x)*dx+(y-a.y)*dy)/len)):0;
  return Math.hypot(x-a.x-t*dx,y-a.y-t*dy);
}
export function insideGateFloor(floor,x,y,radius=0,wallWidth=12){
  if(!Number.isFinite(x)||!Number.isFinite(y))return false;
  const {points}=floor;let inside=false;
  for(let i=0,j=points.length-1;i<points.length;j=i++){
    const a=points[j],b=points[i];
    if(distanceToEdge(x,y,a,b)<radius+wallWidth/2)return false;
    if((a.y>y)!==(b.y>y)&&x<(b.x-a.x)*(y-a.y)/(b.y-a.y)+a.x)inside=!inside;
  }
  return inside;
}
