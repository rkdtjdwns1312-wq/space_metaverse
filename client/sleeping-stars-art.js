import {mapImage,mapImageReady,decodeMapImages} from './map-image.js';
import {originFloor} from '/shared/origin-floor.js';
import {SLEEPING_STARS_SKY,isSleepingStars} from '/shared/sleeping-stars.js';
import {visualGateFloor} from './visual-floor.js';
import {drawFloatingIslands,drawRockSupports,onFloatingCliffReady} from './floating-island.js';
import {rimEdges} from './stone-rim.js';

const listeners=new Set();let revision=0;
const changed=()=>{revision++;for(const listener of listeners)listener();};
const images=SLEEPING_STARS_SKY.map((_,index)=>mapImage('/assets/maps/sleeping-stars-'+(index+1)+'.webp',changed));
onFloatingCliffReady(changed);
export const sleepingStarsArtCacheKey=()=>revision;
export function onSleepingStarsArtReady(listener){listeners.add(listener);return()=>listeners.delete(listener);}
export async function preloadSleepingStarsArt(map){
  const index=Math.max(0,Math.min(3,Number(map?.stage)-1||0));
  await decodeMapImages([images[index]]);
}

// World, minimap and universe preview share this painting and the server's outline.
export function drawSleepingStarsArt(ctx,map){
  if(!isSleepingStars(map?.id))return;
  const index=map.stage-1,sky=SLEEPING_STARS_SKY[index],floor=visualGateFloor(originFloor(map),map);
  if(!floor)return;
  ctx.save();ctx.fillStyle=sky.background;ctx.fillRect(0,0,map.width,map.height);
  // The same normalized points form a shrinking subset from stage 1 to stage 4.
  // Keeping the sky static makes the silence readable and costs no per-frame work.
  let seed=19781117;
  const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
  for(let i=0;i<sky.stars;i++){
    const x=random()*map.width,y=random()*map.height,r=.55+random()*.9;
    ctx.globalAlpha=sky.brightness*(.50+random()*.5);ctx.fillStyle=i%4?'#d9dde6':'#e9e0ce';
    ctx.beginPath();ctx.arc(x,y,r,0,Math.PI*2);ctx.fill();
  }
  ctx.globalAlpha=1;
  // Reuse the established painted rock silhouette, with muted gray stone here.
  ctx.save();ctx.filter=`grayscale(1) brightness(${.76-index*.08})`;
  drawRockSupports(ctx,rimEdges(floor.points),'origin',map.height);
  drawFloatingIslands(ctx,[{x:floor.cx,y:floor.cy,rx:floor.rx,ry:floor.ry}],'origin',map.height);ctx.restore();
  const path=new Path2D();path.moveTo(floor.points[0].x,floor.points[0].y);
  for(const point of floor.points.slice(1))path.lineTo(point.x,point.y);path.closePath();
  ctx.save();ctx.clip(path);ctx.fillStyle=sky.floor;ctx.fillRect(0,0,map.width,map.height);
  const image=images[index];
  if(mapImageReady(image)){
    const pattern=ctx.createPattern(image,'repeat');
    if(pattern){pattern.setTransform(new DOMMatrix().scale(.65));ctx.fillStyle=pattern;ctx.fillRect(0,0,map.width,map.height);}
  }
  const shade=ctx.createRadialGradient(floor.cx,floor.cy,Math.min(floor.rx,floor.ry)*.3,floor.cx,floor.cy,Math.max(floor.rx,floor.ry));
  shade.addColorStop(0,'#00000000');shade.addColorStop(1,'#00000045');ctx.fillStyle=shade;ctx.fillRect(0,0,map.width,map.height);ctx.restore();
  ctx.strokeStyle='#a2a3ab';ctx.globalAlpha=.15;ctx.lineWidth=5;ctx.lineJoin='round';ctx.stroke(path);ctx.restore();
}
