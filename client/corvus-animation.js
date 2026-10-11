// 까마귀 얼굴은 고정하고 옷자락·발만 걷게 합니다. Lv4 날개는 몸과 나눈 외곽 마스크로 약하게 퍼덕입니다.
const cache=new WeakMap(),SIDE=256,FRAME_COUNT=16,TAU=Math.PI*2;
const clamp=value=>Math.max(0,Math.min(1,value));
const smooth=(a,b,value)=>{const t=clamp((value-a)/(b-a));return t*t*(3-2*t);};
function canvas(){const element=document.createElement('canvas');element.width=element.height=SIDE;return element;}
function sample(source,x,y,out,index){
  const left=Math.max(0,Math.min(SIDE-1,Math.floor(x))),top=Math.max(0,Math.min(SIDE-1,Math.floor(y)));
  const right=Math.min(SIDE-1,left+1),bottom=Math.min(SIDE-1,top+1),fx=clamp(x-left),fy=clamp(y-top);
  const a=(top*SIDE+left)*4,b=(top*SIDE+right)*4,c=(bottom*SIDE+left)*4,d=(bottom*SIDE+right)*4;
  for(let channel=0;channel<4;channel++)out[index+channel]=
    (source[a+channel]*(1-fx)+source[b+channel]*fx)*(1-fy)+
    (source[c+channel]*(1-fx)+source[d+channel]*fx)*fy;
}
function face(level){
  if(level===2)return [.50,.33,.18,.18];
  if(level===3)return [.56,.35,.17,.15];
  return [.50,.35,.165,.15];
}
function wingLayers(original){
  const body=canvas(),bodyContext=body.getContext('2d');bodyContext.drawImage(original,0,0);
  const outlines=[
    [[.34,.42],[.27,.38],[.19,.33],[.12,.31],[.07,.35],[.045,.41],[.07,.50],[.13,.60],[.21,.66],[.29,.64],[.36,.57]],
    [[.69,.51],[.76,.49],[.82,.52],[.87,.59],[.92,.65],[.97,.58],[.99,.48],[.98,.39],[.94,.35],[.89,.42],[.83,.48],[.76,.47]]
  ];
  const wings=outlines.map((outline,index)=>{
    const path=new Path2D();outline.forEach(([x,y],i)=>i?path.lineTo(x*SIDE,y*SIDE):path.moveTo(x*SIDE,y*SIDE));path.closePath();
    const layer=canvas(),ctx=layer.getContext('2d');ctx.save();ctx.clip(path);ctx.drawImage(original,0,0);ctx.restore();
    bodyContext.save();bodyContext.globalCompositeOperation='destination-out';bodyContext.fill(path);bodyContext.restore();
    const rootX=(index===0?.34:.66)*SIDE,rootY=.42*SIDE;
    return {layer,rootX,rootY,direction:index===0?1:-1};
  });
  return {body,wings};
}
export function corvusWalkFrames(sprite,level){
  if(!sprite?.complete||!sprite.naturalWidth||level<2||level>4)return null;
  let byLevel=cache.get(sprite);if(!byLevel){byLevel=new Map();cache.set(sprite,byLevel);}
  if(byLevel.has(level))return byLevel.get(level);
  const original=canvas(),originalContext=original.getContext('2d',{willReadFrequently:true});
  originalContext.drawImage(sprite,0,0,SIDE,SIDE);
  const articulated=level===4?wingLayers(original):{body:original,wings:[]};
  const source=articulated.body.getContext('2d',{willReadFrequently:true}).getImageData(0,0,SIDE,SIDE).data;
  const originalPixels=originalContext.getImageData(0,0,SIDE,SIDE).data;
  const [faceX,faceY,faceRx,faceRy]=face(level),frames=[original];
  for(let frame=1;frame<FRAME_COUNT;frame++){
    const phase=TAU*frame/FRAME_COUNT,swing=Math.sin(phase),picture=canvas(),context=picture.getContext('2d'),pixels=context.createImageData(SIDE,SIDE);
    for(let y=0;y<SIDE;y++)for(let x=0;x<SIDE;x++){
      const u=(x+.5)/SIDE,v=(y+.5)/SIDE,index=(y*SIDE+x)*4;
      if(((u-faceX)/faceRx)**2+((v-faceY)/faceRy)**2<=1){for(let c=0;c<4;c++)pixels.data[index+c]=originalPixels[index+c];continue;}
      const hem=smooth(level===2?.57:.62,level===2?.65:.70,v)*(1-smooth(.93,.98,v));
      const leftCloth=(1-smooth(level===2?.35:.25,level===2?.43:.36,u));
      const rightCloth=smooth(level===2?.58:.64,level===2?.74:.82,u);
      const cloth=hem*clamp(leftCloth+rightCloth);
      const leftFoot=smooth(level===3?.49:.34,level===3?.55:.40,u)*(1-smooth(level===3?.60:.48,level===3?.66:.52,u))*smooth(.78,.84,v);
      const rightFoot=smooth(level===3?.60:.53,level===3?.66:.62,u)*(1-smooth(level===3?.70:.68,level===3?.72:.70,u))*smooth(.78,.84,v);
      const dx=(rightFoot-leftFoot)*1.05*swing;
      const dy=cloth*.42*(Math.sin(phase+.5)-Math.sin(.5))+(leftFoot-rightFoot)*1.65*swing;
      sample(source,x-dx*clamp(Math.max(cloth,leftFoot,rightFoot)),y-dy*clamp(Math.max(cloth,leftFoot,rightFoot)),pixels.data,index);
    }
    context.putImageData(pixels,0,0);
    if(articulated.wings.length){
      for(const wing of articulated.wings){context.save();context.translate(wing.rootX,wing.rootY);context.rotate(wing.direction*swing*.022);context.drawImage(wing.layer,-wing.rootX,-wing.rootY);context.restore();}
    }
    // 원본 ROI를 clipped copy로 마지막에 덮어 얼굴 partial-alpha 픽셀까지 바이트 단위로 보존합니다.
    context.save();context.beginPath();context.ellipse(faceX*SIDE,faceY*SIDE,faceRx*SIDE,faceRy*SIDE,0,0,TAU);context.clip();
    context.globalCompositeOperation='copy';context.drawImage(original,0,0);context.restore();
    frames.push(picture);
  }
  byLevel.set(level,frames);return frames;
}
