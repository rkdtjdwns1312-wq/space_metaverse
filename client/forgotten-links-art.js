const pips=[[],[[0,0]],[[-1,-1],[1,1]],[[-1,-1],[0,0],[1,1]],[[-1,-1],[1,-1],[-1,1],[1,1]],[[-1,-1],[1,-1],[0,0],[-1,1],[1,1]]];

// The plaza's small ivory and pale-yellow lights, with four short rays and a steady centre.
export function drawQuietStar(ctx,x,y,r,time=0){
 const pulse=time?1+.065*Math.sin(time/530):1;
 ctx.save();ctx.translate(x,y);ctx.scale(r*pulse,r*pulse);ctx.fillStyle='#e5d49c';
 ctx.beginPath();ctx.moveTo(0,-1);ctx.quadraticCurveTo(.09,-.11,.85,0);ctx.quadraticCurveTo(.09,.11,0,1);ctx.quadraticCurveTo(-.09,.11,-.85,0);ctx.quadraticCurveTo(-.09,-.11,0,-1);ctx.fill();
 ctx.fillStyle='#f4edff';ctx.beginPath();ctx.arc(0,0,.17,0,2*Math.PI);ctx.fill();ctx.restore();
}
export function drawConstellationLine(ctx,links,scale=1){
 if(links.linked<2)return;
 ctx.save();ctx.lineWidth=Math.max(4,2/scale);ctx.lineJoin='round';ctx.lineCap='round';ctx.strokeStyle='#c8ad6e';ctx.beginPath();
 links.stars.slice(0,links.linked).forEach(({x,y},i)=>{if(i===0)ctx.moveTo(x,y);else ctx.lineTo(x,y);});
 ctx.stroke();ctx.restore();
}
export function drawConstellationPoint(ctx,star,linked,radius,time=0){
 const {x,y,number}=star;
 ctx.save();ctx.translate(x,y);ctx.scale(radius,radius);
 // Soft rounded gold points and layered ivory washes match the painted props.
 // The quiet, steady centre keeps all five dark pips readable during the pulse.
 const glow=ctx.createRadialGradient(0,0,.55,0,0,1.65);
 glow.addColorStop(0,'#f5df9940');glow.addColorStop(1,'#f5df9900');
 ctx.globalAlpha=time?.72+.13*Math.sin(time/650):.8;ctx.fillStyle=glow;ctx.fillRect(-1.65,-1.65,3.3,3.3);ctx.globalAlpha=1;
 const points=Array.from({length:10},(_,i)=>{const a=-Math.PI/2+i*Math.PI/5,r=i%2?.72:1.22;return {x:Math.cos(a)*r,y:Math.sin(a)*r};});
 ctx.beginPath();ctx.moveTo((points[9].x+points[0].x)/2,(points[9].y+points[0].y)/2);
 for(let i=0;i<10;i++){const p=points[i],next=points[(i+1)%10];ctx.quadraticCurveTo(p.x,p.y,(p.x+next.x)/2,(p.y+next.y)/2);}ctx.closePath();
 const gold=ctx.createLinearGradient(-.65,-1,.65,1.15);
 gold.addColorStop(0,'#fff5cc');gold.addColorStop(.43,'#efd794');gold.addColorStop(1,'#b58a4f');
 ctx.fillStyle=gold;ctx.fill();ctx.lineJoin='round';ctx.strokeStyle=number<=linked?'#fff1b5':'#9f784f';ctx.lineWidth=number<=linked?.065:.035;ctx.stroke();
 ctx.save();ctx.clip();
 const wash=ctx.createRadialGradient(-.15,-.22,.08,0,0,.8);wash.addColorStop(0,'#fff9dd');wash.addColorStop(.72,'#f5e5b6');wash.addColorStop(1,'#f5e5b600');
 ctx.fillStyle=wash;ctx.fillRect(-1,-1,2,2);
 ctx.strokeStyle='#fff8d240';ctx.lineWidth=.025;
 for(let i=0;i<5;i++){ctx.beginPath();ctx.moveTo(-1.1+i*.1,-.65+i*.39);ctx.quadraticCurveTo(-.1,-.8+i*.39,.95,-.52+i*.39);ctx.stroke();}ctx.restore();
 ctx.fillStyle='#16102b';for(const [dx,dy] of pips[number]){ctx.beginPath();ctx.arc(dx*.27,dy*.27,.13,0,2*Math.PI);ctx.fill();}
 ctx.restore();
}
