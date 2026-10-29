// 세레나의 별 표식은 월드 좌표로 그려 캐릭터와 함께 움직입니다.
// 피해 판정·시간·카운트는 서버 값만 사용하며 연출은 판정에 관여하지 않습니다.
const TAU=Math.PI*2;
function star(ctx,x,y,r,inner=.48){
  ctx.beginPath();
  for(let i=0;i<10;i++){const a=-Math.PI/2+i*Math.PI/5,d=i%2?r*inner:r;i?ctx.lineTo(x+Math.cos(a)*d,y+Math.sin(a)*d):ctx.moveTo(x+Math.cos(a)*d,y+Math.sin(a)*d);}
  ctx.closePath();
}
function sparkle(ctx,x,y,r,color){
  ctx.save();ctx.fillStyle=color;ctx.beginPath();ctx.moveTo(x,y-r);ctx.quadraticCurveTo(x+1,y-1,x+r,y);ctx.quadraticCurveTo(x+1,y+1,x,y+r);ctx.quadraticCurveTo(x-1,y+1,x-r,y);ctx.quadraticCurveTo(x-1,y-1,x,y-r);ctx.fill();ctx.restore();
}
const active=(list,now)=>(list||[]).filter(e=>e.startsAt<=now&&e.endsAt>now);
const pointOf=(id,players,points)=>{const player=players.find(p=>p.id===id&&p.connected);return player?{player,point:points.get(id)||player}:null;};

export function drawSerenaGround(ctx,effects,players,points,now,reduced=false){
  for(const mark of active(effects?.marks,now).filter(m=>m.kind==='red')){
    const at=pointOf(mark.playerId,players,points);if(!at)continue;
    const {x,y}=at.point,r=mark.radiusX,ry=mark.radiusY||r*.55;
    const pulse=reduced?0:Math.sin((now-mark.startsAt)/260)*.04;
    ctx.save();ctx.translate(x,y);ctx.scale(1,ry/r);
    const glow=ctx.createRadialGradient(0,0,r*.15,0,0,r);glow.addColorStop(0,'#d7385e09');glow.addColorStop(.78,'#f7577c23');glow.addColorStop(1,'#ff92a84a');
    ctx.fillStyle=glow;ctx.strokeStyle='#ffd2ca';ctx.lineWidth=3;ctx.shadowColor='#ff547b';ctx.shadowBlur=14;
    ctx.beginPath();ctx.arc(0,0,r,0,TAU);ctx.fill();ctx.stroke();ctx.shadowBlur=0;
    ctx.strokeStyle='#b64269';ctx.lineWidth=2;ctx.setLineDash([7,10]);ctx.beginPath();ctx.arc(0,0,r*.92,0,TAU);ctx.stroke();ctx.setLineDash([]);
    for(let i=0;i<8;i++){const a=i*TAU/8;star(ctx,Math.cos(a)*r,Math.sin(a)*r,7+pulse*20);ctx.fillStyle='#ffe6b9';ctx.fill();ctx.strokeStyle='#b84d73';ctx.lineWidth=1.5;ctx.stroke();}
    ctx.restore();
  }
  for(const warning of active(effects?.warnings,now)){
    const {x,y,radius:r}=warning,progress=Math.max(0,Math.min(1,(now-warning.startsAt)/(warning.endsAt-warning.startsAt)));
    ctx.save();ctx.translate(x,y);
    ctx.fillStyle='#f4b84b30';ctx.strokeStyle='#fff1ba';ctx.lineWidth=3;ctx.shadowColor='#ffd35b';ctx.shadowBlur=13;
    ctx.beginPath();ctx.arc(0,0,r,0,TAU);ctx.fill();ctx.stroke();ctx.shadowBlur=0;
    ctx.strokeStyle='#c18540';ctx.lineWidth=2;ctx.beginPath();ctx.arc(0,0,r*.8,0,TAU);ctx.stroke();
    ctx.strokeStyle='#fff6d5';ctx.lineWidth=5;ctx.beginPath();ctx.arc(0,0,r*.9,-Math.PI/2,-Math.PI/2+TAU*progress);ctx.stroke();
    star(ctx,0,0,r*.43);ctx.fillStyle='#ffe8a0';ctx.fill();ctx.strokeStyle='#ac763e';ctx.lineWidth=2;ctx.stroke();
    ctx.font='20px "Jua","Malgun Gothic",sans-serif';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillStyle='#8b4a55';ctx.fillText('!',0,1);ctx.restore();
  }
  for(const burst of active(effects?.bursts,now)){
    const life=Math.max(0,Math.min(1,(now-burst.startsAt)/(burst.endsAt-burst.startsAt))),r=burst.radius*(.5+life*.7);
    const red=burst.kind==='red';
    ctx.save();ctx.translate(burst.x,burst.y);ctx.globalAlpha=1-life;
    const glow=ctx.createRadialGradient(0,0,0,0,0,r*1.3);glow.addColorStop(0,'#fffdf1');glow.addColorStop(.3,red?'#ff8d9fbb':'#fff0a8bb');glow.addColorStop(1,red?'#ed3c6400':'#ffc56a00');ctx.fillStyle=glow;ctx.fillRect(-r*1.3,-r*1.3,r*2.6,r*2.6);
    ctx.strokeStyle=red?'#ffc6cc':'#ffe7a5';ctx.lineWidth=4;ctx.beginPath();ctx.ellipse(0,0,r,r*.72,0,0,TAU);ctx.stroke();
    for(let i=0;i<8;i++){const a=i*TAU/8;const d=r*(reduced?.6:.5+life*.5);sparkle(ctx,Math.cos(a)*d,Math.sin(a)*d*.8,8*(1-life)+3,i%2?'#fff9df':red?'#ff7a99':'#ffd58c');}
    ctx.restore();
  }
}

