// 그림 안에 글씨를 굽지 않고 공통 게임 글꼴로 간판을 얹습니다.
export const PAINTED_PROPS=Object.freeze({
  shop:{file:'star-shop-front.png',width:300,height:300,foot:70,signY:.35,signWidth:.34},
  'energy-shop':{file:'energy-shop-front.png',width:290,height:310,foot:75,signY:.455,signWidth:.34},
  crafting:{file:'crafting-front.png',width:245,height:280,foot:70,signY:.59,signWidth:.34},
  arcade:{file:'arcade-front.png',width:110,height:155,foot:42},
});
const images=new Map();
for(const [key,entry] of Object.entries(PAINTED_PROPS))if(typeof Image!=='undefined'){
  const image=new Image();image.src='/assets/maps/'+entry.file;images.set(key,image);
}
export async function preloadPaintedProps(){await Promise.all([...images.values()].map(image=>image.decode()));}
export function drawPaintedProp(ctx,o){
  const spec=PAINTED_PROPS[o.kind],image=images.get(o.kind);
  if(!spec||!image?.complete||!image.naturalWidth)return false;
  const scale=Math.min(spec.width/image.naturalWidth,spec.height/image.naturalHeight);
  const w=image.naturalWidth*scale,h=image.naturalHeight*scale,x=o.x-w/2,y=o.y+spec.foot-h;
  ctx.save();ctx.drawImage(image,x,y,w,h);ctx.textAlign='center';ctx.textBaseline='middle';
  ctx.font='19px "Jua","Malgun Gothic",sans-serif';ctx.fillStyle='#5d4e74';
  if(spec.signY){
    const text=o.name||({shop:'별 상점','energy-shop':'우주에너지 상점',crafting:'별빛 조합기'}[o.kind]);
    const sy=y+h*spec.signY,sw=Math.max(w*spec.signWidth,ctx.measureText(text).width+26),sh=35;
    // 글자를 눌러 줄이지 않고 이름에 맞춰 실제 간판의 폭을 넓힙니다.
    const panel=ctx.createLinearGradient(0,sy-sh/2,0,sy+sh/2);panel.addColorStop(0,'#fffdf3');panel.addColorStop(1,'#f3e4c9');
    ctx.fillStyle=panel;ctx.strokeStyle=o.kind==='energy-shop'?'#79b3d2':'#bf9b57';ctx.lineWidth=2.5;
    ctx.beginPath();ctx.roundRect(o.x-sw/2,sy-sh/2,sw,sh,9);ctx.fill();ctx.stroke();
    ctx.fillStyle='#5d4e74';ctx.fillText(text,o.x,sy+1);
  }
  if(o.kind==='arcade'){
    ctx.fillStyle='#65517d';ctx.font='20px "Jua",sans-serif';
    ctx.fillText(({memory:'▦',baseball:'⚾',stars:'★',sudoku:'1·9',dodge:'☄',path:'✧',signal:'◇'})[o.gameId]||'★',o.x,y+h*.385);
    ctx.font='16px "Jua","Malgun Gothic",sans-serif';ctx.strokeStyle='#fffaf4';ctx.lineWidth=4;ctx.lineJoin='round';
    ctx.strokeText(o.name,o.x,o.y+62);ctx.fillText(o.name,o.x,o.y+62);
  }
  ctx.restore();return true;
}
