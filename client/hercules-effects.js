import {HERCULES_VFX} from '/shared/hercules-skills.js';

const images=new Map();
const softened=new Map(),shields=new Map();
function imageOf(id){const spec=HERCULES_VFX[id];if(!spec)return null;
  if(!images.has(id)){const image=new Image();image.src=spec.url;images.set(id,image);}
  const image=images.get(id);return image.complete&&image.naturalWidth?image:null;
}
function effectCell(id,index){
  const image=imageOf(id);if(!image)return null;const key=id+':'+index;if(softened.has(key))return softened.get(key);
  const c=document.createElement('canvas');c.width=c.height=256;const g=c.getContext('2d');
  g.drawImage(image,(index%6)*256,Math.floor(index/6)*256,256,256,0,0,256,256);
  // 원화 셀 끝의 강한 빛은 투명하게 이어져 사각 잘림선을 남기지 않습니다.
  g.globalCompositeOperation='destination-in';
  for(const vertical of [false,true]){
    const fade=g.createLinearGradient(0,0,vertical?0:256,vertical?256:0);
    fade.addColorStop(0,'#0000');fade.addColorStop(.035,'#000');fade.addColorStop(.965,'#000');fade.addColorStop(1,'#0000');
    g.fillStyle=fade;g.fillRect(0,0,256,256);
  }
  softened.set(key,c);return c;
}
function frame(ctx,id,index,size){const image=id==='attack'?imageOf(id):effectCell(id,index);if(!image)return;
  if(id==='attack')ctx.drawImage(image,(index%6)*256,Math.floor(index/6)*256,256,256,-size/2,-size/2,size,size);
  else ctx.drawImage(image,-size/2,-size/2,size,size);
}
function shieldArt(stage){
  if(shields.has(stage))return shields.get(stage);
  const image=imageOf(`skill-lv${stage}`);if(!image)return null;
  // 폭82px의 직사각 crop 대신 방패 전체 윤곽을 따라 추출합니다. 좌우 테두리와 아래 꼭짓점을 보존합니다.
  const points=stage===2?[[128,69],[181,92],[183,136],[172,176],[130,214],[87,179],[75,135],[77,93]]:
    stage===3?[[129,81],[169,100],[171,128],[156,163],[129,188],[103,165],[88,132],[88,102]]:
      [[130,103],[174,121],[173,162],[156,193],[131,219],[104,195],[82,161],[82,122]];
  const c=document.createElement('canvas');c.width=c.height=256;const g=c.getContext('2d');
  g.drawImage(image,4*256,0,256,256,0,0,256,256);
  const mask=document.createElement('canvas');mask.width=mask.height=256;const m=mask.getContext('2d');
  m.fillStyle='#fff';m.filter='blur(1px)';m.beginPath();points.forEach(([x,y],i)=>i?m.lineTo(x,y):m.moveTo(x,y));m.closePath();m.fill();
  g.globalCompositeOperation='destination-in';g.drawImage(mask,0,0);
  const effects=document.createElement('canvas');effects.width=effects.height=256;const e=effects.getContext('2d');
  e.drawImage(effectCell(`skill-lv${stage}`,4),0,0);e.globalCompositeOperation='destination-out';e.drawImage(mask,0,0);
  const top=Math.min(...points.map(p=>p[1])),bottom=Math.max(...points.map(p=>p[1]));
  const art={image:c,effects,centerY:(top+bottom)/2,height:bottom-top};shields.set(stage,art);return art;
}
export function drawHerculesAttack(ctx,hit,elapsedMs,reducedMotion=false){
  if(hit.kind!=='hercules-attack')return false;
  ctx.save();ctx.translate(hit.x+hit.dx*hit.reach,hit.y+hit.dy*hit.reach);
  if(hit.dx<0){ctx.scale(-1,1);ctx.rotate(Math.atan2(hit.dy,-hit.dx));}
  else ctx.rotate(Math.atan2(hit.dy,hit.dx));
  frame(ctx,'attack',reducedMotion?12:Math.min(23,Math.floor(elapsedMs/(hit.durationMs||550)*24)),hit.size*1.25);
  ctx.restore();return true;
}
export function drawHerculesShield(ctx,shield,elapsedMs,reducedMotion=false){
  const duration=shield.durationMs||5000,elapsed=Math.max(0,Math.min(duration,elapsedMs));
  if(elapsed>=duration)return;
  const phase=Math.max(0,Math.min(1,elapsed/1000,(duration-elapsed)/1000)),ease=phase*phase*(3-2*phase);
  const art=shieldArt(shield.stage);if(!art)return;
  ctx.save();ctx.globalAlpha*=ease;
  const scale=shield.size*2.0/art.height*(.75+.25*ease);
  ctx.scale(scale,scale);
  if(phase<1&&shield.stage===2){ctx.save();ctx.globalAlpha*=Math.sin(phase*Math.PI)*(reducedMotion?.3:.8);ctx.drawImage(art.effects,-128,-art.centerY);ctx.restore();}
  ctx.drawImage(art.image,-128,-art.centerY);ctx.restore();
}
export function drawHerculesBurst(ctx,burst,elapsedMs,reducedMotion=false){
  ctx.save();ctx.translate(burst.x,burst.y);
  const progress=Math.min(1,elapsedMs/550);
  frame(ctx,`skill-lv${burst.stage}`,reducedMotion?15:Math.min(23,14+Math.floor(progress*10)),burst.size*(1.8+progress*2));
  ctx.restore();
}
