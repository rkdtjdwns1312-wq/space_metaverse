const image=new Image();
image.src='/assets/monsters/spirit-king-blue-star.webp';

export function drawSpiritBlueStar(ctx,star,now=Date.now()){
  const seconds=Math.max(0,Math.ceil((star.endsAt-now)/1000)),pulse=.94+Math.sin(now/180)*.06;
  ctx.save();ctx.translate(star.x,star.y);ctx.scale(pulse,pulse);
  const glow=ctx.createRadialGradient(0,0,star.radius*.25,0,0,star.radius*1.8);
  glow.addColorStop(0,'#8deeffb0');glow.addColorStop(.65,'#4cc8ff48');glow.addColorStop(1,'#4cc8ff00');
  ctx.fillStyle=glow;ctx.beginPath();ctx.arc(0,0,star.radius*1.8,0,Math.PI*2);ctx.fill();
  if(image.complete&&image.naturalWidth)ctx.drawImage(image,-star.radius*1.4,-star.radius*1.4,star.radius*2.8,star.radius*2.8);
  else{ctx.fillStyle='#70d9ff';ctx.strokeStyle='#f1fcff';ctx.lineWidth=3;ctx.beginPath();
    for(let i=0;i<10;i++){const a=-Math.PI/2+i*Math.PI/5,r=star.radius*(i%2?.45:1);i?ctx.lineTo(Math.cos(a)*r,Math.sin(a)*r):ctx.moveTo(Math.cos(a)*r,Math.sin(a)*r);}ctx.closePath();ctx.fill();ctx.stroke();}
  ctx.restore();
  ctx.save();ctx.font='bold 16px "Jua","Malgun Gothic",sans-serif';ctx.textAlign='center';ctx.textBaseline='middle';
  ctx.lineWidth=4;ctx.strokeStyle='#24395c';ctx.fillStyle='#fff';ctx.strokeText(String(seconds),star.x,star.y+star.radius+10);ctx.fillText(String(seconds),star.x,star.y+star.radius+10);ctx.restore();
}
