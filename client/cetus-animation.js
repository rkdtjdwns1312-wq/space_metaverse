// 원화를 유지한 채 8장의 걷기·오라 프레임을 첫 표시 때 한 번만 만듭니다.
// 이동 애니메이션의 박자는 이동속도와 독립적이라 빠르게 달려도 꼬리가 파닥거리지 않습니다.
const walkCache=new WeakMap(),auraCache=new WeakMap();
const SIDE=256,TAU=Math.PI*2;
const clamp=(n,min=0,max=1)=>Math.max(min,Math.min(max,n));
const smooth=(a,b,x)=>{const t=clamp((x-a)/(b-a));return t*t*(3-2*t);};
function canvas(size=SIDE){const c=document.createElement('canvas');c.width=c.height=size;return c;}
function sourcePixels(sprite){
  const c=canvas(),ctx=c.getContext('2d',{willReadFrequently:true});
  ctx.drawImage(sprite,0,0,SIDE,SIDE);
  return ctx.getImageData(0,0,SIDE,SIDE);
}
export function cetusWalkFrames(sprite){
  if(!sprite?.complete||!sprite.naturalWidth)return null;
  if(walkCache.has(sprite))return walkCache.get(sprite);
  const source=sourcePixels(sprite),frames=[];
  for(let frame=0;frame<8;frame++){
    const phase=TAU*frame/8,tailSwing=Math.sin(phase),nearSwing=Math.sin(phase+.55)-Math.sin(.55),farSwing=Math.sin(phase-.45)-Math.sin(-.45);
    const c=canvas(),ctx=c.getContext('2d'),out=ctx.createImageData(SIDE,SIDE);
    for(let y=0;y<SIDE;y++)for(let x=0;x<SIDE;x++){
      const u=x/SIDE,v=y/SIDE;
      const tail=(1-smooth(.25,.53,u))*smooth(.08,.2,v)*(1-smooth(.55,.75,v));
      const finNear=clamp(1-Math.hypot((u-.36)/.28,(v-.77)/.20));
      const finFar=clamp(1-Math.hypot((u-.88)/.16,(v-.76)/.20));
      const sx=Math.round(x-tail*2.8*tailSwing-finNear*1.5*nearSwing);
      const sy=Math.round(y-tail*8*tailSwing-finNear*4*nearSwing-finFar*3*farSwing);
      if(sx<0||sy<0||sx>=SIDE||sy>=SIDE)continue;
      const from=(sy*SIDE+sx)*4,to=(y*SIDE+x)*4;
      out.data[to]=source.data[from];out.data[to+1]=source.data[from+1];
      out.data[to+2]=source.data[from+2];out.data[to+3]=source.data[from+3];
    }
    ctx.putImageData(out,0,0);frames.push(c);
  }
  walkCache.set(sprite,frames);return frames;
}
function auraFrames(sprite,stage){
  if(!sprite?.complete||!sprite.naturalWidth)return null;
  let byStage=auraCache.get(sprite);if(!byStage){byStage=new Map();auraCache.set(sprite,byStage);}
  if(byStage.has(stage))return byStage.get(stage);
  const source=sourcePixels(sprite),tint=canvas(),tctx=tint.getContext('2d');
  tctx.putImageData(source,0,0);tctx.globalCompositeOperation='source-in';
  tctx.fillStyle=stage===2?'#2c9fff':stage===3?'#227dff':'#347aff';tctx.fillRect(0,0,SIDE,SIDE);
  const edges=[];
  if(stage>=3)for(let y=10;y<SIDE-10;y+=3)for(let x=10;x<SIDE-10;x+=3){
    const a=source.data[(y*SIDE+x)*4+3];if(a<120)continue;
    if(source.data[(y*SIDE+x-4)*4+3]<50||source.data[(y*SIDE+x+4)*4+3]<50||
      source.data[((y-4)*SIDE+x)*4+3]<50||source.data[((y+4)*SIDE+x)*4+3]<50){
      if(y<200&&Math.hypot(x-128,y-128)>45)edges.push({x,y});
    }
  }
  const frames=[];
  for(let frame=0;frame<8;frame++){
    const c=canvas(288),ctx=c.getContext('2d'),phase=TAU*frame/8;
    ctx.shadowColor=stage===4?'#258bff':'#56c9ff';ctx.shadowBlur=stage===2?11:stage===3?15:19;
    const radius=stage===2?2.2:stage===3?3.9:5.2;
    for(let direction=0;direction<12;direction++){
      const angle=TAU*direction/12,flutter=1+.13*Math.sin(phase+direction*.9);
      ctx.globalAlpha=stage===2?.22:.18;
      ctx.drawImage(tint,16+Math.cos(angle)*radius*flutter,16+Math.sin(angle)*radius*flutter);
    }
    ctx.shadowBlur=0;
    if(stage>=3){
      const step=stage===3?15:10;
      for(let index=frame%3;index<edges.length;index+=step){
        const edge=edges[index],x=edge.x+16,y=edge.y+16;
        const distance=Math.hypot(edge.x-128,edge.y-128)||1,nx=(edge.x-128)/distance,ny=(edge.y-128)/distance;
        const length=(stage===3?9:21)*(1+.25*Math.sin(phase+index*.19));
        ctx.strokeStyle=stage===3?'#7ad2ffc4':'#75b9ffdd';ctx.lineWidth=stage===3?1.8:3;
        ctx.shadowColor='#63baff';ctx.shadowBlur=stage===3?3:7;
        if(stage===4){
          const gradient=ctx.createLinearGradient(x,y,x+nx*length,y+ny*length);
          gradient.addColorStop(0,'#1e83ff75');gradient.addColorStop(.55,'#4ab8ffbb');gradient.addColorStop(1,'#b8ecff16');
          ctx.fillStyle=gradient;ctx.beginPath();ctx.moveTo(x-ny*3,y+nx*3);
          ctx.quadraticCurveTo(x+nx*length*.55-ny*4,y+ny*length*.55+nx*4,x+nx*length,y+ny*length);
          ctx.quadraticCurveTo(x+nx*length*.55+ny*4,y+ny*length*.55-nx*4,x+ny*3,y-nx*3);
          ctx.closePath();ctx.fill();
        }
        ctx.lineCap='round';ctx.beginPath();ctx.moveTo(x,y);
        ctx.quadraticCurveTo(x+nx*length*.55+Math.sin(phase+index)*2,y+ny*length*.55,
          x+nx*length,y+ny*length);ctx.stroke();
      }
    }
    frames.push(c);
  }
  byStage.set(stage,frames);return frames;
}
export function drawCetusAura(ctx,sprite,x,y,renderSize,stage,frame,opacity,facing=1){
  const frames=auraFrames(sprite,stage);if(!frames)return false;
  ctx.save();ctx.translate(x,y);ctx.scale(facing,1);ctx.globalAlpha*=opacity;
  // 288px 캔버스의 여백 16px이 실제 아바타의 256px 영역을 둘러싸게 정렬합니다.
  ctx.drawImage(frames[frame%8],-renderSize*288/512,-renderSize*288/512,renderSize*288/256,renderSize*288/256);
  ctx.restore();return true;
}
