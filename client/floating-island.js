// 보행면 아래에만 그리는 별빛 부양대. 충돌·이동 가능한 바닥은 공유 지형 그대로입니다.
// 도시의 철판 대신 둥근 신전과 어울리는 세라믹 장갑·마법 동력핵으로 해석합니다.
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
const clamp=(v,min,max)=>Math.max(min,Math.min(max,v));
const topY=(z,u)=>z.y+z.ry*Math.sqrt(Math.max(0,1-u*u));
// 윗면의 타원에 맞춘 넓고 굴곡진 아랫면. 한 꼭짓점으로 모이지 않습니다.
function lowerY(z,u,depth,seed){
  const span=Math.pow(Math.max(0,1-Math.abs(u)),.56);
  const plate=.64+.13*Math.cos(u*3.2)+.035*Math.sin(u*19+seed);
  return topY(z,u)+depth*span*plate;
}
function shellPath(z,depth,seed){
  const path=new Path2D();
  for(let i=0;i<=64;i++){
    const u=-1+i/32,x=z.x+z.rx*u,y=topY(z,u);
    if(i===0)path.moveTo(x,y);else path.lineTo(x,y);
  }
  for(let i=64;i>=0;i--){const u=-1+i/32;path.lineTo(z.x+z.rx*u,lowerY(z,u,depth,seed));}
  path.closePath();return path;
}
function facetedShell(ctx,z,depth,theme,seed){
  const path=shellPath(z,depth,seed),base=z.y+z.ry;
  ctx.save();
  const g=ctx.createLinearGradient(z.x-z.rx*.42,z.y+z.ry*.45,z.x+z.rx*.35,base+depth);
  g.addColorStop(0,theme.shell[0]);g.addColorStop(.45,theme.shell[1]);g.addColorStop(1,theme.shell[2]);
  ctx.fillStyle=g;ctx.shadowColor=theme.dark+'a0';ctx.shadowBlur=21;ctx.shadowOffsetY=11;ctx.fill(path);
  ctx.shadowBlur=0;ctx.shadowOffsetY=0;ctx.clip(path);
  // 아래쪽 판이 살짝 접혀 보이도록 길이가 다른 곡면 장갑을 겹칩니다.
  for(let i=0;i<12;i++){
    const a=-1+i/6,b=a+1/6,x0=z.x+a*z.rx,x1=z.x+b*z.rx;
    const top0=topY(z,a),top1=topY(z,b),bot0=lowerY(z,a,depth,seed),bot1=lowerY(z,b,depth,seed);
    ctx.beginPath();ctx.moveTo(x0,top0);ctx.quadraticCurveTo((x0+x1)/2,(top0+top1)/2+4,x1,top1);
    ctx.lineTo(x1,bot1);ctx.quadraticCurveTo((x0+x1)/2,(bot0+bot1)/2-6,x0,bot0);ctx.closePath();
    ctx.fillStyle=i%3===0?theme.light+'2b':i%3===1?theme.dark+'27':theme.seam+'1e';ctx.fill();
    if(i){ctx.strokeStyle=theme.dark+'6d';ctx.lineWidth=Math.max(1.5,z.rx*.0025);
      ctx.beginPath();ctx.moveTo(x0,top0+8);ctx.quadraticCurveTo(x0-8,(top0+bot0)/2,x0,bot0);ctx.stroke();
      ctx.strokeStyle=theme.seam+'a8';ctx.lineWidth=Math.max(1,z.rx*.0018);
      ctx.beginPath();ctx.moveTo(x0+4,top0+10);ctx.quadraticCurveTo(x0-4,(top0+bot0)/2,x0+3,bot0-5);ctx.stroke();}
  }
  // 떠 있는 섬의 갑판 아래, 얇은 빛띠가 외곽의 형상을 따라 흐릅니다.
  ctx.beginPath();
  for(let i=0;i<=64;i++){
    const u=-1+i/32,x=z.x+u*z.rx,y=topY(z,u)+Math.min(18,depth*.15);
    if(i===0)ctx.moveTo(x,y);else ctx.lineTo(x,y);
  }
  ctx.strokeStyle=theme.dark+'8e';ctx.lineWidth=Math.max(7,z.rx*.016);ctx.stroke();
  ctx.shadowColor=theme.seam;ctx.shadowBlur=13;ctx.strokeStyle=theme.seam+'cf';
  ctx.lineWidth=Math.max(2,z.rx*.004);ctx.stroke();ctx.shadowBlur=0;
  // 판 가장자리의 작은 광점은 회화적 배경을 가리지 않을 만큼만 둡니다.
  for(let i=0;i<16;i++){
    const u=-.88+i*1.76/15,x=z.x+u*z.rx,y=topY(z,u)+Math.min(18,depth*.15);
    ctx.fillStyle=theme.light+'c9';ctx.beginPath();ctx.arc(x,y,clamp(z.rx*.003,1.3,3),0,Math.PI*2);ctx.fill();
  }
  ctx.restore();
}
function suspendedCore(ctx,z,depth,theme,seed,bottom){
  const base=z.y+z.ry;
  // 넓은 장갑 아래로 매달린 여러 개의 수정 동력핵. 한 장짜리 역삼각형과 구별됩니다.
  for(let i=-2;i<=2;i++){
    const u=i*.16,x=z.x+u*z.rx,top=lowerY(z,u,depth,seed)-depth*.08;
    const length=depth*(i===0?.19:Math.abs(i)===1?.12:.07);
    const end=clamp(top+length,top+4,bottom-6),w=clamp(z.rx*(i===0?.065:.038),8,48);
    if(end<=top+4)continue;
    const g=ctx.createLinearGradient(x-w,top,x+w,end);
    g.addColorStop(0,theme.light+'c0');g.addColorStop(.45,theme.shell[1]+'e8');g.addColorStop(1,theme.dark+'bd');
    ctx.fillStyle=g;ctx.beginPath();ctx.moveTo(x-w,top);ctx.lineTo(x+w,top+2);
    ctx.lineTo(x+w*.7,top+length*.45);ctx.lineTo(x,end);
    ctx.lineTo(x-w*.7,top+length*.47);ctx.closePath();ctx.fill();
    ctx.strokeStyle=theme.seam+'9e';ctx.lineWidth=Math.max(1,z.rx*.002);
    ctx.beginPath();ctx.moveTo(x-w*.65,top+3);ctx.lineTo(x,end-3);ctx.stroke();
  }
  const coreY=Math.min(base+depth*.78,bottom-14),coreR=clamp(z.rx*.07,12,48);
  const glow=ctx.createRadialGradient(z.x,coreY,0,z.x,coreY,coreR*2.2);
  glow.addColorStop(0,theme.core+'c0');glow.addColorStop(.45,theme.core+'49');glow.addColorStop(1,theme.core+'00');
  ctx.fillStyle=glow;ctx.beginPath();ctx.ellipse(z.x,coreY,coreR*2.2,coreR*1.3,0,0,Math.PI*2);ctx.fill();
  ctx.fillStyle=theme.light+'dd';ctx.beginPath();ctx.ellipse(z.x,coreY,coreR*.28,coreR*.22,0,0,Math.PI*2);ctx.fill();
}
export function drawFloatingIslands(ctx,zones,themeName='plaza',bottom=Infinity){
  const theme=THEMES[themeName]||THEMES.plaza;
  ctx.save();
  for(const z of zones){
    if(!z||!Number.isFinite(z.rx)||!Number.isFinite(z.ry))continue;
    const available=bottom-(z.y+z.ry)-14;
    const depth=Math.min(Math.max(70,z.ry*.7),260,available);
    if(depth<10)continue;
    const seed=z.x*.0013+z.y*.0037+z.rx*.0009;
    facetedShell(ctx,z,depth,theme,seed);
    suspendedCore(ctx,z,depth,theme,seed,bottom);
  }
  ctx.restore();
}
