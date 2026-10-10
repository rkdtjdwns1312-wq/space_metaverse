import {PLAZA_LAYOUT as L} from '/shared/plaza-layout.js';
import {drawPaintedProp} from './painted-props.js';
export {drawDepartmentHome} from './department-art.js';
// 원화는 파일로 교체 가능하고, 한글 이름은 게임 글꼴로 선명하게 얹습니다.
const art={};
for(const name of ['market','bazaar','andromeda','mission-board','black-hole']){
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
export function drawMissionBoard(ctx,o){
  sprite(ctx,'mission-board',o.x,o.y+100,250,250);
  label(ctx,o.name,o.x,o.y+116,20);
}
export function drawBazaar(ctx,o){
  const zone=L.islands.find(z=>z.id==='market');
  // 원형 구역 안에 여백을 두고 맞춥니다. 원화의 북동~동쪽(1~3시)은 통째로 열린 입구입니다.
  const w=zone.rx*1.7,h=zone.ry*1.75;
  sprite(ctx,'bazaar',zone.x,zone.y+h/2,w,h);
  label(ctx,'별 시장',zone.x,zone.y+15,23);
}
export function drawPaintedStarShop(ctx,o){
  if(drawPaintedProp(ctx,{...o,kind:'shop'}))return;
  sprite(ctx,'market',o.x,o.y+66,224,224);
  // 별상점 위치와 기능은 그대로, 사용자가 지정한 생성 원화만 적용합니다.
  ctx.save();ctx.fillStyle='#fff7fc';ctx.strokeStyle='#b78ca8';ctx.lineWidth=2;
  ctx.beginPath();ctx.roundRect(o.x-65,o.y-139,130,28,10);ctx.fill();ctx.stroke();ctx.restore();
  label(ctx,'별 상점',o.x,o.y-119,19);
}
const words={assignment:'과제별서고 가는길',market:'별 시장 가는길',department:'부서행성 가는길','black-hole':'블랙홀 가는길'};
// 푯말 대신 중앙 마당에서 각 다리가 시작되는 지점의 바닥에 글씨만 표시합니다.
export const PLAZA_SIGNS=L.islands.map(z=>{
  const c=L.center,dx=z.x-c.x,dy=z.y-c.y;
  const t=.84/Math.hypot(dx/c.rx,dy/c.ry);
  return {id:'sign-'+z.id,x:c.x+dx*t,y:c.y+dy*t,lines:[words[z.id]]};
});
export function drawPlazaSign(ctx,s){
  ctx.save();ctx.textBaseline='middle';label(ctx,s.lines.join(' '),s.x,s.y,26);ctx.restore();
}
