// 기존 쌍둥이자리 원화의 일부만 부드럽게 변형합니다. 이동속도와 프레임 박자는 별개입니다.
const cache=new WeakMap();
const SIDE=256,FRAME_COUNT=8,TAU=Math.PI*2;
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
  const source=originalCtx.getImageData(0,0,SIDE,SIDE).data,frames=[original];
  for(let frame=1;frame<FRAME_COUNT;frame++){
    const phase=TAU*frame/FRAME_COUNT,swing=Math.sin(phase),follow=Math.sin(phase+.4)-Math.sin(.4);
    const picture=canvas(),context=picture.getContext('2d'),pixels=context.createImageData(SIDE,SIDE);
    for(let y=0;y<SIDE;y++)for(let x=0;x<SIDE;x++){
      const u=x/SIDE,v=y/SIDE;
      // 얼굴과 손은 고정하고, 양옆 머리카락 끝과 앞머리만 아주 조금 흔듭니다.
      const outerHair=(1-smooth(.29,.42,u))+smooth(.58,.71,u);
      const hair=clamp(outerHair)*smooth(.08,.19,v)*(1-smooth(.53,.72,v));
      const fringe=smooth(.08,.15,v)*(1-smooth(.25,.34,v))*smooth(.24,.36,u)*(1-smooth(.64,.77,u));
      let dx=(hair*2.8+fringe*1.2)*swing*(u<.5?1:-1),dy=hair*1.5*follow;
      if(level===2){
        // 치맛단 아래의 두 다리를 서로 반대 위상으로 움직여 가볍게 걷습니다.
        const legs=smooth(.65,.78,v)*smooth(.22,.32,u)*(1-smooth(.70,.82,u));
        const side=u<.5?1:-1;
        dx+=legs*2.4*swing*side;dy+=legs*3.6*swing*side;
      }else{
        // Lv3·4의 양쪽 날개는 빠르게 파닥이지 않고 느린 호흡처럼 오르내립니다.
        const wingEdge=(1-smooth(.22,.35,u))+smooth(.65,.78,u);
        const wing=clamp(wingEdge)*smooth(.23,.34,v)*(1-smooth(.57,.71,v));
        dx+=wing*(level===4?2.6:2.2)*swing*(u<.5?-1:1);
        dy+=wing*(level===4?4.4:3.6)*follow;
      }
      sample(source,x-dx,y-dy,pixels.data,(y*SIDE+x)*4);
    }
    context.putImageData(pixels,0,0);frames.push(picture);
  }
  byLevel.set(level,frames);return frames;
}
