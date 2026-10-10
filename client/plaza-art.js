import {PLAZA_LAYOUT as L,PLAZA_POLYGONS,PLAZA_EDGES,DEPARTMENT_ZONE} from '/shared/plaza-layout.js';
import {drawStoneRim} from './stone-rim.js';
import {drawFloatingIslands} from './floating-island.js';
// 원화는 로드 후 재사용합니다. 3720px 전체 배경 캔버스를 만들지 않고 화면에 보이는
// 768px 조각만 캐시하여 크롬북에서도 거대한 이미지 버퍼를 매번 다시 만들지 않습니다.
const images={},tiles=new Map(),SIZE=768,LIMIT=16;
let overview=null;
for(const [id,path] of Object.entries({sky:'plaza-sanctuary.png',floor:'plaza-paving.png',pillar:'plaza-pillar.png',temple:'plaza-temple.png',flask:'plaza-exploration-flask.png'})){
  const image=new Image();image.onload=()=>{tiles.clear();overview=null;};image.src='/assets/maps/'+path;images[id]=image;
}
const ready=img=>img.complete&&img.naturalWidth>0;
const floorPath=new Path2D();
for(const poly of PLAZA_POLYGONS){floorPath.moveTo(poly[0].x,poly[0].y);for(const p of poly.slice(1))floorPath.lineTo(p.x,p.y);floorPath.closePath();}
const edgePath=new Path2D();for(const [a,b] of PLAZA_EDGES){edgePath.moveTo(a.x,a.y);edgePath.lineTo(b.x,b.y);}
function ring(ctx,z,inset,color,width){ctx.beginPath();ctx.ellipse(z.x,z.y,z.rx-inset,z.ry-inset*.7,0,0,Math.PI*2);ctx.strokeStyle=color;ctx.lineWidth=width;ctx.stroke();}
function ground(ctx){
  drawFloatingIslands(ctx,[L.center,...L.islands],'plaza',L.height);
  ctx.save();ctx.translate(0,12);ctx.fillStyle='#968ba7';ctx.shadowColor='#17193377';ctx.shadowBlur=24;ctx.shadowOffsetY=12;ctx.fill(floorPath);ctx.restore();
  ctx.save();ctx.clip(floorPath);ctx.fillStyle='#eee8f4';ctx.fillRect(0,0,L.width,L.height);
  if(ready(images.floor)){const pattern=ctx.createPattern(images.floor,'repeat');pattern.setTransform(new DOMMatrix().scale(.30));ctx.fillStyle=pattern;ctx.fillRect(0,0,L.width,L.height);}
  for(const z of L.islands){ctx.fillStyle=z.color+'55';ctx.beginPath();ctx.ellipse(z.x,z.y,z.rx,z.ry,0,0,Math.PI*2);ctx.fill();ring(ctx,z,58,'#bca6c780',3);}
  ctx.font='28px "Jua","Malgun Gothic",sans-serif';ctx.textAlign='center';ctx.fillStyle='#728878';
  ctx.fillText('부서행성 광장',DEPARTMENT_ZONE.x,DEPARTMENT_ZONE.y-DEPARTMENT_ZONE.ry+84);
  // 원형 장식선 대신 단정한 사각 신전 원화 바닥을 놓습니다.
  const c=L.center;if(ready(images.temple))ctx.drawImage(images.temple,c.x-360,c.y-250,720,480);
  ctx.restore();drawStoneRim(ctx,PLAZA_EDGES);
}
function tile(tx,ty){const key=tx+':'+ty;let canvas=tiles.get(key);if(canvas){tiles.delete(key);tiles.set(key,canvas);return canvas;}
  canvas=document.createElement('canvas');canvas.width=SIZE+4;canvas.height=SIZE+4;const c=canvas.getContext('2d');c.translate(-tx*SIZE+2,-ty*SIZE+2);ground(c);tiles.set(key,canvas);
  if(tiles.size>LIMIT)tiles.delete(tiles.keys().next().value);return canvas;
}
export function drawPlazaGround(ctx,map,time=0){
  ctx.fillStyle='#555883';ctx.fillRect(0,0,map.width,map.height);
  if(ready(images.sky))ctx.drawImage(images.sky,0,0,map.width,map.height);
  if(Math.abs(ctx.getTransform().a)<.4){
    if(!overview){overview=document.createElement('canvas');overview.width=Math.ceil(L.width/4);overview.height=Math.ceil(L.height/4);const c=overview.getContext('2d');c.scale(.25,.25);ground(c);}
    ctx.drawImage(overview,0,0,L.width,L.height);return;
  }
  const inv=ctx.getTransform().inverse(),a=new DOMPoint(0,0).matrixTransform(inv),b=new DOMPoint(ctx.canvas.width,ctx.canvas.height).matrixTransform(inv);
  const left=Math.max(0,Math.floor(Math.min(a.x,b.x)/SIZE)),right=Math.min(Math.ceil(map.width/SIZE)-1,Math.floor(Math.max(a.x,b.x)/SIZE));
  const top=Math.max(0,Math.floor(Math.min(a.y,b.y)/SIZE)),bottom=Math.min(Math.ceil(map.height/SIZE)-1,Math.floor(Math.max(a.y,b.y)/SIZE));
  for(let y=top;y<=bottom;y++)for(let x=left;x<=right;x++)ctx.drawImage(tile(x,y),x*SIZE-2,y*SIZE-2);
}
export function drawPlazaPillar(ctx,o){
  ctx.save();ctx.fillStyle='#53436735';ctx.beginPath();ctx.ellipse(o.x+14,o.y+5,38,13,.18,0,Math.PI*2);ctx.fill();
  if(ready(images.pillar)){
    // 투명 원본의 발끝은 높이 약94%에 있습니다. 발 기준을 실제 충돌 원에 맞춥니다.
    ctx.drawImage(images.pillar,o.x-64,o.y-174,128,185);
  }else{ctx.fillStyle='#f6ecff';ctx.fillRect(o.x-19,o.y-145,38,145);}
  ctx.font='17px "Jua","Malgun Gothic",sans-serif';ctx.textAlign='center';ctx.strokeStyle='#fffaf3';ctx.lineWidth=4;ctx.lineJoin='round';ctx.strokeText(o.name,o.x,o.y+9);ctx.fillStyle='#695382';ctx.fillText(o.name,o.x,o.y+9);ctx.restore();
}
export function drawExplorationFlask(ctx,o,time=0){
  if(!ready(images.flask))return;
  ctx.save();ctx.globalAlpha=.96+.04*Math.sin(time/780);
  ctx.drawImage(images.flask,o.x-58,o.y-163,116,174);
  ctx.restore();
}
export function drawDepartmentGuide(ctx){const z=DEPARTMENT_ZONE;ctx.save();const glow=ctx.createRadialGradient(z.x,z.y,Math.min(z.rx,z.ry)*.28,z.x,z.y,Math.max(z.rx,z.ry)*.9);glow.addColorStop(0,'#c9f5d019');glow.addColorStop(.7,'#b5efca33');glow.addColorStop(1,'#b5efca00');ctx.fillStyle=glow;ctx.beginPath();ctx.ellipse(z.x,z.y,z.rx-95,z.ry-95,0,0,Math.PI*2);ctx.fill();ctx.font='38px "Jua",sans-serif';ctx.fillStyle='#4c765e';ctx.textAlign='center';ctx.fillText('부서행성은 이 공간에 만들어요',z.x,z.y-z.ry+95);ctx.restore();}
export function drawPlazaMiniFloor(ctx){ctx.fillStyle='#555883';ctx.fillRect(0,0,L.width,L.height);drawFloatingIslands(ctx,[L.center,...L.islands],'plaza',L.height);ctx.fillStyle='#f4eaf4';ctx.fill(floorPath);for(const z of L.islands){ctx.fillStyle=z.color;ctx.beginPath();ctx.ellipse(z.x,z.y,z.rx-10,z.ry-10,0,0,Math.PI*2);ctx.fill();}ctx.strokeStyle='#b8a0c455';ctx.lineWidth=7;ctx.stroke(edgePath);}
