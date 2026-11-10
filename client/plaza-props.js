import {mapImage,mapImageReady,decodeMapImages} from './map-image.js';
import {PLAZA_LAYOUT as L} from '/shared/plaza-layout.js';
import {drawPaintedProp} from './painted-props.js';
import {gateLabelBaseline} from './gate-art.js';
export {drawDepartmentHome} from './department-art.js';
// 원화는 파일로 교체 가능하고, 한글 이름은 게임 글꼴로 선명하게 얹습니다.
const art={};
art.archive=mapImage('/assets/maps/starlight-archive.png');
for(const name of ['market','bazaar','andromeda','mission-board','black-hole']){
  art[name]=mapImage('/assets/maps/plaza-'+name+'.png');
}
const ready=name=>mapImageReady(art[name]);
export async function preloadPlazaProps(){await decodeMapImages(Object.values(art));}
export function drawStarlightArchive(ctx,o,{replyUnread=false}={}){
  if(ready('archive')){const w=235,h=w*art.archive.naturalHeight/art.archive.naturalWidth;sprite(ctx,'archive',o.x,o.y+36,w,h);}
  label(ctx,o.name,o.x,o.y+60,18);
  if(replyUnread){
    const badgeY=o.y+36-(ready('archive')?235*art.archive.naturalHeight/art.archive.naturalWidth:235)-34;
    ctx.save();ctx.font='16px "Jua","Malgun Gothic",sans-serif';ctx.textAlign='center';ctx.textBaseline='alphabetic';
    const text='선생님 댓글 확인',width=ctx.measureText(text).width+20;
    ctx.fillStyle='#fff1bf';ctx.beginPath();ctx.roundRect(o.x-width/2,badgeY,width,28,12);ctx.fill();
    ctx.fillStyle='#805218';ctx.fillText(text,o.x,badgeY+19);ctx.restore();
  }
}
function sprite(ctx,name,x,y,w,h){if(!ready(name))return false;ctx.drawImage(art[name],x-w/2,y-h,w,h);return true;}
function label(ctx,text,x,y,size=18){ctx.save();ctx.font=`${size}px "Jua","Malgun Gothic",sans-serif`;ctx.textAlign='center';ctx.lineJoin='round';ctx.strokeStyle='#fffaf4';ctx.lineWidth=5;ctx.strokeText(text,x,y);ctx.fillStyle='#67537f';ctx.fillText(text,x,y);ctx.restore();}

export function drawPlazaLandmark(ctx,o){
  const name=o.kind==='andromeda'?'andromeda':'black-hole';
  const scale=o.visualScale||1,w=(o.kind==='andromeda'?360:290)*scale,h=330*scale;
  sprite(ctx,name,o.x,o.y+110*scale,w,h);
  if(!o.hideLabel){
    if(o.kind==='black-hole'){
      ctx.save();ctx.font='21px "Jua","Malgun Gothic",sans-serif';ctx.lineWidth=5;
      // Visible alpha rows 34..1210 of the existing 1254px black-hole art.
      const y=gateLabelBaseline(ctx,o.name,{y:o.y+110*scale-h+h*34/1254,height:h*1177/1254},!!o.labelBelow);ctx.restore();label(ctx,o.name,o.x,y,21);
    }else label(ctx,o.name,o.x,o.labelAbove?o.y+110*scale-h-22:o.y+125*scale,21);
  }
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
export function drawPlazaSign(ctx,s){
  ctx.save();ctx.textBaseline='middle';label(ctx,s.lines.join(' '),s.x,s.y,26);ctx.restore();
}
