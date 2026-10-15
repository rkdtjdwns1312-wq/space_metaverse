import {gaitRig,gaitPhase,queueMotionFrames,finishMotionFrame,hasWalkPose} from './locomotion-gait.js';
// 황소자리 원화의 얼굴·몸통·갑옷·무기는 고정하고 다리와 원화에 있는 꼬리만 작게 흔듭니다.
const cache=new WeakMap(),SIDE=256,COUNT=32,TAU=Math.PI*2;
const clamp=n=>Math.max(0,Math.min(1,n));
const smooth=(a,b,n)=>{const t=clamp((n-a)/(b-a));return t*t*(3-2*t);};

export function taurusWalkFrames(sprite,level){
  if(!sprite?.complete||!sprite.naturalWidth||level<2||level>4)return null;
  let levels=cache.get(sprite);if(!levels){levels=new Map();cache.set(sprite,levels);}
  if(levels.has(level))return levels.get(level);
  const original=document.createElement('canvas');original.width=original.height=SIDE;
  const sourceCtx=original.getContext('2d',{willReadFrequently:true});
  sourceCtx.drawImage(sprite,0,0,SIDE,SIDE);
  const source=sourceCtx.getImageData(0,0,SIDE,SIDE).data,frames=Array(COUNT).fill(original);
  const gait=gaitRig('taurus',level),poseSheet=hasWalkPose('taurus',level);
  queueMotionFrames(frames,frame=>{
    const phase=TAU*frame/COUNT,canvas=document.createElement('canvas');canvas.width=canvas.height=SIDE;
    const target=canvas.getContext('2d'),out=target.createImageData(SIDE,SIDE);
    const gp=gaitPhase(phase);
    for(let y=0;y<SIDE;y++)for(let x=0;x<SIDE;x++){
      const u=x/SIDE,v=y/SIDE;
      let legA=0,legB=0,tail=0;
      if(level===2){
        // LV2 뒷발과 앞발은 아래쪽 두 발굽에 한정합니다. 오른쪽 꼬리는 별도 마스크입니다.
        legA=smooth(.28,.33,u)*(1-smooth(.48,.53,u))*smooth(.79,.84,v)*(1-smooth(.96,.99,v));
        legB=smooth(.59,.64,u)*(1-smooth(.77,.82,u))*smooth(.79,.84,v)*(1-smooth(.97,.995,v));
        const tailRoot=smooth(.68,.73,u)*(1-smooth(.87,.92,u))*smooth(.64,.69,v)*(1-smooth(.76,.81,v));
        const tailTuft=smooth(.80,.84,u)*(1-smooth(.94,.98,u))*smooth(.54,.59,v)*(1-smooth(.71,.76,v));
        tail=Math.max(tailRoot,tailTuft);
      }else if(level===3){
        // LV3에는 꼬리가 없습니다. 치맛단 아래의 두 정강이와 샌들만 대상으로 합니다.
        legA=smooth(.45,.49,u)*(1-smooth(.56,.60,u))*smooth(.82,.86,v)*(1-smooth(.98,1,v));
        legB=smooth(.57,.61,u)*(1-smooth(.70,.74,u))*smooth(.82,.86,v)*(1-smooth(.985,1,v));
      }else{
        // LV4 바지와 신발은 망토 안쪽 하단에 있습니다. 왼쪽 꼬리는 옷자락과 분리된 좁은 윤곽만 움직입니다.
        legA=smooth(.39,.43,u)*(1-smooth(.54,.58,u))*smooth(.78,.82,v)*(1-smooth(.98,1,v));
        legB=smooth(.56,.60,u)*(1-smooth(.72,.76,u))*smooth(.78,.82,v)*(1-smooth(.98,1,v));
        const tailRoot=smooth(.29,.33,u)*(1-smooth(.43,.47,u))*smooth(.77,.81,v)*(1-smooth(.85,.89,v));
        const tailTuft=smooth(.13,.17,u)*(1-smooth(.29,.33,u))*smooth(.70,.75,v)*(1-smooth(.88,.93,v));
        tail=Math.max(tailRoot,tailTuft);
      }
      const swingA=Math.sin(phase),swingB=Math.sin(phase+Math.PI);
      const tailSwing=Math.sin(phase+.7);
      const cloth=level>=3?((1-smooth(.24,.39,u))+smooth(.66,.80,u))*smooth(.54,.65,v)*(1-smooth(.85,.93,v)):0;
      if(poseSheet){legA=0;legB=0;}
      const dx=(legA*swingA+legB*swingB)*1.35+tail*2.0*(tailSwing-Math.sin(.7))+cloth*1.9*(Math.sin(phase+.4)-Math.sin(.4));
      const dy=(legA*swingA+legB*swingB)*.75+tail*.8*(Math.sin(phase+.7)-Math.sin(.7))+cloth*.7*Math.sin(phase);
      const gi=(y*SIDE+x)*3,gx=gait?gait[gi]*gp[0]:0,gy=gait?-(gait[gi+1]*gp[1]+gait[gi+2]*gp[2]):0;
      const sx=x-dx-gx,sy=y-dy-gy;if(sx<0||sy<0||sx>=SIDE-1||sy>=SIDE-1)continue;
      const ix=Math.floor(sx),iy=Math.floor(sy),fx=sx-ix,fy=sy-iy,index=(y*SIDE+x)*4;
      const a=(iy*SIDE+ix)*4,b=a+4,c=a+SIDE*4,d=c+4;
      for(let channel=0;channel<4;channel++)out.data[index+channel]=
        (source[a+channel]*(1-fx)+source[b+channel]*fx)*(1-fy)+
        (source[c+channel]*(1-fx)+source[d+channel]*fx)*fy;
    }
    target.putImageData(out,0,0);return finishMotionFrame(canvas,original,'taurus',level);
  },{id:'taurus',level});
  levels.set(level,frames);return frames;
}
