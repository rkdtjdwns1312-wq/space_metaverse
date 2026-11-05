// Small, steady four-point stars for the forgotten constellation's shared gathering skill.
export function drawGatherStar(ctx,x,y,r=16,quiet=false){
 ctx.save();ctx.translate(x,y);ctx.fillStyle='#fffdf8';ctx.shadowColor='#f4edff';ctx.shadowBlur=quiet?0:5;
 ctx.beginPath();ctx.moveTo(0,-r);ctx.quadraticCurveTo(r*.14,-r*.14,r,0);ctx.quadraticCurveTo(r*.14,r*.14,0,r);ctx.quadraticCurveTo(-r*.14,r*.14,-r,0);ctx.quadraticCurveTo(-r*.14,-r*.14,0,-r);ctx.closePath();ctx.fill();
 ctx.shadowBlur=0;ctx.fillStyle='#fff';ctx.beginPath();ctx.arc(0,0,Math.max(1,r*.12),0,Math.PI*2);ctx.fill();ctx.restore();
}

export function drawGatherCount(ctx,x,headY,count,quiet=false){
 if(!count)return;
 const size=count>10?3.7:4.5,gap=count>10?9:11,start=x-(count-1)*gap/2;
 for(let i=0;i<count;i++)drawGatherStar(ctx,start+i*gap,headY,size,quiet);
}
