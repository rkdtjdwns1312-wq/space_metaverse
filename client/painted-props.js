import {mapImage,mapImageReady,decodeMapImages} from './map-image.js';
// 간판 없는 건물 원화 아래에 공통 게임 글꼴로 이름을 표시합니다.
export const PAINTED_PROPS=Object.freeze({
  'art-station':{file:'art-workshop.webp',width:330,height:330,foot:80,captionBelow:true},
  'star-angel-statue':{file:'star-angel-statue.webp',width:240,height:300,foot:45},
  shop:{file:'star-shop-depth.webp',width:300,height:300,foot:70,captionBelow:true},
  'energy-shop':{file:'energy-shop-depth.webp',width:290,height:310,foot:75,captionBelow:true},
  crafting:{file:'crafting-no-sign.webp',width:147,height:168,foot:42,captionBelow:true},
  arcade:{file:'arcade-front.png',width:110,height:155,foot:42},
  'math-station':{file:'math-workshop.webp',width:330,height:330,foot:80,captionBelow:true},
  'english-station':{file:'english-workshop.webp',width:330,height:330,foot:80,captionBelow:true},
  // foot과 월드 좌표·상호작용 범위는 기존 그대로 유지합니다.
  'history-station':{file:'history-workshop.webp',width:330,height:330,foot:55,captionBelow:true},
  'science-station':{file:'science-workshop.webp',width:330,height:330,foot:60,captionBelow:true},
  'culture-station':{file:'culture-workshop.webp',width:330,height:330,foot:48,captionBelow:true},
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
  ctx.font='16px "Jua","Malgun Gothic",sans-serif';ctx.fillStyle='#665080';
  if(spec.captionBelow){
    const text=o.name||({shop:'별 상점','energy-shop':'우주에너지 상점',crafting:'별빛 조합기'}[o.kind]);
    ctx.lineJoin='round';ctx.lineWidth=5;ctx.strokeStyle='#fff9ed';
    ctx.strokeText(text,o.x,o.y+spec.foot+23);ctx.fillText(text,o.x,o.y+spec.foot+23);
  }
  if(o.kind==='arcade'){
    ctx.fillStyle='#65517d';ctx.font='20px "Jua",sans-serif';
    ctx.fillText(({memory:'▦',baseball:'⚾',tetris:'▣',sudoku:'1·9',dodge:'☄',path:'✧',signal:'◇'})[o.gameId]||'★',o.x,y+h*.385);
    ctx.font='16px "Jua","Malgun Gothic",sans-serif';ctx.strokeStyle='#fffaf4';ctx.lineWidth=4;ctx.lineJoin='round';
    ctx.strokeText(o.name,o.x,o.y+62);ctx.fillText(o.name,o.x,o.y+62);
  }
  ctx.restore();return true;
}
