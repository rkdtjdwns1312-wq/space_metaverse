import {gaitRig,gaitPhase,queueMotionFrames,finishMotionFrame} from './locomotion-gait.js';
// 얼굴과 별자리 저울은 고정하고 머리카락 바깥결과 옷자락만 가볍게 흔듭니다.
const cache=new WeakMap(),SIDE=256,FRAME_COUNT=32,TAU=Math.PI*2;
const clamp=value=>Math.max(0,Math.min(1,value));
const smooth=(a,b,value)=>{const t=clamp((value-a)/(b-a));return t*t*(3-2*t);};
function canvas(){const element=document.createElement('canvas');element.width=element.height=SIDE;return element;}
function ellipse(x,y,cx,cy,rx,ry){const dx=(x-cx)/rx,dy=(y-cy)/ry;return dx*dx+dy*dy;}
function sample(source,x,y,out,index){
  const left=Math.max(0,Math.min(SIDE-1,Math.floor(x))),top=Math.max(0,Math.min(SIDE-1,Math.floor(y)));
  const right=Math.min(SIDE-1,left+1),bottom=Math.min(SIDE-1,top+1),fx=clamp(x-left),fy=clamp(y-top);
  const a=(top*SIDE+left)*4,b=(top*SIDE+right)*4,c=(bottom*SIDE+left)*4,d=(bottom*SIDE+right)*4;
  for(let channel=0;channel<4;channel++)out[index+channel]=
    (source[a+channel]*(1-fx)+source[b+channel]*fx)*(1-fy)+
    (source[c+channel]*(1-fx)+source[d+channel]*fx)*fy;
}
function faceBounds(level){
  // 원화별 얼굴과 이마 장식을 포함하는 넉넉한 얼굴 보호 타원(정규화 좌표).
  if(level===2)return [.50,.315,.185,.185];
  if(level===3)return [.50,.345,.175,.155];
  return [.50,.345,.17,.155];
}
export function libraWalkFrames(sprite,level){
  if(!sprite?.complete||!sprite.naturalWidth||level<2||level>4)return null;
  let byLevel=cache.get(sprite);if(!byLevel){byLevel=new Map();cache.set(sprite,byLevel);}
  if(byLevel.has(level))return byLevel.get(level);
  const original=canvas(),originalContext=original.getContext('2d',{willReadFrequently:true});
  originalContext.drawImage(sprite,0,0,SIDE,SIDE);
  const source=originalContext.getImageData(0,0,SIDE,SIDE).data,frames=Array(FRAME_COUNT).fill(original);
  const [faceX,faceY,faceRx,faceRy]=faceBounds(level);
  const gait=gaitRig('libra',level);
  queueMotionFrames(frames,frame=>{
    const phase=TAU*frame/FRAME_COUNT,sway=Math.sin(phase),follow=Math.sin(phase+.55)-Math.sin(.55);
    const picture=canvas(),context=picture.getContext('2d'),pixels=context.createImageData(SIDE,SIDE);
    const gp=gaitPhase(phase);
    for(let y=0;y<SIDE;y++)for(let x=0;x<SIDE;x++){
      const u=(x+.5)/SIDE,v=(y+.5)/SIDE,face=ellipse(u,v,faceX,faceY,faceRx,faceRy);
      const protectedFace=face<=1;
      // Lv2 긴 금발 옆머리, Lv3 양옆 머리결, Lv4 넓은 바깥 머릿결만 흔듭니다.
      const sideHair=level===2?
        (smooth(.16,.25,v)*(1-smooth(.77,.90,v))*(1-smooth(.32,.43,u))+smooth(.66,.77,u)):
        (smooth(.16,.27,v)*(1-smooth(.68,.82,v))*((1-smooth(.22,.34,u))+smooth(.66,.78,u)));
      const hair=clamp(sideHair)*smooth(.18,.28,v)*(1-smooth(.78,.88,v));
      // 바깥 소매·치맛단 한정. 저울/손/얼굴 높이는 보수적으로 제외합니다.
      const hem=smooth(.69,.78,v)*(1-smooth(.95,.99,v));
      const outerCloth=clamp((1-smooth(.24,.38,u))+smooth(.62,.76,u));
      const garment=hem*outerCloth*(1-smooth(.43,.55,u));
      const armKeep=level===2?
        smooth(.38,.46,u)*(1-smooth(.63,.72,u))*smooth(.26,.36,v)*(1-smooth(.69,.78,v)):
        smooth(.34,.43,u)*(1-smooth(.57,.66,u))*smooth(.40,.49,v)*(1-smooth(.74,.82,v));
      const cloth=garment*(1-clamp(armKeep)),edge=Math.max(hair,cloth);
      if(protectedFace){const index=(y*SIDE+x)*4;for(let c=0;c<4;c++)pixels.data[index+c]=source[index+c];continue;}
      const dx=(hair*1.35+cloth*1.15)*Math.sin(phase)*(u<.5?1:-1);
      const dy=hair*.55*follow+cloth*.45*follow,index=(y*SIDE+x)*4;
      const gi=(y*SIDE+x)*3,gx=gait?gait[gi]*gp[0]:0,gy=gait?-(gait[gi+1]*gp[1]+gait[gi+2]*gp[2]):0;
      sample(source,x-dx*edge-gx,y-dy*edge-gy,pixels.data,index);
    }
    context.putImageData(pixels,0,0);
    // Partial-alpha pixels can round by one channel through putImageData; copy the exact source ROI back.
    context.save();context.beginPath();context.ellipse(faceX*SIDE,faceY*SIDE,faceRx*SIDE,faceRy*SIDE,0,0,TAU);context.clip();
    context.globalCompositeOperation='copy';context.drawImage(original,0,0);context.restore();
    return finishMotionFrame(picture,original,'libra',level);
  });
  byLevel.set(level,frames);return frames;
}
