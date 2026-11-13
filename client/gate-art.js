import {mapImage,mapImageReady,decodeMapImages} from './map-image.js';
import {spriteShadowProfile} from './prop-shadows.js';
// 광장·낙원·사냥터·은하수·부서 출구가 같은 원화를 공유합니다.
export const GATE_ART_SRC='/assets/maps/star-gate.png';
const image=mapImage(GATE_ART_SRC);

export async function preloadGateArt(){await decodeMapImages([image]);}
export function gateLabelBelow(o,map){
  // Keep names inside the visible map at northern entrances, including cropped maps.
  return !!o.labelBelow||o.id==='gate-sleeping-stars'||o.y-(map.viewBounds?.y??0)<=(Number(o.radius)||36)*4;
}
export function gateVisualBox(o){
  const radius=Number(o.radius)||36,width=radius*2.8,height=radius*3.5;
  // 북쪽 문 위의 목적지 이름이 맵 밖으로 잘리지 않게 합니다.
  const y=Math.max(76,o.y+radius*.9-height);
  return {x:o.x-width/2,y,width,height};
}
export function gateShadowProfile(o){
  if(!mapImageReady(image))return null;
  const box=gateVisualBox(o),scale=Math.min(box.width/image.naturalWidth,box.height/image.naturalHeight),width=image.naturalWidth*scale,height=image.naturalHeight*scale;
  return spriteShadowProfile(image,{x:box.x+(box.width-width)/2,y:box.y+box.height-height,width,height});
}
export function drawPaintedGate(ctx,o){
  const box=gateVisualBox(o);ctx.save();
  if(mapImageReady(image)){
    const scale=Math.min(box.width/image.naturalWidth,box.height/image.naturalHeight),w=image.naturalWidth*scale,h=image.naturalHeight*scale;
    const painted={x:box.x+(box.width-w)/2,y:box.y+box.height-h,width:w,height:h};
    ctx.drawImage(image,painted.x,painted.y,w,h);ctx.restore();
    // star-gate.png's visible alpha bounds (1145×1374); exclude transparent
    // margins when placing its name, without changing rendering or collision.
    return {x:painted.x+w*33/1145,y:painted.y+h*43/1374,width:w*1081/1145,height:h*1249/1374};
  }else{
    // 원화 로딩 중에도 위치를 알 수 있는 열린 아치. 이동 판정은 서버의 o.x/y를 사용합니다.
    ctx.strokeStyle='#c9b8e2';ctx.lineWidth=9;ctx.beginPath();
    ctx.moveTo(box.x+10,box.y+box.height);ctx.lineTo(box.x+10,box.y+box.width/2);
    ctx.arc(o.x,box.y+box.width/2,box.width/2-10,Math.PI,0);
    ctx.lineTo(box.x+box.width-10,box.y+box.height);ctx.stroke();
  }
  ctx.restore();return box;
}
// Position the baseline using actual text bounds so above/below labels have
// the same small visible gap, regardless of font size or gate artwork scale.
export function gateLabelBaseline(ctx,text,box,below=false){
  const metrics=ctx.measureText(text),gap=6+ctx.lineWidth/2;
  return below?box.y+box.height+gap+(metrics.actualBoundingBoxAscent||16):box.y-gap-(metrics.actualBoundingBoxDescent||0);
}
