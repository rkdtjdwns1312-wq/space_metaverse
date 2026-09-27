import {interiorDecorStyle,interiorDecorColor} from '/shared/interior-decor.js';

// 같은 원화에 꾸미기 색과 장식을 덧그려, 기존 저장된 꾸미기도 유지합니다.
export const INTERIOR_ART={board:'/assets/interior/board.png',mailbox:'/assets/interior/mailbox.png',
  'report-board':'/assets/interior/report.png','warning-rock':'/assets/interior/warning.png',
  'interior-decor-machine':'/assets/interior/control.png'};
const images=new Map(),floors=new Map(),tints=new Map();
function asset(src){if(!images.has(src)){const image=new Image();image.onload=()=>floors.clear();image.src=src;images.set(src,image);}return images.get(src);}
const ready=image=>image.complete&&image.naturalWidth>0;
export async function preloadInteriorArt(){await Promise.all([...Object.values(INTERIOR_ART),'/assets/maps/plaza-paving.png'].map(src=>asset(src).decode()));}
export function drawInteriorFloor(ctx,map){
  const key=map.width+'x'+map.height;let floor=floors.get(key);const tile=asset('/assets/maps/plaza-paving.png');
  if(!floor){floor=document.createElement('canvas');floor.width=map.width;floor.height=map.height;const c=floor.getContext('2d');
    c.fillStyle='#edf0f5';c.fillRect(0,0,map.width,map.height);
    if(ready(tile)){c.save();c.filter='grayscale(1)';const pattern=c.createPattern(tile,'repeat');pattern.setTransform(new DOMMatrix().scale(.3));c.fillStyle=pattern;c.fillRect(0,0,map.width,map.height);c.restore();}
    c.fillStyle='#f3f7ff70';c.fillRect(0,0,map.width,map.height);
    c.strokeStyle='#9ea9bf';c.lineWidth=16;c.strokeRect(16,16,map.width-32,map.height-32);
    c.strokeStyle='#fafcff';c.lineWidth=4;c.strokeRect(21,21,map.width-42,map.height-42);
    floors.set(key,floor);
  }ctx.drawImage(floor,0,0);
}
function label(ctx,text,x,y,size=18){ctx.font=`${size}px "Jua","Malgun Gothic",sans-serif`;ctx.textAlign='center';ctx.textBaseline='alphabetic';ctx.lineWidth=4;ctx.strokeStyle='#fffdf7';ctx.strokeText(text,x,y);ctx.fillStyle='#594c75';ctx.fillText(text,x,y);}
function starPath(ctx,x,y,r){ctx.beginPath();for(let i=0;i<10;i++){const a=-Math.PI/2+i*Math.PI/5,s=i%2?r*.46:r;i?ctx.lineTo(x+Math.cos(a)*s,y+Math.sin(a)*s):ctx.moveTo(x+Math.cos(a)*s,y+Math.sin(a)*s);}ctx.closePath();}
export function drawInteriorDecoration(ctx,o,style){
  if(!style||style.shapeId==='default')return;
  const x=o.x,y=o.y+(o.kind==='board'?155:30),r=22;ctx.save();ctx.fillStyle=interiorDecorColor(style.colorId)?.hex||'#e2d7f2';ctx.strokeStyle='#a696bc';ctx.lineWidth=2;
  if(style.shapeId==='star'){starPath(ctx,x,y,r);ctx.fill();ctx.stroke();}
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
  if(o.kind==='board'){
    const rules=(planet?.rules||[]).slice(0,8);label(ctx,(planet?.name||'행성')+' 규칙',o.x,top+112,19);
    let size=15;while(size>10&&rules.some(line=>{ctx.font=`${size}px "Jua","Malgun Gothic",sans-serif`;return ctx.measureText(line).width>460;}))size--;
    ctx.font=`${size}px "Jua","Malgun Gothic",sans-serif`;ctx.fillStyle='#635776';ctx.textAlign='center';
    rules.forEach((line,i)=>ctx.fillText(line,o.x,top+139+i*16,460));
  }else{
    const names={mailbox:'가입 신청 우체통','report-board':'부서실적 작성하기','warning-rock':'경고 제어돌','interior-decor-machine':'부서행성 제어장치'};
    label(ctx,names[o.kind],o.x,o.y+foot+22);
    if(o.kind==='mailbox'&&planet?.mailboxCount){ctx.fillStyle='#d96693';ctx.beginPath();ctx.arc(o.x+39,o.y-45,15,0,Math.PI*2);ctx.fill();ctx.fillStyle='#fff';ctx.font='16px "Jua",sans-serif';ctx.fillText(String(planet.mailboxCount),o.x+39,o.y-40);}
  }
  drawInteriorDecoration(ctx,o,style);ctx.restore();return true;
}
