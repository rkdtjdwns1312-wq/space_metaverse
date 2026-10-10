import {originFloor} from '/shared/origin-floor.js';
import {drawStoneRim,rimEdges} from './stone-rim.js';
import {drawFloatingIslands} from './floating-island.js';

const image=typeof Image==='undefined'?null:new Image();
let revision=0;
const listeners=new Set();
if(image){image.onload=()=>{revision++;for(const fn of listeners)fn();};image.src='/assets/maps/origin-starlight.png';}
const ready=()=>!!image?.complete&&image.naturalWidth>0;
export const originArtCacheKey=()=>revision;
export function onOriginArtReady(fn){listeners.add(fn);return()=>listeners.delete(fn);}

function pathFor(floor){const path=new Path2D();path.moveTo(floor.points[0].x,floor.points[0].y);for(const p of floor.points.slice(1))path.lineTo(p.x,p.y);path.closePath();return path;}
export function drawOriginArt(ctx,map){
  const f=originFloor(map);if(!f)return;
  if(ready())ctx.drawImage(image,0,0,map.width,map.height);
  else{
    ctx.fillStyle='#10172d';ctx.fillRect(0,0,map.width,map.height);
    for(let i=0;i<7;i++){
      const x=(i*617+103)%map.width,y=(i*379+71)%map.height,r=Math.min(map.width,map.height)*(.2+i%3*.07);
      const g=ctx.createRadialGradient(x,y,0,x,y,r);g.addColorStop(0,['#5b68b866','#ad74bd55','#76a8c766'][i%3]);g.addColorStop(1,'#17213e00');ctx.fillStyle=g;ctx.fillRect(x-r,y-r,r*2,r*2);
    }
  }
  const path=pathFor(f);
  drawFloatingIslands(ctx,[{x:f.cx,y:f.cy,rx:f.rx,ry:f.ry}],'moon',map.height);
  ctx.save();ctx.translate(0,Math.max(3,map.height*.008));ctx.fillStyle='#10172c99';ctx.shadowColor='#03061199';ctx.shadowBlur=24;ctx.fill(path);ctx.restore();
  ctx.save();ctx.clip(path);ctx.fillStyle='#c9c7de';ctx.fillRect(0,0,map.width,map.height);
  if(pavingImage?.complete&&pavingImage.naturalWidth){const pattern=ctx.createPattern(pavingImage,'repeat');if(pattern){pattern.setTransform(new DOMMatrix().scale(.3));ctx.fillStyle=pattern;ctx.globalAlpha=.92;ctx.fillRect(0,0,map.width,map.height);}}
  else{const g=ctx.createLinearGradient(f.cx-f.rx,f.cy-f.ry,f.cx+f.rx,f.cy+f.ry);g.addColorStop(0,'#eeeaf4');g.addColorStop(1,'#aaa9c9');ctx.fillStyle=g;ctx.fillRect(0,0,map.width,map.height);}
  const wash=ctx.createLinearGradient(0,0,map.width,map.height);wash.addColorStop(0,'#e9d9ff22');wash.addColorStop(.5,'#ffffff00');wash.addColorStop(1,'#a9ddff30');ctx.fillStyle=wash;ctx.fillRect(0,0,map.width,map.height);ctx.restore();
  drawStoneRim(ctx,rimEdges(f.points),'moon');
}
const pavingImage=typeof Image==='undefined'?null:new Image();
if(pavingImage){pavingImage.onload=()=>{revision++;for(const fn of listeners)fn();};pavingImage.src='/assets/maps/plaza-paving.png';}

export function drawOriginMiniFloor(ctx,map){
  const f=originFloor(map);if(!f)return;
  drawFloatingIslands(ctx,[{x:f.cx,y:f.cy,rx:f.rx,ry:f.ry}],'moon',map.height);
  const path=pathFor(f);ctx.fillStyle='#484968';ctx.fill(path);ctx.fillStyle='#d2cfe4';ctx.save();ctx.clip(path);ctx.fillRect(0,0,map.width,map.height);ctx.restore();
  ctx.strokeStyle='#8883a655';ctx.lineWidth=7;ctx.lineJoin='round';ctx.stroke(path);
}
