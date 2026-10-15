import {gaitRig,gaitPhase,queueMotionFrames,finishMotionFrame,hasWalkPose} from './locomotion-gait.js';
// 염소자리 원화의 얼굴·몸통·장식은 고정하고 발과 다리 하부만 작게 번갈아 움직입니다.
const cache=new WeakMap(),SIDE=256,COUNT=32,TAU=Math.PI*2;
const clamp=n=>Math.max(0,Math.min(1,n));
const smooth=(a,b,n)=>{const t=clamp((n-a)/(b-a));return t*t*(3-2*t);};

export function capricornWalkFrames(sprite,level){
  if(!sprite?.complete||!sprite.naturalWidth||level<2||level>4)return null;
  let levels=cache.get(sprite);if(!levels){levels=new Map();cache.set(sprite,levels);}
  if(levels.has(level))return levels.get(level);
  const original=document.createElement('canvas');original.width=original.height=SIDE;
  const sourceCtx=original.getContext('2d',{willReadFrequently:true});
  sourceCtx.drawImage(sprite,0,0,SIDE,SIDE);
  const source=sourceCtx.getImageData(0,0,SIDE,SIDE).data,frames=Array(COUNT).fill(original);
  const gait=gaitRig('capricorn',level),poseSheet=hasWalkPose('capricorn',level);
  queueMotionFrames(frames,frame=>{
    const phase=TAU*frame/COUNT,canvas=document.createElement('canvas');canvas.width=canvas.height=SIDE;
    const target=canvas.getContext('2d'),out=target.createImageData(SIDE,SIDE);
    const gp=gaitPhase(phase);
    for(let y=0;y<SIDE;y++)for(let x=0;x<SIDE;x++){
      const u=x/SIDE,v=y/SIDE;
      let dx=0,dy=0;
      if(level===2){
        // 네 발은 몸통이 끝나는 y≈.69 아래에만 존재합니다. 꼬리·지느러미는 왼쪽 x<.36이라 제외합니다.
        const rearLeg=smooth(.37,.42,u)*(1-smooth(.49,.54,u))*smooth(.68,.73,v)*(1-smooth(.94,.99,v));
        const frontLeg=smooth(.60,.65,u)*(1-smooth(.79,.84,u))*smooth(.67,.72,v)*(1-smooth(.95,.99,v));
        const rearSwing=Math.sin(phase),frontSwing=Math.sin(phase+Math.PI);
        dx=(rearLeg*rearSwing+frontLeg*frontSwing)*1.45;
        dy=(rearLeg*rearSwing+frontLeg*frontSwing)*.8;
      }else{
        // 치맛단 위쪽을 경계로 두 정강이와 신발만 움직이고 허리·치마·망토를 보존합니다.
        const hem=level===4?.775:.765;
        const leftLeg=smooth(.36,.41,u)*(1-smooth(.49,.54,u))*smooth(hem,hem+.035,v);
        const rightLeg=smooth(.51,.56,u)*(1-smooth(.64,.69,u))*smooth(hem,hem+.035,v);
        const leftSwing=Math.sin(phase),rightSwing=Math.sin(phase+Math.PI);
        dx=(leftLeg*leftSwing+rightLeg*rightSwing)*1.25;
        dy=(leftLeg*leftSwing+rightLeg*rightSwing)*.75;
      }
      if(poseSheet){dx=0;dy=0;}
      // 머리 바깥결과 양옆 옷자락만 다리보다 조금 늦게 따라옵니다.
      const outside=(1-smooth(.25,.38,u))+smooth(.67,.80,u);
      const cloth=outside*smooth(.55,.67,v)*(1-smooth(.81,.92,v));
      const hair=level>=3?outside*smooth(.30,.38,v)*(1-smooth(.49,.56,v)):0;
      dx+=cloth*1.8*(Math.sin(phase+.35)-Math.sin(.35))+hair*.9*Math.sin(phase);
      dy+=cloth*.6*Math.sin(phase);
      const gi=(y*SIDE+x)*3,gx=gait?gait[gi]*gp[0]:0,gy=gait?-(gait[gi+1]*gp[1]+gait[gi+2]*gp[2]):0;
      const sx=x-dx-gx,sy=y-dy-gy;if(sx<0||sy<0||sx>=SIDE-1||sy>=SIDE-1)continue;
      const ix=Math.floor(sx),iy=Math.floor(sy),fx=sx-ix,fy=sy-iy,index=(y*SIDE+x)*4;
      const a=(iy*SIDE+ix)*4,b=a+4,c=a+SIDE*4,d=c+4;
      for(let channel=0;channel<4;channel++)out.data[index+channel]=
        (source[a+channel]*(1-fx)+source[b+channel]*fx)*(1-fy)+
        (source[c+channel]*(1-fx)+source[d+channel]*fx)*fy;
    }
    target.putImageData(out,0,0);return finishMotionFrame(canvas,original,'capricorn',level);
  },{id:'capricorn',level});
  levels.set(level,frames);return frames;
}
