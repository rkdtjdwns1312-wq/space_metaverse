const images={};
let cacheEpoch=0;
const listeners=new Set();
const ready=image=>image?.complete&&image.naturalWidth>0;
for(const [key,file] of Object.entries({sun:'paradise-sun.png',moon:'paradise-moon.png',sky:'plaza-sanctuary.png'})){
  const image=new Image();image.onload=()=>{cacheEpoch++;for(const listener of listeners)listener();};image.src='/assets/maps/'+file;images[key]=image;
}
const paving=new Image();paving.onload=()=>{cacheEpoch++;for(const listener of listeners)listener();};paving.src='/assets/maps/plaza-paving.png';images.paradisePaving=paving;
export function onParadiseArtReady(listener){listeners.add(listener);return()=>listeners.delete(listener);}
export function paradiseArtCacheKey(){return cacheEpoch;}

function fallbackBody(ctx,map,moon){
  const {bodyX:x,bodyY:y,bodyRadius:r}=map.vista;
  const glow=ctx.createRadialGradient(x,y,r*.2,x,y,r*1.7);
  glow.addColorStop(0,moon?'#e9edff99':'#fff2c399');glow.addColorStop(1,'#ffffff00');
  ctx.fillStyle=glow;ctx.fillRect(x-r*1.7,y-r*1.7,r*3.4,r*3.4);
  const body=ctx.createRadialGradient(x-r*.3,y-r*.35,r*.05,x,y,r);
  body.addColorStop(0,moon?'#fffef8':'#fffde3');body.addColorStop(.68,moon?'#e4e7f8':'#ffedb2');body.addColorStop(1,moon?'#aeb6d5':'#ecc176');
  ctx.fillStyle=body;ctx.beginPath();ctx.arc(x,y,r,0,Math.PI*2);ctx.fill();
  ctx.strokeStyle=moon?'#f4f5ff99':'#fff2c799';ctx.lineWidth=Math.max(2,r*.025);
  for(let i=0;i<7;i++){const a=i*Math.PI*2/7;ctx.beginPath();ctx.arc(x+Math.cos(a)*r*.35,y+Math.sin(a)*r*.35,r*(.1+i%3*.035),0,Math.PI*2);ctx.stroke();}
}

function gardenBed(ctx,x,y,rx,ry,color){
  ctx.save();ctx.fillStyle='#342d3c22';ctx.beginPath();ctx.roundRect(x-rx,y-ry+9,rx*2,ry*2,ry);ctx.fill();
  ctx.fillStyle='#74856f';ctx.beginPath();ctx.roundRect(x-rx,y-ry,rx*2,ry*2,ry);ctx.fill();
  ctx.fillStyle=color;ctx.beginPath();ctx.roundRect(x-rx+5,y-ry+4,rx*2-10,ry*2-9,ry-4);ctx.fill();
  for(let i=0;i<5;i++){const px=x+(i-2)*rx*.27,py=y-4+(i%2)*3;ctx.fillStyle=i%2?'#f4e5d0':'#e7d8ed';ctx.beginPath();ctx.arc(px,py,3.5,0,Math.PI*2);ctx.fill();}
  ctx.restore();
}

function bedPoints(f){
  const points=[];
  for(let i=0;i<6;i++){
    const a=-Math.PI*.84+i*Math.PI*1.68/5;
    const x=f.cx+Math.cos(a)*(f.rx-52),y=f.cy+Math.sin(a)*(f.ry-38);
    if(f.bridges.some(b=>Math.hypot(x-b.x,y-b.y)<175))continue;
    points.push({x,y});
  }
  return points;
}

// Cache key includes asset readiness so an image arriving after first paint replaces the fallback.
export function drawParadiseArt(ctx,map,f){
  const moon=map.theme==='moon-paradise',sun=map.theme==='sun-paradise';
  const crossroads=map.id==='moon-garden';
  ctx.save();ctx.beginPath();ctx.moveTo(f.points[0].x,f.points[0].y);for(const p of f.points.slice(1))ctx.lineTo(p.x,p.y);ctx.closePath();ctx.clip();
  const paving=images.paradisePaving;
  if(ready(paving)){
    const pattern=ctx.createPattern(paving,'repeat');
    if(pattern){pattern.setTransform(new DOMMatrix().scale(.3));ctx.globalAlpha=.9;ctx.fillStyle=pattern;ctx.fillRect(0,0,map.width,map.height);ctx.globalAlpha=1;}
  }else{
    const g=ctx.createLinearGradient(f.cx-f.rx,f.cy-f.ry,f.cx+f.rx,f.cy+f.ry);
    g.addColorStop(0,moon?'#f1f0f5':sun?'#f8f0e5':'#f2edf4');g.addColorStop(1,moon?'#d4d9e9':sun?'#e7d5c0':'#dcd5e5');ctx.fillStyle=g;ctx.fillRect(0,0,map.width,map.height);
  }
  if(map.theme==='star-paradise'){
    const blend=ctx.createLinearGradient(f.cx-f.rx,0,f.cx+f.rx,0);blend.addColorStop(0,'#f4dfb822');blend.addColorStop(.5,'#ffffff00');blend.addColorStop(1,'#c9d8f422');
    ctx.fillStyle=blend;ctx.fillRect(0,0,map.width,map.height);
  }
  {
    const points=bedPoints(f);for(let i=0;i<points.length;i++)gardenBed(ctx,points[i].x,points[i].y,crossroads?38:34,crossroads?18:16,moon?'#adb9aa':sun?'#b4c19a':'#b7c5a9');
  }
  ctx.restore();
}

// 천체는 바닥에 잘리지 않도록 배경에 한 번만 그립니다.
export function drawParadiseBackdrop(ctx,map){
  const moon=map.theme==='moon-paradise',sun=map.theme==='sun-paradise';
  ctx.fillStyle=moon?'#8995bd':sun?'#d6b4b1':'#9997bb';ctx.fillRect(0,0,map.width,map.height);
  if(ready(images.sky))ctx.drawImage(images.sky,0,0,map.width,map.height);
  ctx.fillStyle=sun?'#f8d4a37a':moon?'#aebee435':'#d8c5e42e';ctx.fillRect(0,0,map.width,map.height);
  const bodies=map.vista?[[map.vista,moon]]:map.theme==='star-paradise'?[[{bodyX:220,bodyY:180,bodyRadius:145},false],[{bodyX:1580,bodyY:960,bodyRadius:155},true]]:[];
  for(const [v,isMoon] of bodies){const im=isMoon?images.moon:images.sun;if(ready(im))ctx.drawImage(im,v.bodyX-v.bodyRadius,v.bodyY-v.bodyRadius,v.bodyRadius*2,v.bodyRadius*2);else fallbackBody(ctx,{vista:v},isMoon);}
}
