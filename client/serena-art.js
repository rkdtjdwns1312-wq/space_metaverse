// Twelve painted poses share a 256×512 canvas and the same foot anchor.
export const SERENA_ART={src:'/assets/monsters/serena.png',columns:4,rows:3,frameWidth:256,frameHeight:512,footY:496};
let image;
export function preloadSerenaArt(){if(!image&&typeof Image!=='undefined'){image=new Image();image.src=SERENA_ART.src;}return image?.decode();}
export function serenaBounds(m){const height=m.radius*2.7,width=height/2,bottom=m.y+m.radius*.9;return {width,height,top:bottom-height*496/512,bottom:bottom+height*16/512};}
const clamp=x=>Math.max(0,Math.min(1,x));
export function serenaPose(m,time,attack,now=Date.now()){
  if(m.warning&&m.warning.endsAt>now){
    const elapsed=now-(m.warning.startsAt??m.warning.endsAt-2000);
    return 4+Math.min(5,clamp(elapsed/1350)*5);
  }
  if(attack&&time-attack.startedAt<800)return 9+clamp((time-attack.startedAt)/800)*2;
  return m.moving?(time%1200)/300:0;
}
export function drawSerena(ctx,m,time,attack){
  if(m.shape!=='serena')return false;if(!ctx)return true;
  if(!image)void preloadSerenaArt()?.catch(()=>{});
  if(!image?.complete||!image.naturalWidth)return true;
  const pose=serenaPose(m,time,attack);
  const frame=pose<4?Math.round(pose)%4:Math.min(11,Math.round(pose));
  const {width,height,top}=serenaBounds(m);
  // 다른 자세를 반투명하게 겹치면 팔·머리 윤곽이 이중으로 보입니다.
  // 위치 이동 보간은 world에 맡기고 몸 그림은 항상 한 장만 선명하게 그립니다.
  ctx.drawImage(image,(frame%4)*256,Math.floor(frame/4)*512,256,512,m.x-width/2,top,width,height);
  return true;
}
// The blast is centered on the server's warning circle, including when it misses.
export function drawSerenaExplosion(ctx,hit,progress){
  const radius=hit.warningRadius;
  if(!radius)return;
  const p=clamp(progress),r=radius*(.15+.85*Math.sin(Math.min(1,p*2)*Math.PI/2));
  ctx.save();ctx.translate(hit.warningX,hit.warningY);ctx.globalAlpha=(1-p)*.9;
  const glow=ctx.createRadialGradient(0,0,0,0,0,r);
  glow.addColorStop(0,'#fffef8');glow.addColorStop(.3,'#fff1bbee');glow.addColorStop(.7,'#bdacff99');glow.addColorStop(1,'#bda7ff00');
  ctx.fillStyle=glow;ctx.beginPath();ctx.arc(0,0,r,0,Math.PI*2);ctx.fill();
  ctx.strokeStyle='#fff4c1';ctx.lineWidth=4*(1-p)+1;ctx.beginPath();ctx.arc(0,0,r*.85,0,Math.PI*2);ctx.stroke();
  for(let i=0;i<12;i++){
    const angle=i*Math.PI/6,d=radius*p*.9,x=Math.cos(angle)*d,y=Math.sin(angle)*d,s=(1-p)*12;
    ctx.fillStyle=i%2?'#eee5ff':'#fff9df';ctx.beginPath();ctx.moveTo(x,y-s);ctx.lineTo(x+s*.3,y);ctx.lineTo(x,y+s);ctx.lineTo(x-s*.3,y);ctx.closePath();ctx.fill();
  }
  ctx.restore();
}
