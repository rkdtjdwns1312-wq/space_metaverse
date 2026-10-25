import {gaitRig,gaitPhase,queueMotionFrames,finishMotionFrame,hasWalkPose} from './locomotion-gait.js';
// 헤라클레스 얼굴·갑옷 몸통은 고정하고 Lv3/4 하체와 떨어진 무기만 약하게 움직입니다.
// Lv2는 새 정면 원화에서만 동작합니다. 기존 활쏘기 원화는 마스크 대상이 아닙니다.
const cache=new WeakMap(),SIDE=256,FRAME_COUNT=32,TAU=Math.PI*2;
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
function insideFace(level,u,v){
  const cx=.5,cy=level===2?.30:level===3?.34:.335,rx=level===2?.18:level===3?.17:.165,ry=level===2?.17:level===3?.155:.15;
  return ((u-cx)/rx)**2+((v-cy)/ry)**2<=1;
}
export function herculesWalkFrames(sprite,level){
  if(!sprite?.complete||!sprite.naturalWidth||level<2||level>4)return null;
  if(level===2&&!String(sprite.currentSrc||sprite.src).includes('hercules-front-v2.png'))return null;
  let byLevel=cache.get(sprite);if(!byLevel){byLevel=new Map();cache.set(sprite,byLevel);}
  if(byLevel.has(level))return byLevel.get(level);
  const original=canvas(),originalContext=original.getContext('2d',{willReadFrequently:true});
  originalContext.drawImage(sprite,0,0,SIDE,SIDE);
  const source=originalContext.getImageData(0,0,SIDE,SIDE).data,frames=Array(FRAME_COUNT).fill(original);
  const gait=gaitRig('hercules',level),poseSheet=hasWalkPose('hercules',level);
  queueMotionFrames(frames,frame=>{
    const phase=TAU*frame/FRAME_COUNT,swing=Math.sin(phase),picture=canvas(),context=picture.getContext('2d');
    const pixels=context.createImageData(SIDE,SIDE);
    const gp=gaitPhase(phase);
    for(let y=0;y<SIDE;y++)for(let x=0;x<SIDE;x++){
      const u=(x+.5)/SIDE,v=(y+.5)/SIDE,index=(y*SIDE+x)*4;
      if(insideFace(level,u,v)){for(let c=0;c<4;c++)pixels.data[index+c]=source[index+c];continue;}
      const hem=smooth(level===2?.70:level===3?.70:.67,level===2?.77:level===3?.77:.75,v)*(1-smooth(.96,.995,v));
      const left=smooth(level===2?.34:level===3?.31:.30,level===2?.39:level===3?.38:.37,u)*(1-smooth(level===2?.47:level===3?.46:.47,level===2?.51:level===3?.52:.53,u));
      const right=smooth(level===2?.53:level===3?.53:.52,level===2?.58:level===3?.59:.60,u)*(1-smooth(level===2?.64:level===3?.68:.70,level===2?.71:level===3?.76:.78,u));
      const leftLeg=poseSheet?0:hem*left,rightLeg=poseSheet?0:hem*right;
      let dx=(rightLeg-leftLeg)*1.0*swing;
      let dy=(leftLeg-rightLeg)*1.65*swing;
      let weapon=0;
      if(level===3){
        // Lv3 지팡이/몽둥이는 어깨 뒤 가로 구간만 선택합니다.
        weapon=smooth(.35,.40,u)*(1-smooth(.76,.82,u))*smooth(.385,.405,v)*(1-smooth(.49,.515,v));
      }else if(level===4){
        // Lv4 창은 화면 왼쪽의 세로 무기 영역만 선택합니다.
        weapon=smooth(.115,.145,u)*(1-smooth(.285,.315,u))*smooth(.12,.17,v)*(1-smooth(.91,.96,v));
      }else{
        // 새 Lv2 정면 원화의 오른쪽 등 뒤 활만 가볍게 흔듭니다.
        weapon=smooth(.70,.735,u)*(1-smooth(.79,.82,u))*smooth(.18,.24,v)*(1-smooth(.68,.74,v));
      }
      dy+=weapon*.65*swing;
      const cape=((1-smooth(.24,.37,u))+smooth(.69,.82,u))*smooth(.55,.65,v)*(1-smooth(.86,.95,v));
      dx+=cape*1.5*(Math.sin(phase+.4)-Math.sin(.4));dy+=cape*.55*swing;
      const gi=(y*SIDE+x)*3,gx=gait?gait[gi]*gp[0]:0,gy=gait?-(gait[gi+1]*gp[1]+gait[gi+2]*gp[2]):0;
      sample(source,x-dx-gx,y-dy-gy,pixels.data,index);
    }
    context.putImageData(pixels,0,0);
    const cx=.5,cy=level===2?.30:level===3?.34:.335,rx=level===2?.18:level===3?.17:.165,ry=level===2?.17:level===3?.155:.15;
    context.save();context.beginPath();context.ellipse(cx*SIDE,cy*SIDE,rx*SIDE,ry*SIDE,0,0,TAU);context.clip();
    context.globalCompositeOperation='copy';context.drawImage(original,0,0);context.restore();
    return finishMotionFrame(picture,original,'hercules',level);
  },{id:'hercules',level});
  byLevel.set(level,frames);return frames;
}
