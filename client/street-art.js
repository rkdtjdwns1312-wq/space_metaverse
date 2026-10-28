import {mapImage,mapImageReady,decodeMapImages} from './map-image.js';
import {visualFloor,visualFloorPath} from './visual-floor.js';
import {STREET_LAYOUT,STREET_POLYGONS,STREET_EDGES} from '/shared/street-layout.js';
import {drawStoneRim} from './stone-rim.js';
import {drawStreetPark} from './street-park-art.js';
import {drawFloatingIslands,drawRockSupports,onFloatingCliffReady} from './floating-island.js';

export const STREET_BACKDROP_SRC='/assets/maps/starlight-street.png';
export const STREET_ROUTE_LABELS=Object.freeze([
  {text:'별 발전소 가는길',x:STREET_LAYOUT.upper.x,y:Math.round((STREET_LAYOUT.north.y+STREET_LAYOUT.north.ry+STREET_LAYOUT.upper.y-STREET_LAYOUT.upper.ry)/2)},
  {text:'놀이터 가는길',x:STREET_LAYOUT.upper.x,y:Math.round((STREET_LAYOUT.upper.y+STREET_LAYOUT.upper.ry+STREET_LAYOUT.lower.y-STREET_LAYOUT.lower.ry)/2)}
]);
const images={};let revision=0;
const listeners=new Set(),tiles=new Map();
onFloatingCliffReady(()=>{revision++;tiles.clear();for(const fn of listeners)fn();});
for(const [key,src] of Object.entries({backdrop:STREET_BACKDROP_SRC,paving:'/assets/maps/plaza-paving.png',fountain:'/assets/maps/shelter-fountain-v2.webp',flowerbed:'/assets/maps/shelter-flowerbed-v2.webp'})){
  images[key]=mapImage(src,()=>{revision++;tiles.clear();for(const fn of listeners)fn();});
}
const ready=key=>mapImageReady(images[key]);
export const streetArtCacheKey=()=>revision;
export function onStreetArtReady(fn){listeners.add(fn);return()=>listeners.delete(fn);}
export async function preloadStreetArt(){await decodeMapImages(Object.values(images));}