export function drawSerenaMarks(ctx,effects,players,points,avatarSizeOf,now,reduced=false){
  const marks=active(effects?.marks,now);
  for(const mark of marks){
    const at=pointOf(mark.playerId,players,points);if(!at)continue;
    const siblings=marks.filter(m=>m.playerId===mark.playerId),index=siblings.indexOf(mark);
    const size=avatarSizeOf(at.player),x=at.point.x+(index-(siblings.length-1)/2)*62;
    const y=at.point.y-size*.7-48+(reduced?0:Math.sin(now/330+index)*2.5),r=mark.kind==='black'?29:25;
    const palette=mark.kind==='black'?['#48445e','#0b0a17','#e4d6ff']:mark.kind==='red'?['#ffabb2','#bd365d','#ffe8bc']:['#fffbd5','#efbd49','#fff5cb'];
    ctx.save();ctx.translate(x,y);ctx.shadowColor=palette[2];ctx.shadowBlur=mark.kind==='black'?16:20;
    const gradient=ctx.createLinearGradient(-r,-r,r,r);gradient.addColorStop(0,palette[0]);gradient.addColorStop(1,palette[1]);
    star(ctx,0,0,r);ctx.fillStyle=gradient;ctx.fill();ctx.strokeStyle=palette[2];ctx.lineWidth=2.5;ctx.stroke();ctx.shadowBlur=0;
    if(mark.kind==='black'||mark.kind==='red'){
      const number=mark.kind==='red'?mark.requiredFriends:mark.remaining;
      ctx.font='24px "Jua","Malgun Gothic",sans-serif';ctx.textAlign='center';ctx.textBaseline='middle';ctx.lineWidth=3;ctx.strokeStyle=mark.kind==='red'?'#84213d':'#171326';ctx.strokeText(String(number),0,2);ctx.fillStyle='#fff7d9';ctx.fillText(String(number),0,2);
    }else{star(ctx,-3,-4,r*.3);ctx.fillStyle='#fffbe477';ctx.fill();}
    for(let i=0;i<3;i++){const a=i*TAU/3+(reduced?0:now/1500);sparkle(ctx,Math.cos(a)*(r+9),Math.sin(a)*(r+7),3, palette[2]);}
    ctx.font='12px "Jua","Malgun Gothic",sans-serif';ctx.textAlign='center';ctx.textBaseline='middle';ctx.strokeStyle='#473755';ctx.lineWidth=3;ctx.fillStyle='#fff7de';
    const label=(mark.kind==='black'?'접촉 ':mark.kind==='red'?`친구 ${mark.nearbyFriends||0}/${mark.requiredFriends}명 · `:'')+Math.ceil((mark.endsAt-now)/1000)+'초';ctx.strokeText(label,0,r+18);ctx.fillText(label,0,r+18);ctx.restore();
  }
}
