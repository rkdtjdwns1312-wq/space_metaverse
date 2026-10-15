import {gaitRig,gaitPhase,queueMotionFrames,finishMotionFrame,hasWalkPose} from './locomotion-gait.js';
// 기존 쌍둥이자리 원화의 일부만 부드럽게 변형합니다. 이동속도와 프레임 박자는 별개입니다.
const cache=new WeakMap();
const SIDE=256,FRAME_COUNT=32,TAU=Math.PI*2;
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
export function geminiWalkFrames(sprite,level){
  if(!sprite?.complete||!sprite.naturalWidth||level<2||level>4)return null;
  let byLevel=cache.get(sprite);if(!byLevel){byLevel=new Map();cache.set(sprite,byLevel);}
  if(byLevel.has(level))return byLevel.get(level);
  const original=canvas(),originalCtx=original.getContext('2d',{willReadFrequently:true});
  originalCtx.drawImage(sprite,0,0,SIDE,SIDE);
  const originalPixels=originalCtx.getImageData(0,0,SIDE,SIDE);
  const source=originalPixels.data,frames=Array(FRAME_COUNT).fill(original);
  const gait=gaitRig('gemini',level),poseSheet=hasWalkPose('gemini',level);
  queueMotionFrames(frames,frame=>{
    const phase=TAU*frame/FRAME_COUNT,swing=Math.sin(phase),follow=Math.sin(phase+.4)-Math.sin(.4);
    const picture=canvas(),context=picture.getContext('2d',{willReadFrequently:true}),pixels=context.createImageData(SIDE,SIDE);
    const gp=gaitPhase(phase);
    for(let y=0;y<SIDE;y++)for(let x=0;x<SIDE;x++){
      const u=x/SIDE,v=y/SIDE;
      // 넓은 얼굴 보호 구역은 변위가 정확히 0입니다. 눈·볼·입은 한 픽셀도 따로 움직이지 않습니다.
      const face=smooth(.23,.28,u)*(1-smooth(.77,.82,u))*smooth(.10,.15,v)*(1-smooth(.44,.49,v));
      const outerHair=(1-smooth(.29,.42,u))+smooth(.58,.71,u);
      const hair=clamp(outerHair)*smooth(.16,.28,v)*(1-smooth(.53,.72,v));
      const cloth=smooth(.57,.76,v)*(1-smooth(.91,.98,v));
      const motionBoost=level===2?1.25:1.4;
      let dx=(hair*2.15+cloth*1.65)*motionBoost*swing*(u<.5?1:-1),dy=(hair*.95+cloth*.9)*motionBoost*follow;
      if(level===2&&!poseSheet){
        // 치맛단 아래의 두 다리를 서로 반대 위상으로 움직여 가볍게 걷습니다.
        const legs=smooth(.65,.78,v)*smooth(.22,.32,u)*(1-smooth(.70,.82,u));
        const side=u<.5?1:-1;
        dx+=legs*3.1*swing*side;dy+=legs*4.4*swing*side;
      }
      if(level>=3){
        // 뿌리에서 변위가 0인 연속 날개 마스크: 원화를 도려내지 않아 접합부가 벌어지지 않습니다.
        const wing=(1-smooth(.10,.245,Math.min(u,1-u)))*smooth(.13,.22,v)*(1-smooth(.49,.57,v));
        dx=dx*(1-wing)+wing*(level===4?2.4:1.8)*swing*(u<.5?-1:1);
        dy=dy*(1-wing)+wing*(level===4?7:5)*swing;
      }
      dx*=1-face;dy*=1-face;
      const gi=(y*SIDE+x)*3,gx=gait?gait[gi]*gp[0]:0,gy=gait?-(gait[gi+1]*gp[1]+gait[gi+2]*gp[2]):0;
      sample(source,x-dx-gx,y-dy-gy,pixels.data,(y*SIDE+x)*4);
    }
    const result=pixels,face=result.data,base=originalPixels.data;
    // Restore the protected face core from original ImageData as exact RGBA bytes last.
    const left=72,right=195,top=40,bottom=110;
    for(let y=top;y<bottom;y++){
      const start=(y*SIDE+left)*4,end=(y*SIDE+right)*4;
      face.set(base.subarray(start,end),start);
    }
    context.putImageData(result,0,0);return finishMotionFrame(picture,original,'gemini',level);
  },{id:'gemini',level});
  byLevel.set(level,frames);return frames;
}