const visual=visualFloor(STREET_POLYGONS,STREET_EDGES,STREET_LAYOUT,[STREET_LAYOUT.westGate]);
const shape=visualFloorPath(visual.polygons);
const edgePath=new Path2D();for(const [a,b] of visual.edges){edgePath.moveTo(a.x,a.y);edgePath.lineTo(b.x,b.y);}
function backdrop(ctx,map){
  if(ready('backdrop'))ctx.drawImage(images.backdrop,0,0,map.width,map.height);
  else{
    const g=ctx.createLinearGradient(0,0,map.width,map.height);g.addColorStop(0,'#ffd9e9');g.addColorStop(.45,'#c9e9ff');g.addColorStop(1,'#f9e2b9');ctx.fillStyle=g;ctx.fillRect(0,0,map.width,map.height);
    for(let i=0;i<9;i++){
      const x=(i*487+180)%map.width,y=(i*337+90)%map.height,r=190+i%3*75;
      const glow=ctx.createRadialGradient(x,y,0,x,y,r);glow.addColorStop(0,['#fff5a966','#ffaed855','#9ce8dc66'][i%3]);glow.addColorStop(1,'#ffffff00');ctx.fillStyle=glow;ctx.fillRect(x-r,y-r,r*2,r*2);
    }
  }
}
function routeLabel(ctx){
  ctx.save();ctx.font='26px "Jua","Malgun Gothic",sans-serif';ctx.textAlign='center';ctx.textBaseline='middle';ctx.lineJoin='round';ctx.lineWidth=6;ctx.strokeStyle='#fffaf4';ctx.fillStyle='#7650a8';
  for(const label of STREET_ROUTE_LABELS){ctx.strokeText(label.text,label.x,label.y);ctx.fillText(label.text,label.x,label.y);}
  ctx.restore();
}
function paint(ctx,map){
  backdrop(ctx,map);
  drawRockSupports(ctx,visual.edges,'shelter',map.height);
  drawFloatingIslands(ctx,[STREET_LAYOUT.north,STREET_LAYOUT.upper,STREET_LAYOUT.lower],'shelter',map.height);
  ctx.save();ctx.translate(0,12);ctx.fillStyle='#34304d88';ctx.shadowColor='#25243b77';ctx.shadowBlur=28;ctx.shadowOffsetY=14;ctx.fill(shape);ctx.restore();
  ctx.save();ctx.clip(shape);ctx.fillStyle='#eee8f4';ctx.fillRect(0,0,map.width,map.height);
  if(ready('paving')){const pattern=ctx.createPattern(images.paving,'repeat');if(pattern){pattern.setTransform(new DOMMatrix().scale(.3));ctx.globalAlpha=.88;ctx.fillStyle=pattern;ctx.fillRect(0,0,map.width,map.height);ctx.globalAlpha=1;}}
  const wash=ctx.createLinearGradient(STREET_LAYOUT.upper.x-STREET_LAYOUT.upper.rx,0,STREET_LAYOUT.upper.x+STREET_LAYOUT.upper.rx,map.height);
  wash.addColorStop(0,'#ffd8eb30');wash.addColorStop(.5,'#fff6dc18');wash.addColorStop(1,'#bde6ff3d');ctx.fillStyle=wash;ctx.fillRect(0,0,map.width,map.height);ctx.restore();
  drawStoneRim(ctx,visual.edges);
  drawStreetPark(ctx,images.paving,images);
  routeLabel(ctx);
}
export function drawStreetGround(ctx,map){
  let canvas=tiles.get(map.id);
  if(!canvas||canvas.dataset.revision!==String(revision)||canvas.width!==map.width||canvas.height!==map.height){
    canvas=document.createElement('canvas');canvas.width=map.width;canvas.height=map.height;canvas.dataset.revision=String(revision);paint(canvas.getContext('2d'),map);tiles.set(map.id,canvas);
  }
  // Submit only the visible source rectangle instead of the 5.94M-pixel map.
  // One-pixel overscan preserves filtering at the viewport's fractional edges.
  const m=ctx.getTransform();
  if(m.b||m.c||m.a<=0||m.d<=0){ctx.drawImage(canvas,0,0);return;}
  const left=Math.max(0,Math.floor(-m.e/m.a)-1),top=Math.max(0,Math.floor(-m.f/m.d)-1);
  const right=Math.min(canvas.width,Math.ceil((ctx.canvas.width-m.e)/m.a)+1),bottom=Math.min(canvas.height,Math.ceil((ctx.canvas.height-m.f)/m.d)+1);
  if(right>left&&bottom>top)ctx.drawImage(canvas,left,top,right-left,bottom-top,left,top,right-left,bottom-top);
}
export function drawStreetMiniFloor(ctx,map){
  backdrop(ctx,map);drawRockSupports(ctx,visual.edges,'shelter',map.height);drawFloatingIslands(ctx,[STREET_LAYOUT.north,STREET_LAYOUT.upper,STREET_LAYOUT.lower],'shelter',map.height);ctx.fillStyle='#eee8f4';ctx.fill(shape);
  ctx.fillStyle='#d7ddff55';ctx.beginPath();ctx.ellipse(STREET_LAYOUT.north.x,STREET_LAYOUT.north.y,STREET_LAYOUT.north.rx-35,STREET_LAYOUT.north.ry-30,0,0,Math.PI*2);ctx.fill();
  ctx.fillStyle='#ffe0ed55';ctx.beginPath();ctx.ellipse(STREET_LAYOUT.upper.x,STREET_LAYOUT.upper.y,STREET_LAYOUT.upper.rx-42,STREET_LAYOUT.upper.ry-34,0,0,Math.PI*2);ctx.fill();
  ctx.fillStyle='#c9eddf66';ctx.beginPath();ctx.ellipse(STREET_LAYOUT.lower.x,STREET_LAYOUT.lower.y,STREET_LAYOUT.lower.rx-38,STREET_LAYOUT.lower.ry-30,0,0,Math.PI*2);ctx.fill();
  drawStreetPark(ctx,images.paving,images);
  ctx.save();ctx.lineJoin='round';ctx.lineCap='round';ctx.strokeStyle='#a39ab255';ctx.lineWidth=7;ctx.stroke(edgePath);ctx.restore();
}
