import {mapImage,mapImageReady,decodeMapImages} from './map-image.js';
import {visualGateFloor} from './visual-floor.js';
import {originFloor} from '/shared/origin-floor.js';
import {drawStoneRim,rimEdges} from './stone-rim.js';
import {drawFloatingIslands,drawRockSupports,onFloatingCliffReady} from './floating-island.js';

const image=mapImage('/assets/maps/origin-starlight.png',()=>{revision++;for(const fn of listeners)fn();});
let revision=0;
const listeners=new Set();
onFloatingCliffReady(()=>{revision++;for(const fn of listeners)fn();});

const ready=()=>mapImageReady(image);
const templeImage=mapImage('/assets/maps/plaza-temple.png',()=>{revision++;for(const fn of listeners)fn();});

const statueImage=mapImage('/assets/maps/star-goddess-statue.png',()=>{revision++;for(const fn of listeners)fn();});

// 일반 보스의 약384px 높이에 맞춥니다. 세로 원화 비율을 보존하고 받침대를 신전 중앙에 세웁니다.
// 받침대의 바닥 접촉면 중앙(하단 모서리보다 위)을 오브젝트/제단 중심에 맞춥니다.
export const ORIGIN_STATUE_RENDER=Object.freeze({width:256,footY:1390/1536});
export const originArtCacheKey=()=>revision;
export async function preloadOriginArt(){await decodeMapImages([image,templeImage,statueImage,pavingImage]);}
export function onOriginArtReady(fn){listeners.add(fn);return()=>listeners.delete(fn);}

function pathFor(floor){const path=new Path2D();path.moveTo(floor.points[0].x,floor.points[0].y);for(const p of floor.points.slice(1))path.lineTo(p.x,p.y);path.closePath();return path;}
export function drawOriginArt(ctx,map){
  const f=visualGateFloor(originFloor(map),map);if(!f)return;
  if(ready())ctx.drawImage(image,0,0,map.width,map.height);
  else{
    ctx.fillStyle='#10172d';ctx.fillRect(0,0,map.width,map.height);
    for(let i=0;i<7;i++){
      const x=(i*617+103)%map.width,y=(i*379+71)%map.height,r=Math.min(map.width,map.height)*(.2+i%3*.07);
      const g=ctx.createRadialGradient(x,y,0,x,y,r);g.addColorStop(0,['#5b68b866','#ad74bd55','#76a8c766'][i%3]);g.addColorStop(1,'#17213e00');ctx.fillStyle=g;ctx.fillRect(x-r,y-r,r*2,r*2);
    }
  }
  const path=pathFor(f);
  drawRockSupports(ctx,rimEdges(f.points),'origin',map.height);
  drawFloatingIslands(ctx,[{x:f.cx,y:f.cy,rx:f.rx,ry:f.ry}],'origin',map.height);
  ctx.save();ctx.translate(0,Math.max(3,map.height*.008));ctx.fillStyle='#10172c99';ctx.shadowColor='#03061199';ctx.shadowBlur=24;ctx.fill(path);ctx.restore();
  ctx.save();ctx.clip(path);ctx.fillStyle='#c9c7de';ctx.fillRect(0,0,map.width,map.height);
  if(mapImageReady(pavingImage)){const pattern=ctx.createPattern(pavingImage,'repeat');if(pattern){pattern.setTransform(new DOMMatrix().scale(.3));ctx.fillStyle=pattern;ctx.globalAlpha=.92;ctx.fillRect(0,0,map.width,map.height);}}
  else{const g=ctx.createLinearGradient(f.cx-f.rx,f.cy-f.ry,f.cx+f.rx,f.cy+f.ry);g.addColorStop(0,'#eeeaf4');g.addColorStop(1,'#aaa9c9');ctx.fillStyle=g;ctx.fillRect(0,0,map.width,map.height);}
  const wash=ctx.createLinearGradient(0,0,map.width,map.height);wash.addColorStop(0,'#e9d9ff22');wash.addColorStop(.5,'#ffffff00');wash.addColorStop(1,'#a9ddff30');ctx.fillStyle=wash;ctx.fillRect(0,0,map.width,map.height);ctx.restore();
  if(map.id==='star-origin-4'){
    const cx=map.width/2,cy=map.height/2;
    // 광장 신전 바닥 원화(720×480)를 각 변 40% 키운 같은 비율로 재사용합니다.
    if(mapImageReady(templeImage))ctx.drawImage(templeImage,cx-504,cy-336,1008,672);
  }
  drawStoneRim(ctx,rimEdges(f.points),'moon');
}
// 석상은 고정 배경에 합성하지 않고 플린스 발 좌표를 기준으로 월드 깊이 레이어에서 그립니다.
export function drawOriginStatue(ctx,map){
  if(map?.id!=='star-origin-4'||!mapImageReady(statueImage))return false;
  const statue=map.objects.find(o=>o.kind==='goddess-statue');if(!statue)return false;
  const width=ORIGIN_STATUE_RENDER.width,height=width*statueImage.naturalHeight/statueImage.naturalWidth;
  ctx.drawImage(statueImage,statue.x-width/2,statue.y-height*ORIGIN_STATUE_RENDER.footY,width,height);
  return true;
}
const pavingImage=mapImage('/assets/maps/plaza-paving.png',()=>{revision++;for(const fn of listeners)fn();});


export function drawOriginMiniFloor(ctx,map){
  const f=visualGateFloor(originFloor(map),map);if(!f)return;
  drawRockSupports(ctx,rimEdges(f.points),'origin',map.height);
  drawFloatingIslands(ctx,[{x:f.cx,y:f.cy,rx:f.rx,ry:f.ry}],'origin',map.height);
  const path=pathFor(f);ctx.fillStyle='#484968';ctx.fill(path);ctx.fillStyle='#d2cfe4';ctx.save();ctx.clip(path);ctx.fillRect(0,0,map.width,map.height);ctx.restore();
  ctx.strokeStyle='#8883a655';ctx.lineWidth=7;ctx.lineJoin='round';ctx.stroke(path);
}
