import {PLAZA_LAYOUT as L} from '/shared/plaza-layout.js';
// 원화는 파일로 교체 가능하고, 한글 이름은 게임 글꼴로 선명하게 얹습니다.
const art={};
for(const name of ['market','bazaar','andromeda','black-hole','department','sign']){
  const img=new Image();img.src='/assets/maps/plaza-'+name+'.png';art[name]=img;
}
const ready=name=>art[name].complete&&art[name].naturalWidth>0;
function sprite(ctx,name,x,y,w,h){if(!ready(name))return false;ctx.drawImage(art[name],x-w/2,y-h,w,h);return true;}
function label(ctx,text,x,y,size=18){ctx.save();ctx.font=`${size}px "Jua","Malgun Gothic",sans-serif`;ctx.textAlign='center';ctx.lineJoin='round';ctx.strokeStyle='#fffaf4';ctx.lineWidth=5;ctx.strokeText(text,x,y);ctx.fillStyle='#67537f';ctx.fillText(text,x,y);ctx.restore();}

export function drawPlazaLandmark(ctx,o){
  const name=o.kind==='andromeda'?'andromeda':'black-hole';
  const w=o.kind==='andromeda'?360:290,h=o.kind==='andromeda'?330:330;
  sprite(ctx,name,o.x,o.y+110,w,h);
  label(ctx,o.name,o.x,o.y+125,21);
}
export function drawDepartmentHome(ctx,o,myDept,template){
  const w=o.radius*2.65,h=o.radius*3.15;
  if(o.id===myDept){ctx.save();ctx.strokeStyle='#c3a0ed';ctx.lineWidth=3;ctx.beginPath();ctx.ellipse(o.x,o.y+o.radius*.5,o.radius+9,o.radius*.45,0,0,Math.PI*2);ctx.stroke();ctx.restore();}
  sprite(ctx,'department',o.x,o.y+o.radius*.9,w,h);
  // 색과 종류를 유지하여 같은 기본 원화를 쓰는 부서들도 구별합니다.
  ctx.save();ctx.fillStyle=o.color||'#d7c5ec';ctx.strokeStyle='#fff9ed';ctx.lineWidth=2;
  ctx.beginPath();ctx.arc(o.x+o.radius*.8,o.y-o.radius*.8,10,0,Math.PI*2);ctx.fill();ctx.stroke();
  if(template){ctx.font='13px sans-serif';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(template.icon,o.x+o.radius*.8,o.y-o.radius*.8);}
  ctx.restore();
}
export function drawBazaar(ctx,o){
  sprite(ctx,'bazaar',o.x,o.y+260,730,487);
  label(ctx,'별 시장',o.x+50,o.y+30,23);
}
export function drawPaintedStarShop(ctx,o){
  sprite(ctx,'market',o.x,o.y+66,224,224);
  // 별상점 위치와 기능은 그대로, 사용자가 지정한 생성 원화만 적용합니다.
  ctx.save();ctx.fillStyle='#fff7fc';ctx.strokeStyle='#b78ca8';ctx.lineWidth=2;
  ctx.beginPath();ctx.roundRect(o.x-65,o.y-139,130,28,10);ctx.fill();ctx.stroke();ctx.restore();
  label(ctx,'별 상점',o.x,o.y-119,19);
}
const words={assignment:['과제안드로메다'],market:['시장으로가는길'],department:['부서행성으로','가는길'],'black-hole':['블랙홀로 가는길']};
export const PLAZA_SIGNS=L.islands.map(z=>{
  const c=L.center,dx=z.x-c.x,dy=z.y-c.y,length=Math.hypot(dx,dy);
  // 입구의 중앙 통행선 옆, 중앙 바닥 안쪽에 세워 다리 폭을 가리지 않습니다.
  const t=.76/Math.hypot(dx/c.rx,dy/c.ry),side=z.x<c.x?1:-1;
  return {id:'sign-'+z.id,x:c.x+dx*t-dy/length*112*side,y:c.y+dy*t+dx/length*112*side,lines:words[z.id]};
});
export function drawPlazaSign(ctx,s){
  sprite(ctx,'sign',s.x,s.y+12,210,140);
  ctx.save();ctx.textAlign='center';ctx.textBaseline='middle';ctx.font='17px "Jua","Malgun Gothic",sans-serif';ctx.fillStyle='#5d476e';
  const center=s.y-69;s.lines.forEach((line,i)=>ctx.fillText(line,s.x,center+(i-(s.lines.length-1)/2)*21,180));ctx.restore();
}
