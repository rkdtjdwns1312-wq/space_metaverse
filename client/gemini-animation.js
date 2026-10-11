// 기존 쌍둥이자리 원화의 일부만 부드럽게 변형합니다. 이동속도와 프레임 박자는 별개입니다.
const cache=new WeakMap();
const SIDE=256,FRAME_COUNT=16,TAU=Math.PI*2;
const clamp=(value)=>Math.max(0,Math.min(1,value));
const smooth=(a,b,value)=>{const t=clamp((value-a)/(b-a));return t*t*(3-2*t);};
function canvas(){const element=document.createElement('canvas');element.width=element.height=SIDE;return element;}
function sample(source,x,y,output,index){
  const left=Math.max(0,Math.min(SIDE-1,Math.floor(x))),top=Math.max(0,Math.min(SIDE-1,Math.floor(y)));
  const right=Math.min(SIDE-1,left+1),bottom=Math.min(SIDE-1,top+1),fx=clamp(x-left),fy=clamp(y-top);
  const a=(top*SIDE+left)*4,b=(top*SIDE+right)*4,c=(bottom*SIDE+left)*4,d=(bottom*SIDE+right)*4;
  for(let channel=0;channel<4;channel++){
    output[index+channel]=(source[a+channel]*(1-fx)+source[b+channel]*fx)*(1-fy)+
      (source[c+channel]*(1-fx)+source[d+channel]*fx)*fy;
  }
}
// 깃털 외곽을 별도 레이어로 떼어 날개 뿌리에서 회전합니다. 얼굴·머리카락은 이 마스크 밖입니다.
function wingLayers(original,level){
  if(level===2)return {body:original,wings:[]};
  const body=canvas(),bctx=body.getContext('2d');bctx.drawImage(original,0,0);
  const outline=level===4?
    [[0,.19],[.105,.255],[.15,.31],[.185,.345],[.215,.405],[.245,.46],[.25,.515],[.22,.555],[.14,.565],[0,.53]]:
    [[0,.27],[.115,.305],[.19,.355],[.205,.405],[.235,.45],[.23,.49],[.205,.525],[.135,.565],[0,.53]];
  const wings=[false,true].map(right=>{
    const points=outline.map(([x,y])=>[(right?1-x:x)*SIDE,y*SIDE]);
    const path=new Path2D();points.forEach(([x,y],i)=>i?path.lineTo(x,y):path.moveTo(x,y));path.closePath();
    const layer=canvas(),ctx=layer.getContext('2d');ctx.save();ctx.clip(path);ctx.drawImage(original,0,0);ctx.restore();
    bctx.save();bctx.globalCompositeOperation='destination-out';bctx.fill(path);bctx.restore();
    return {layer,x:(right?.77:.23)*SIDE,y:.465*SIDE,side:right?-1:1};
  });
  return {body,wings};
}
export function geminiWalkFrames(sprite,level){
  if(!sprite?.complete||!sprite.naturalWidth||level<2||level>4)return null;
  let byLevel=cache.get(sprite);if(!byLevel){byLevel=new Map();cache.set(sprite,byLevel);}
  if(byLevel.has(level))return byLevel.get(level);
  const original=canvas(),originalCtx=original.getContext('2d',{willReadFrequently:true});
  originalCtx.drawImage(sprite,0,0,SIDE,SIDE);
  const {body,wings}=wingLayers(original,level);
  const source=body.getContext('2d').getImageData(0,0,SIDE,SIDE).data,frames=[original];
  for(let frame=1;frame<FRAME_COUNT;frame++){
    const phase=TAU*frame/FRAME_COUNT,swing=Math.sin(phase),follow=Math.sin(phase+.4)-Math.sin(.4);
    const picture=canvas(),context=picture.getContext('2d'),pixels=context.createImageData(SIDE,SIDE);
    for(let y=0;y<SIDE;y++)for(let x=0;x<SIDE;x++){
      const u=x/SIDE,v=y/SIDE;
      // 넓은 얼굴 보호 구역은 변위가 정확히 0입니다. 눈·볼·입은 한 픽셀도 따로 움직이지 않습니다.
      const face=smooth(.23,.28,u)*(1-smooth(.77,.82,u))*smooth(.10,.15,v)*(1-smooth(.44,.49,v));
      const outerHair=(1-smooth(.29,.42,u))+smooth(.58,.71,u);
      const hair=clamp(outerHair)*smooth(.16,.28,v)*(1-smooth(.53,.72,v));
      const cloth=smooth(.57,.76,v)*(1-smooth(.91,.98,v));
      let dx=(hair*1.7+cloth*1.2)*swing*(u<.5?1:-1),dy=(hair*.7+cloth*.65)*follow;
      if(level===2){
        // 치맛단 아래의 두 다리를 서로 반대 위상으로 움직여 가볍게 걷습니다.
        const legs=smooth(.65,.78,v)*smooth(.22,.32,u)*(1-smooth(.70,.82,u));
        const side=u<.5?1:-1;
        dx+=legs*2.4*swing*side;dy+=legs*3.6*swing*side;
      }
      dx*=1-face;dy*=1-face;
      sample(source,x-dx,y-dy,pixels.data,(y*SIDE+x)*4);
    }
    const movingBody=canvas();movingBody.getContext('2d').putImageData(pixels,0,0);
    for(const wing of wings){
      context.save();context.translate(wing.x,wing.y);context.rotate(wing.side*swing*.035);
      context.drawImage(wing.layer,-wing.x,-wing.y);context.restore();
    }
    context.drawImage(movingBody,0,0);frames.push(picture);
  }
  byLevel.set(level,frames);return frames;
}
