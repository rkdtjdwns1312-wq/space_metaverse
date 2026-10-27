import {mapImage,mapImageReady,decodeMapImages} from './map-image.js';
// 그림 안에 글씨를 굽지 않고 공통 게임 글꼴로 간판을 얹습니다.
export const PAINTED_PROPS=Object.freeze({
  shop:{file:'star-shop-front.png',width:300,height:300,foot:70,signY:.35,signWidth:.34},
  'energy-shop':{file:'energy-shop-front.png',width:290,height:310,foot:75,signY:.455,signWidth:.34},
  crafting:{file:'crafting-front.png',width:245,height:280,foot:70,signY:.59,signWidth:.34},
  arcade:{file:'arcade-front.png',width:110,height:155,foot:42},
  'math-station':{file:'math-station-front.png',width:330,height:330,foot:80,signY:.45,signWidth:.44},
  'english-station':{file:'english-station-front.png',width:330,height:330,foot:80,signY:.505,signWidth:.44,signInk:'#435d93'},
  // 작은 원화의 투명 여백만 덜어 내어 수학 발전소와 비슷한 실제 건물 크기로 그립니다.
  // foot은 기존 그림의 보이는 바닥선에 맞춘 값이며 월드 좌표와 충돌 범위는 그대로입니다.
  'history-station':{file:'history-station-front.png',width:330,height:330,foot:55,source:{x:25,y:13,width:285,height:294},signY:.51,signInk:'#76516c'},
  'science-station':{file:'science-station-front.png',width:330,height:330,foot:60,source:{x:16,y:19,width:301,height:293},signY:.49,signInk:'#366c85'},
  'culture-station':{file:'culture-station-front.png',width:330,height:330,foot:48,source:{x:19,y:14,width:296,height:286},signY:.51,signInk:'#79546e'},
});
const images=new Map();
for(const [key,entry] of Object.entries(PAINTED_PROPS))if(typeof Image!=='undefined'){
  images.set(key,mapImage('/assets/maps/'+entry.file));
}
export async function preloadPaintedProps(kinds=Object.keys(PAINTED_PROPS)){await decodeMapImages(kinds.map(kind=>images.get(kind)).filter(Boolean));}
export function drawPaintedProp(ctx,o){
  const spec=PAINTED_PROPS[o.kind],image=images.get(o.kind);
  if(!spec||!mapImageReady(image))return false;
  const source=spec.source||{x:0,y:0,width:image.naturalWidth,height:image.naturalHeight};
  const scale=Math.min(spec.width/source.width,spec.height/source.height);
  const w=source.width*scale,h=source.height*scale,x=o.x-w/2,y=o.y+spec.foot-h;
  ctx.save();ctx.drawImage(image,source.x,source.y,source.width,source.height,x,y,w,h);ctx.textAlign='center';ctx.textBaseline='middle';
  ctx.font='19px "Jua","Malgun Gothic",sans-serif';ctx.fillStyle='#5d4e74';
  if(spec.signY){
    const text=o.name||({shop:'별 상점','energy-shop':'우주에너지 상점',crafting:'별빛 조합기'}[o.kind]);
    const sy=y+h*spec.signY;
    if(o.kind.endsWith('-station')){
      // 원화마다 다른 곡선 간판을 그대로 드러내고 글씨만 또렷하게 얹습니다.
      ctx.lineJoin='round';ctx.lineWidth=3;ctx.strokeStyle='#fff9e8';ctx.strokeText(text,o.x,sy+1);
      ctx.fillStyle=spec.signInk||'#5d4e74';ctx.fillText(text,o.x,sy+1);
    }else{
      const sw=Math.max(w*spec.signWidth,ctx.measureText(text).width+26),sh=35;
      // 글자를 눌러 줄이지 않고 이름에 맞춰 실제 간판의 폭을 넓힙니다.
      const panel=ctx.createLinearGradient(0,sy-sh/2,0,sy+sh/2);panel.addColorStop(0,'#fffdf3');panel.addColorStop(1,'#f3e4c9');
      ctx.fillStyle=panel;ctx.strokeStyle=o.kind==='energy-shop'?'#79b3d2':'#bf9b57';ctx.lineWidth=2.5;
      ctx.beginPath();ctx.roundRect(o.x-sw/2,sy-sh/2,sw,sh,9);ctx.fill();ctx.stroke();
      ctx.fillStyle='#5d4e74';ctx.fillText(text,o.x,sy+1);
    }
  }
  if(o.kind==='arcade'){
    ctx.fillStyle='#65517d';ctx.font='20px "Jua",sans-serif';
    ctx.fillText(({memory:'▦',baseball:'⚾',tetris:'▣',sudoku:'1·9',dodge:'☄',path:'✧',signal:'◇'})[o.gameId]||'★',o.x,y+h*.385);
    ctx.font='16px "Jua","Malgun Gothic",sans-serif';ctx.strokeStyle='#fffaf4';ctx.lineWidth=4;ctx.lineJoin='round';
    ctx.strokeText(o.name,o.x,o.y+62);ctx.fillText(o.name,o.x,o.y+62);
  }
  ctx.restore();return true;
}
