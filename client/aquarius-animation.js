// 원화의 얼굴·손·물병은 고정하고 머리 끝, 옷자락, 쏟아지는 물만 움직입니다.
const cache=new WeakMap(),SIDE=256,COUNT=16,TAU=Math.PI*2;
const clamp=n=>Math.max(0,Math.min(1,n));
const smooth=(a,b,n)=>{const t=clamp((n-a)/(b-a));return t*t*(3-2*t);};
export function aquariusWalkFrames(sprite,level){
  if(!sprite?.complete||!sprite.naturalWidth||level<2||level>4)return null;
  let levels=cache.get(sprite);if(!levels){levels=new Map();cache.set(sprite,levels);}if(levels.has(level))return levels.get(level);
  const original=document.createElement('canvas');original.width=original.height=SIDE;
  const ctx=original.getContext('2d',{willReadFrequently:true});ctx.drawImage(sprite,0,0,SIDE,SIDE);
  const source=ctx.getImageData(0,0,SIDE,SIDE).data,frames=[original];
  for(let frame=1;frame<COUNT;frame++){
    const phase=TAU*frame/COUNT,canvas=document.createElement('canvas');canvas.width=canvas.height=SIDE;
    const target=canvas.getContext('2d'),out=target.createImageData(SIDE,SIDE);
    for(let y=0;y<SIDE;y++)for(let x=0;x<SIDE;x++){
      const u=x/SIDE,v=y/SIDE;
      const hair=(1-smooth(.30,.40,u))*smooth(.23,.37,v)*(1-smooth(.57,.67,v));
      const cloth=smooth(.56,.68,v)*(1-smooth(.91,.98,v))*(1-smooth(.70,.78,u));
      const legs=smooth(.37,.43,u)*(1-smooth(.61,.66,u))*smooth(.66,.72,v);
      const water=smooth(level===4?.79:.69,level===4?.85:.78,u)*smooth(level===4?.37:.51,level===4?.46:.61,v);
      // 물결의 위상은 시간으로만 바뀌며, 물병 입구는 고정하고 아래쪽 물만 변형합니다.
      const flow=(Math.sin(phase-v*9)-Math.sin(-v*9))*water;
      const face=smooth(.28,.33,u)*(1-smooth(.65,.70,u))*smooth(.10,.14,v)*(1-smooth(.38,.43,v));
      const dx=(hair*1.8*Math.sin(phase)+cloth*(1-legs)*1.5*(Math.sin(phase+.3)-Math.sin(.3))+flow*1.4)*(1-face);
      const dy=(hair*.6*Math.sin(phase)+cloth*(1-legs)*.7*Math.sin(phase)+water*.8*Math.sin(phase))*(1-face);
      const sx=x-dx,sy=y-dy;if(sx<0||sy<0||sx>=SIDE-1||sy>=SIDE-1)continue;
      const ix=Math.floor(sx),iy=Math.floor(sy),fx=sx-ix,fy=sy-iy,index=(y*SIDE+x)*4;
      const a=(iy*SIDE+ix)*4,b=a+4,c=a+SIDE*4,d=c+4;
      for(let channel=0;channel<4;channel++)out.data[index+channel]=
        (source[a+channel]*(1-fx)+source[b+channel]*fx)*(1-fy)+(source[c+channel]*(1-fx)+source[d+channel]*fx)*fy;
    }
    target.putImageData(out,0,0);frames.push(canvas);
  }
  levels.set(level,frames);return frames;
}
