const pips=[[],[[0,0]],[[-1,-1],[1,1]],[[-1,-1],[0,0],[1,1]],[[-1,-1],[1,-1],[-1,1],[1,1]],[[-1,-1],[1,-1],[0,0],[-1,1],[1,1]]];

// The plaza's small ivory and pale-yellow lights, with four short rays and a steady centre.
export function drawQuietStar(ctx,x,y,r,time=0){
 const pulse=time?1+.065*Math.sin(time/530):1;
 ctx.save();ctx.translate(x,y);ctx.scale(r*pulse,r*pulse);ctx.fillStyle='#fff0af';
 ctx.beginPath();ctx.moveTo(0,-1);ctx.quadraticCurveTo(.09,-.11,.85,0);ctx.quadraticCurveTo(.09,.11,0,1);ctx.quadraticCurveTo(-.09,.11,-.85,0);ctx.quadraticCurveTo(-.09,-.11,0,-1);ctx.fill();
 ctx.fillStyle='#fffefa';ctx.beginPath();ctx.arc(0,0,.17,0,2*Math.PI);ctx.fill();ctx.restore();
}
export function drawConstellationLine(ctx,links,scale=1){
 if(links.linked<2)return;
 ctx.save();ctx.lineWidth=Math.max(4,2/scale);ctx.lineJoin='round';ctx.lineCap='round';ctx.strokeStyle='#ffdc4c';ctx.beginPath();
 links.stars.slice(0,links.linked).forEach(({x,y},i)=>{if(i===0)ctx.moveTo(x,y);else ctx.lineTo(x,y);});
 ctx.stroke();ctx.restore();
}
export function drawConstellationPoint(ctx,star,linked,radius,time=0){
 const {x,y,number}=star;
 drawQuietStar(ctx,x,y,radius*1.09,time);
 ctx.save();ctx.translate(x,y);ctx.scale(radius,radius);
 ctx.fillStyle='#f9e6a7';ctx.beginPath();ctx.arc(0,0,.71,0,2*Math.PI);ctx.fill();
 if(number<=linked){ctx.strokeStyle='#ffdc4c';ctx.lineWidth=.08;ctx.stroke();}
 ctx.fillStyle='#16102b';for(const [dx,dy] of pips[number]){ctx.beginPath();ctx.arc(dx*.27,dy*.27,.13,0,2*Math.PI);ctx.fill();}
 ctx.restore();
}
