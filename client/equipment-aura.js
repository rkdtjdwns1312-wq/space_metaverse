import {equipmentAuraOf} from '/shared/equipment.js';
const cache=new WeakMap(),SIDE=256,PAD=28,TOTAL=SIDE+PAD*2;
function layer(sprite,kind){
  let kinds=cache.get(sprite);if(!kinds){kinds=new Map();cache.set(sprite,kinds);}if(kinds.has(kind))return kinds.get(kind);
  const source=document.createElement('canvas');source.width=source.height=SIDE;
  const sc=source.getContext('2d',{willReadFrequently:true});sc.drawImage(sprite,0,0,SIDE,SIDE);
  const pixels=sc.getImageData(0,0,SIDE,SIDE).data,edges=[];
  for(let y=8;y<246;y+=7)for(let x=8;x<246;x+=7){const i=(y*SIDE+x)*4;if(pixels[i+3]>150&&pixels[((y-6)*SIDE+x)*4+3]<40)edges.push({x,y});}
  sc.globalCompositeOperation='source-in';
  if(kind==='rainbow'){const g=sc.createLinearGradient(0,0,SIDE,SIDE);['#fa7fca','#ff9865','#ffe27b','#81efb1','#69dfff','#aa9aff'].forEach((color,i)=>g.addColorStop(i/5,color));sc.fillStyle=g;}
  else sc.fillStyle=kind==='blue'?'#72caff':'#ffad53';
  sc.fillRect(0,0,SIDE,SIDE);
  const canvas=document.createElement('canvas');canvas.width=canvas.height=TOTAL;const ctx=canvas.getContext('2d');
  const spread=kind==='rainbow'?12:5;ctx.shadowColor=kind==='blue'?'#429aff':kind==='orange'?'#ff8836':'#c5baff';ctx.shadowBlur=kind==='rainbow'?20:12;
  for(let i=0;i<12;i++){const a=i*Math.PI/6;ctx.globalAlpha=.42;ctx.drawImage(source,PAD+Math.cos(a)*spread,PAD+Math.sin(a)*spread);}
  ctx.shadowBlur=0;ctx.globalAlpha=1;ctx.globalCompositeOperation='destination-out';ctx.drawImage(sprite,PAD,PAD,SIDE,SIDE);
  const value={canvas,edges};kinds.set(kind,value);return value;
}
export function drawEquipmentAura(ctx,sprite,player,size,time,reducedMotion=false){
  const kind=player.equipmentAura??equipmentAuraOf(player);if(!kind||!['blue','orange','rainbow'].includes(kind)||!sprite)return false;
  const {canvas,edges}=layer(sprite,kind),phase=reducedMotion?0:time/1200;
  ctx.save();ctx.globalAlpha*=.77+.13*Math.sin(phase);const width=size*TOTAL/SIDE;
  ctx.drawImage(canvas,-width/2,-width/2,width,width);
  if(kind==='rainbow')for(let i=0;i<edges.length;i+=3){
    const edge=edges[i],rise=reducedMotion?12:12+7*Math.sin(phase+i*.7),x=(edge.x-128)*size/SIDE,y=(edge.y-128)*size/SIDE;
    ctx.strokeStyle=`hsla(${(i*37+(reducedMotion?0:time*.02))%360},90%,78%,.7)`;ctx.lineWidth=Math.max(1,size*.009);ctx.lineCap='round';
    ctx.beginPath();ctx.moveTo(x,y);ctx.quadraticCurveTo(x+Math.sin(phase+i)*size*.015,y-rise*size/512,x,y-rise*size/256);ctx.stroke();
  }
  ctx.restore();return true;
}
