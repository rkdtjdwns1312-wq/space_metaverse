import {mapImage,mapImageReady,decodeMapImages} from './map-image.js';
// 공유 보행면 아래에만 그리는 손그림 암벽. 바닥 좌표·경계·이동 판정에는 관여하지 않습니다.
const THEMES={
  plaza:{shell:['#eee5ec','#afa9c2','#61668d'],light:'#fff9ed',dark:'#494f77',seam:'#d6c8eb',core:'#f7d9a0'},
  shelter:{shell:['#f7dce9','#bdaecf','#737baf'],light:'#fff4df',dark:'#605b8c',seam:'#bdf3ed',core:'#f8c9eb'},
  valley:{shell:['#d3dff2','#829ec6','#415a92'],light:'#f1f4ff',dark:'#344b78',seam:'#b5e1ff',core:'#d1d4ff'},
  evolution:{shell:['#e7e8f5','#9cb4dc','#526caa'],light:'#f9f6ff',dark:'#3e5386',seam:'#c5d9ff',core:'#b6e6ff'},
  growth:{shell:['#f8e6c8','#d1b58f','#8b7783'],light:'#fff5e0',dark:'#786274',seam:'#ffe2a9',core:'#ffcf88'},
  crossroads:{shell:['#ece2ef','#baabc9','#71749f'],light:'#fff8ed',dark:'#555c86',seam:'#d5cafa',core:'#d4e9ff'},
  moon:{shell:['#e2e9f6','#9ab2d2','#506b9b'],light:'#f6f7ff',dark:'#425884',seam:'#bde2ff',core:'#b0d5ff'},
  sun:{shell:['#fae5c4','#d8ae7e','#95737d'],light:'#fff6dc',dark:'#785f6d',seam:'#ffe0a3',core:'#ffd084'},
  starland:{shell:['#f8e5cc','#bbaec8','#637fb0'],light:'#fff9ec',dark:'#50577d',seam:'#dfd7ff',core:'#d8ddff'},
  origin:{shell:['#c6cde6','#798dba','#384f87'],light:'#edf1ff',dark:'#2c3b70',seam:'#b5c9ff',core:'#a9b9fa'}
};
// 한 원화를 공유하고 로드 완료 시 모든 배경·타일·축소판 캐시를 깨웁니다.
export const FLOATING_CLIFF_SRC='/assets/floating-cliff-painted.png';
const listeners=new Set();
const cliff=mapImage(FLOATING_CLIFF_SRC,()=>{revision++;for(const fn of listeners)fn();});
let revision=0;
export const floatingCliffCacheKey=()=>revision;
export const floatingCliffReady=()=>mapImageReady(cliff);
export function onFloatingCliffReady(fn){listeners.add(fn);return()=>listeners.delete(fn);}
export async function preloadFloatingCliff(){try{await decodeMapImages([cliff]);return !!cliff;}catch{return false;}}
const clamp=(v,min,max)=>Math.max(min,Math.min(max,v));
const noise=(x,seed)=>Math.sin(x*7.3+seed)*.45+Math.sin(x*19.1-seed*2)*.32+Math.sin(x*43.7+seed)*.23;
const topY=(z,u)=>z.y+z.ry*Math.sqrt(Math.max(0,1-u*u));
function lowerY(z,u,depth,seed){
  return topY(z,u)+depth*Math.pow(Math.max(0,1-Math.abs(u)),.43)*(.74+.18*noise(u,seed));
}
function rockPath(z,depth,seed){
  const path=new Path2D();
  for(let i=0;i<=96;i++){const u=-1+i/48,x=z.x+z.rx*u,y=topY(z,u);if(i)path.lineTo(x,y);else path.moveTo(x,y);}
  for(let i=96;i>=0;i--){const u=-1+i/48;path.lineTo(z.x+z.rx*u,lowerY(z,u,depth,seed));}
  path.closePath();return path;
}
function layeredRock(ctx,z,depth,theme,seed){
  const shape=rockPath(z,depth,seed),base=z.y+z.ry;
  ctx.save();
  const shade=ctx.createLinearGradient(z.x-z.rx*.4,z.y+z.ry*.5,z.x+z.rx*.3,base+depth);
  shade.addColorStop(0,theme.shell[1]);shade.addColorStop(.48,theme.shell[2]);shade.addColorStop(1,theme.dark);
  ctx.fillStyle=shade;ctx.shadowColor=theme.dark+'70';ctx.shadowBlur=12;ctx.shadowOffsetY=9;ctx.fill(shape);
  ctx.shadowBlur=0;ctx.shadowOffsetY=0;ctx.clip(shape);
  if(floatingCliffReady()){
    // 비율을 보존한 원화를 실루엣에만 자릅니다. 열별 워핑은 균열을 세로로 찢으므로 하지 않습니다.
    const pattern=ctx.createPattern(cliff,'repeat');
    pattern.setTransform(new DOMMatrix().translate(z.x-z.rx-Math.abs(seed*37)%180,z.y-80).scale(.52));
    ctx.fillStyle=pattern;ctx.fill(shape);
    const shadow=ctx.createLinearGradient(0,z.y,0,base+depth);
    shadow.addColorStop(0,theme.light+'12');shadow.addColorStop(.65,theme.dark+'08');shadow.addColorStop(1,theme.dark+'80');
    ctx.fillStyle=shadow;ctx.fill(shape);
    ctx.globalCompositeOperation='soft-light';ctx.fillStyle=theme.shell[1]+'70';ctx.fill(shape);ctx.globalCompositeOperation='source-over';
  }
  // 넓고 불규칙한 명암만 더해 원화의 균열·붓터치를 그대로 살립니다.
  for(let i=0;i<13;i++){
    const u=-.92+i*.15+noise(i,seed)*.025,x=z.x+z.rx*u,y=topY(z,u)+depth*(.3+.2*noise(i,seed));
    const radius=depth*(.3+.13*(1+noise(i+3,seed))),glow=ctx.createRadialGradient(x,y,0,x,y,radius);
    glow.addColorStop(0,(i%3?theme.dark:theme.light)+(i%3?'32':'28'));glow.addColorStop(1,theme.dark+'00');
    ctx.fillStyle=glow;ctx.fillRect(x-radius,y-radius,radius*2,radius*2);
  }
  ctx.restore();
}
// 다리의 실제 union 외곽선을 그대로 받치는 돌 단면. 양 끝을 18px 겹쳐
// 섬 밑으로 묻고, 위에서 보행면을 덮어 그려 연결부의 틈을 없앱니다.
export function drawRockSupports(ctx,edges,themeName='plaza',bottom=Infinity){
  const theme=THEMES[themeName]||THEMES.plaza;
  ctx.save();
  for(const [a,b] of edges){
    const length=Math.hypot(b.x-a.x,b.y-a.y);if(length<64)continue;
    const dx=(b.x-a.x)/length,dy=(b.y-a.y)/length,overlap=18;
    const start={x:a.x-dx*overlap,y:a.y-dy*overlap},end={x:b.x+dx*overlap,y:b.y+dy*overlap};
    const depth=Math.min(72,Math.max(24,length*.12),bottom-Math.max(start.y,end.y)-4);if(depth<4)continue;
    const seed=a.x*.013+a.y*.017;
    const shape=new Path2D();shape.moveTo(start.x,start.y);shape.lineTo(end.x,end.y);
    const pieces=Math.max(3,Math.ceil(length/40));
    for(let i=pieces;i>=0;i--){const t=i/pieces;shape.lineTo(start.x+(end.x-start.x)*t,start.y+(end.y-start.y)*t+depth*(.82+.16*noise(t*2,seed)));}shape.closePath();
    ctx.save();ctx.clip(shape);
    const gradient=ctx.createLinearGradient(0,Math.min(start.y,end.y),0,Math.max(start.y,end.y)+depth);
    gradient.addColorStop(0,theme.shell[1]);gradient.addColorStop(1,theme.dark);ctx.fillStyle=gradient;ctx.fill(shape);
    if(floatingCliffReady()){
      const pattern=ctx.createPattern(cliff,'repeat');
      pattern.setTransform(new DOMMatrix().translate(seed*11,seed*7).scale(.34));
      ctx.fillStyle=pattern;ctx.fill(shape);
      ctx.globalCompositeOperation='multiply';ctx.globalAlpha=.3;ctx.fillStyle=gradient;ctx.fill(shape);
      ctx.globalCompositeOperation='soft-light';ctx.globalAlpha=.35;ctx.fillStyle=theme.shell[1];ctx.fill(shape);ctx.globalAlpha=1;
    }
    ctx.restore();
  }
  ctx.restore();
}
export function drawFloatingIslands(ctx,zones,themeName='plaza',bottom=Infinity){
  const theme=THEMES[themeName]||THEMES.plaza;
  for(const z of zones){
    if(!z||!Number.isFinite(z.rx)||!Number.isFinite(z.ry))continue;
    const depth=Math.min(clamp(z.ry*.68,70,260),bottom-(z.y+z.ry)-10);if(depth<10)continue;
    layeredRock(ctx,z,depth,theme,z.x*.0013+z.y*.0037+z.rx*.0009);
  }
}
