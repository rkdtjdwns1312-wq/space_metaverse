// 광장·낙원·사냥터·은하수·부서 출구가 같은 원화를 공유합니다.
export const GATE_ART_SRC='/assets/maps/star-gate.png';
const image=typeof Image==='undefined'?null:new Image();
if(image)image.src=GATE_ART_SRC;
export async function preloadGateArt(){await image?.decode();}
export function gateVisualBox(o){
  const radius=Number(o.radius)||36,width=radius*2.8,height=radius*3.5;
  // 북쪽 문 위의 목적지 이름이 맵 밖으로 잘리지 않게 합니다.
  const y=Math.max(76,o.y+radius*.9-height);
  return {x:o.x-width/2,y,width,height};
}
export function drawPaintedGate(ctx,o){
  const box=gateVisualBox(o);ctx.save();
  if(image?.complete&&image.naturalWidth){
    const scale=Math.min(box.width/image.naturalWidth,box.height/image.naturalHeight),w=image.naturalWidth*scale,h=image.naturalHeight*scale;
    ctx.drawImage(image,box.x+(box.width-w)/2,box.y+box.height-h,w,h);
  }else{
    // 원화 로딩 중에도 위치를 알 수 있는 열린 아치. 이동 판정은 서버의 o.x/y를 사용합니다.
    ctx.strokeStyle='#c9b8e2';ctx.lineWidth=9;ctx.beginPath();
    ctx.moveTo(box.x+10,box.y+box.height);ctx.lineTo(box.x+10,box.y+box.width/2);
    ctx.arc(o.x,box.y+box.width/2,box.width/2-10,Math.PI,0);
    ctx.lineTo(box.x+box.width-10,box.y+box.height);ctx.stroke();
  }
  ctx.restore();return box;
}
