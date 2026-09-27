import {PLAZA_LAYOUT as L,PLAZA_POLYGONS,PLAZA_EDGES,DEPARTMENT_ZONE} from '/shared/plaza-layout.js';
// 원화는 로드 후 재사용합니다. 3720px 전체 배경 캔버스를 만들지 않고 화면에 보이는
// 768px 조각만 캐시하여 크롬북에서도 거대한 이미지 버퍼를 매번 다시 만들지 않습니다.
const images={},tiles=new Map(),SIZE=768,LIMIT=16;
let overview=null;
for(const [id,path] of Object.entries({sky:'plaza-sanctuary.png',floor:'plaza-paving.png',pillar:'plaza-pillar.png',temple:'plaza-temple.png'})){
  const image=new Image();image.onload=()=>{tiles.clear();overview=null;};image.src='/assets/maps/'+path;images[id]=image;
}
const ready=img=>img.complete&&img.naturalWidth>0;
const floorPath=new Path2D();
for(const poly of PLAZA_POLYGONS){floorPath.moveTo(poly[0].x,poly[0].y);for(const p of poly.slice(1))floorPath.lineTo(p.x,p.y);floorPath.closePath();}
const edgePath=new Path2D();for(const [a,b] of PLAZA_EDGES){edgePath.moveTo(a.x,a.y);edgePath.lineTo(b.x,b.y);}
function ring(ctx,z,inset,color,width){ctx.beginPath();ctx.ellipse(z.x,z.y,z.rx-inset,z.ry-inset*.7,0,0,Math.PI*2);ctx.strokeStyle=color;ctx.lineWidth=width;ctx.stroke();}
function garden(ctx,x,y,angle){
  ctx.save();ctx.translate(x,y);ctx.rotate(angle);ctx.fillStyle='#a8bba677';ctx.beginPath();ctx.ellipse(0,0,44,20,0,0,Math.PI*2);ctx.fill();
  // 바닥 높이의 꽃 장식이라 시야나 통행을 막지 않습니다.
  for(let i=0;i<9;i++){const fx=(i*19%65)-32,fy=(i*13%25)-12;ctx.fillStyle=i%2?'#9dc7b4':'#c2d8ab';ctx.beginPath();ctx.ellipse(fx,fy,9,4,i,0,Math.PI*2);ctx.fill();
    for(let p=0;p<5;p++){const a=p*Math.PI*2/5;ctx.fillStyle=i%3?'#f5e5f5':'#cddffc';ctx.beginPath();ctx.ellipse(fx+Math.cos(a)*4,fy+Math.sin(a)*4,3.5,2.5,a,0,Math.PI*2);ctx.fill();}
    ctx.fillStyle='#f4ce83';ctx.beginPath();ctx.arc(fx,fy,2,0,Math.PI*2);ctx.fill();}
  ctx.restore();
}
function ground(ctx){
  ctx.save();ctx.translate(0,35);ctx.fillStyle='#74658d';ctx.shadowColor='#17193399';ctx.shadowBlur=30;ctx.shadowOffsetY=20;ctx.fill(floorPath);ctx.restore();
  ctx.save();ctx.clip(floorPath);ctx.fillStyle='#eee8f4';ctx.fillRect(0,0,L.width,L.height);
  if(ready(images.floor)){const pattern=ctx.createPattern(images.floor,'repeat');pattern.setTransform(new DOMMatrix().scale(.30));ctx.fillStyle=pattern;ctx.fillRect(0,0,L.width,L.height);}
  for(const z of L.islands){ctx.fillStyle=z.color+'55';ctx.beginPath();ctx.ellipse(z.x,z.y,z.rx,z.ry,0,0,Math.PI*2);ctx.fill();ring(ctx,z,58,'#bca6c780',3);}
  ctx.font='28px "Jua","Malgun Gothic",sans-serif';ctx.textAlign='center';ctx.fillStyle='#728878';
  ctx.fillText('부서행성 광장',DEPARTMENT_ZONE.x,DEPARTMENT_ZONE.y-DEPARTMENT_ZONE.ry+84);
  // 원형 장식선 대신 단정한 사각 신전 원화 바닥을 놓습니다.
  const c=L.center;if(ready(images.temple))ctx.drawImage(images.temple,c.x-360,c.y-250,720,480);
  for(const z of [L.center,...L.islands])for(let i=0;i<20;i++){
    const a=(i+.5)*Math.PI/10,p={x:z.x+Math.cos(a)*(z.rx-90),y:z.y+Math.sin(a)*(z.ry-70)};
    // 다리 접속 방향은 비워 둡니다.
    if(Math.abs(Math.sin(a*2))<.28||Math.abs(Math.sin(a*2))>.97)continue;garden(ctx,p.x,p.y,a);
  }
  ctx.restore();ctx.save();ctx.lineJoin='round';ctx.lineCap='round';
  ctx.strokeStyle='#a693bd';ctx.lineWidth=15;ctx.stroke(edgePath);ctx.strokeStyle='#fff5e2';ctx.lineWidth=5;ctx.stroke(edgePath);ctx.restore();
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
export function drawDepartmentGuide(ctx){const z=DEPARTMENT_ZONE;ctx.save();ctx.fillStyle='#b5efca33';ctx.strokeStyle='#78a88a';ctx.lineWidth=10;ctx.setLineDash([22,15]);ctx.beginPath();ctx.ellipse(z.x,z.y,z.rx-120,z.ry-120,0,0,Math.PI*2);ctx.fill();ctx.stroke();ctx.setLineDash([]);ctx.font='38px "Jua",sans-serif';ctx.fillStyle='#4c765e';ctx.textAlign='center';ctx.fillText('부서행성은 이 공간에 만들어요',z.x,z.y-z.ry+95);ctx.restore();}
export function drawPlazaMiniFloor(ctx){ctx.fillStyle='#555883';ctx.fillRect(0,0,L.width,L.height);ctx.fillStyle='#f4eaf4';ctx.fill(floorPath);for(const z of L.islands){ctx.fillStyle=z.color;ctx.beginPath();ctx.ellipse(z.x,z.y,z.rx-10,z.ry-10,0,0,Math.PI*2);ctx.fill();}ctx.strokeStyle='#b8a0c4';ctx.lineWidth=24;ctx.stroke(edgePath);}
