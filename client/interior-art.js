import {interiorDecorStyle,interiorDecorColor} from '/shared/interior-decor.js';

// 같은 원화에 꾸미기 색과 장식을 덧그려, 기존 저장된 꾸미기도 유지합니다.
export const INTERIOR_ART={board:'/assets/interior/board.png',mailbox:'/assets/interior/mailbox.png',
  'report-board':'/assets/interior/report.png','warning-rock':'/assets/interior/warning.png',
  'interior-decor-machine':'/assets/interior/control.png'};
const images=new Map(),floors=new Map(),tints=new Map();
function asset(src){if(!images.has(src)){const image=new Image();image.onload=()=>floors.clear();image.src=src;images.set(src,image);}return images.get(src);}
const ready=image=>image.complete&&image.naturalWidth>0;
export async function preloadInteriorArt(){await Promise.all([...Object.values(INTERIOR_ART),'/assets/maps/plaza-paving.png'].map(src=>asset(src).decode()));}
export function drawInteriorFloor(ctx,map,planet){
  const style=interiorDecorStyle(planet?.interiorDecor,'room'),color=interiorDecorColor(style.colorId)?.hex;
  const key=map.width+'x'+map.height+':'+style.colorId+':'+style.shapeId;let floor=floors.get(key);const tile=asset('/assets/maps/plaza-paving.png');
  if(!floor){floor=document.createElement('canvas');floor.width=map.width;floor.height=map.height;const c=floor.getContext('2d');
    c.fillStyle='#edf0f5';c.fillRect(0,0,map.width,map.height);
    if(ready(tile)){c.save();c.filter='grayscale(1)';const pattern=c.createPattern(tile,'repeat');pattern.setTransform(new DOMMatrix().scale(.3));c.fillStyle=pattern;c.fillRect(0,0,map.width,map.height);c.restore();}
    c.fillStyle='#f3f7ff70';c.fillRect(0,0,map.width,map.height);
    if(color){c.save();c.globalAlpha=.23;c.fillStyle=color;c.fillRect(0,0,map.width,map.height);c.restore();}
    // 기본 은빛 바닥 질감 위에 선택한 작은 무늬만 추가합니다.
    if(style.shapeId==='star'){
      c.save();c.fillStyle='#fffdfb';c.strokeStyle='#a9a1bf';c.lineWidth=1;
      for(let y=80;y<map.height-35;y+=100)for(let x=80;x<map.width-35;x+=120){starPath(c,x,y,12);c.fill();c.stroke();}c.restore();
    }else if(style.shapeId==='grid'){
      c.save();c.strokeStyle='#acb6c980';c.lineWidth=2;c.beginPath();
      for(let x=40;x<map.width;x+=80){c.moveTo(x,24);c.lineTo(x,map.height-24);}for(let y=40;y<map.height;y+=80){c.moveTo(24,y);c.lineTo(map.width-24,y);}c.stroke();c.restore();
    }
    c.strokeStyle='#9ea9bf';c.lineWidth=16;c.strokeRect(16,16,map.width-32,map.height-32);
    c.strokeStyle='#fafcff';c.lineWidth=4;c.strokeRect(21,21,map.width-42,map.height-42);
    if(floors.size>=8)floors.delete(floors.keys().next().value);floors.set(key,floor);
  }ctx.drawImage(floor,0,0);
}
function label(ctx,text,x,y,size=18){ctx.font=`${size}px "Jua","Malgun Gothic",sans-serif`;ctx.textAlign='center';ctx.textBaseline='alphabetic';ctx.lineWidth=4;ctx.strokeStyle='#fffdf7';ctx.strokeText(text,x,y);ctx.fillStyle='#594c75';ctx.fillText(text,x,y);}
function starPath(ctx,x,y,r){ctx.beginPath();for(let i=0;i<10;i++){const a=-Math.PI/2+i*Math.PI/5,s=i%2?r*.46:r;i?ctx.lineTo(x+Math.cos(a)*s,y+Math.sin(a)*s):ctx.moveTo(x+Math.cos(a)*s,y+Math.sin(a)*s);}ctx.closePath();}
export function drawInteriorDecoration(ctx,o,style){
  if(!style||style.shapeId==='default')return;
  const x=o.x,y=o.y+(o.kind==='board'?155:30),r=22;ctx.save();ctx.fillStyle=interiorDecorColor(style.colorId)?.hex||'#e2d7f2';ctx.strokeStyle='#a696bc';ctx.lineWidth=2;
  if(style.shapeId==='star'){starPath(ctx,x,y,r);ctx.fill();ctx.stroke();}
  else if(style.shapeId==='moon'){ctx.beginPath();ctx.arc(x,y,r,.7,Math.PI*2-.7);ctx.arc(x+r*.62,y,r*.7,-Math.PI*.6,Math.PI*.6,true);ctx.closePath();ctx.fill();ctx.stroke();}
  else if(['hex','crystal','tablet'].includes(style.shapeId)){ctx.beginPath();for(let i=0;i<6;i++){const a=Math.PI*i/3;ctx.lineTo(x+Math.cos(a)*r,y+Math.sin(a)*r);}ctx.closePath();ctx.fill();ctx.stroke();}
  else if(style.shapeId==='scroll'){for(const dx of [-24,24]){ctx.beginPath();ctx.roundRect(x+dx-4,y-20,8,40,4);ctx.fill();ctx.stroke();}}
  else{ctx.beginPath();ctx.ellipse(x,y,r,r*.75,0,0,Math.PI*2);ctx.fill();ctx.stroke();}
  ctx.restore();
}
export function drawInteriorProp(ctx,o,planet){
  const src=INTERIOR_ART[o.kind];if(!src)return false;
  const img=asset(src),style=interiorDecorStyle(planet?.interiorDecor,o.id),color=interiorDecorColor(style.colorId)?.hex;
  const sizes={board:[640,330,180],mailbox:[120,160,67],'report-board':[135,175,65],'warning-rock':[130,160,60],'interior-decor-machine':[170,190,68]};
  const [w,h,foot]=sizes[o.kind],left=o.x-w/2,top=o.y+foot-h;
  ctx.save();
  if(ready(img)){const scale=Math.min(w/img.naturalWidth,h/img.naturalHeight),dw=img.naturalWidth*scale,dh=img.naturalHeight*scale;
    ctx.drawImage(img,o.x-dw/2,top+(h-dh)/2,dw,dh);
    // Tint only the painted pixels, never a rectangular patch around the prop.
    if(color){const key=src+color;let tint=tints.get(key);if(!tint){tint=document.createElement('canvas');tint.width=Math.ceil(dw);tint.height=Math.ceil(dh);const t=tint.getContext('2d');t.drawImage(img,0,0,dw,dh);t.globalCompositeOperation='source-atop';t.globalAlpha=.25;t.fillStyle=color;t.fillRect(0,0,dw,dh);tints.set(key,tint);}ctx.drawImage(tint,o.x-dw/2,top+(h-dh)/2);}
  }else{ctx.fillStyle='#ddd9e8';ctx.beginPath();ctx.roundRect(left,top,w,h,20);ctx.fill();}
  // 게시판 본문은 원화 안쪽 HTML 스크롤 영역(interior-board-ui.js)에서 표시합니다.
  if(o.kind!=='board'){
    const names={mailbox:'가입 신청 우체통','report-board':'실적작성표','warning-rock':'경고 제어돌','interior-decor-machine':'부서행성 제어장치'};
    label(ctx,names[o.kind],o.x,o.y+foot+22);
    if(o.kind==='mailbox'&&planet?.mailboxCount){ctx.fillStyle='#d96693';ctx.beginPath();ctx.arc(o.x+39,o.y-45,15,0,Math.PI*2);ctx.fill();ctx.fillStyle='#fff';ctx.font='16px "Jua",sans-serif';ctx.fillText(String(planet.mailboxCount),o.x+39,o.y-40);}
  }
  drawInteriorDecoration(ctx,o,style);ctx.restore();return true;
}
