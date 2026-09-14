// 동화풍 배경은 한 번 그려 보관합니다. 매 프레임 복잡한 성운을 다시 그리지 않아
// 크롬북에서도 이동·채팅에 쓸 여유를 남깁니다. 외부 이미지로 교체하기 쉬운 모듈입니다.
const backgrounds=new Map();
document.fonts.load('20px Jua').then(()=>backgrounds.clear());
function ellipse(ctx,x,y,rx,ry,color){ctx.fillStyle=color;ctx.beginPath();ctx.ellipse(x,y,rx,ry,0,0,Math.PI*2);ctx.fill();}
function star(ctx,x,y,r,color){
  ctx.beginPath();for(let i=0;i<10;i++){const a=i*Math.PI/5-Math.PI/2,d=i%2?r*.48:r;i?ctx.lineTo(x+Math.cos(a)*d,y+Math.sin(a)*d):ctx.moveTo(x+Math.cos(a)*d,y+Math.sin(a)*d);}ctx.closePath();ctx.fillStyle=color;ctx.fill();
}
function sky(ctx,w,h,colors=['#b8b7e3','#d5c3e5','#a9cddf']){
  const g=ctx.createLinearGradient(0,0,w,h);g.addColorStop(0,colors[0]);g.addColorStop(.42,colors[1]);g.addColorStop(1,colors[2]);ctx.fillStyle=g;ctx.fillRect(0,0,w,h);
  for(let i=0;i<8;i++){
    const x=(i*731+240)%w,y=(i*433+90)%h,r=300+i%3*90;
    const glow=ctx.createRadialGradient(x,y,0,x,y,r);glow.addColorStop(0,i%2?'#fff0ee77':'#dcf7ef99');glow.addColorStop(1,'#ffffff00');ctx.fillStyle=glow;ctx.fillRect(x-r,y-r,r*2,r*2);
  }
  for(let i=0;i<Math.round(w*h/16000);i++){
    const x=(i*137+41)%w,y=(i*191+23)%h;
    if(i%7===0)star(ctx,x,y,4+i%4,'#fff6db');else ellipse(ctx,x,y,1.5,1.5,'#fffdf5b0');
  }
  // 작은 별자리 선은 배경 장식일 뿐 이동을 막지 않습니다.
  ctx.strokeStyle='#fff7ee66';ctx.lineWidth=2;
  for(let i=0;i<8;i++){const x=160+i*430,y=230+i%3*670;ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x+45,y+70);ctx.lineTo(x+125,y+45);ctx.stroke();}
}
function cached(map,draw){
  if(!backgrounds.has(map.id)){const canvas=document.createElement('canvas');canvas.width=map.width;canvas.height=map.height;draw(canvas.getContext('2d'));backgrounds.set(map.id,canvas);}
  return backgrounds.get(map.id);
}
export function drawTemple(ctx,map){
  ctx.drawImage(cached(map,c=>{
    sky(c,map.width,map.height);
    const x=map.width/2,y=1180;
    // 좌우 맵으로 이어지는 별빛 길. 부서행성 배치에서도 비워 두는 통로입니다.
    c.strokeStyle='#f7f1ff77';c.lineWidth=50;c.beginPath();c.moveTo(0,1200);c.lineTo(map.width,1200);c.stroke();
    c.strokeStyle='#ffffff88';c.lineWidth=3;c.setLineDash([5,22]);c.stroke();c.setLineDash([]);
    ellipse(c,x,y+70,455,258,'#887ca62c');
    ellipse(c,x,y+26,443,257,'#bda9d6');ellipse(c,x,y+14,443,246,'#e7d6f0');
    ellipse(c,x,y,421,235,'#c9b7df');ellipse(c,x,y-10,419,229,'#fbf4fc');
    ellipse(c,x,y-16,380,203,'#e9e3f7');
    c.strokeStyle='#bfaed766';c.lineWidth=2;
    for(const r of [120,235,342]){c.beginPath();c.ellipse(x,y-16,r,r*.52,0,0,Math.PI*2);c.stroke();}
    for(let i=0;i<12;i++){const a=i*Math.PI/6;c.beginPath();c.moveTo(x+Math.cos(a)*120,y-16+Math.sin(a)*62);c.lineTo(x+Math.cos(a)*377,y-16+Math.sin(a)*198);c.stroke();}
    // 중앙의 낮은 제단 위에는 world.js가 커다란 별을 그립니다.
    ellipse(c,x,1058,112,60,'#bba5d2');ellipse(c,x,1045,114,58,'#fff6e1');ellipse(c,x,1038,93,42,'#eddaec');
    for(const [px,py] of [[1480,1040],[2120,1040],[1510,1250],[2090,1250]]){
      ellipse(c,px,py+42,42,17,'#9583af25');
      c.fillStyle='#c8b5dc';c.beginPath();c.roundRect(px-22,py-105,44,144,14);c.fill();
      c.fillStyle='#faf0ff';c.beginPath();c.roundRect(px-19,py-106,29,142,12);c.fill();
      ellipse(c,px,py+34,35,12,'#f7eafa');ellipse(c,px,py-102,35,13,'#f9edff');
      star(c,px,py-129,20,'#ffeab3');ellipse(c,px-5,py-130,2,3,'#a08496');ellipse(c,px+5,py-130,2,3,'#a08496');
    }
    // 둥근 초승달 장식과 별사탕을 놓아 위압적인 건물 대신 쉬어가는 쉼터로 만듭니다.
    ellipse(c,x,864,44,44,'#fff0bf');ellipse(c,x+18,852,36,38,'#d3c0e2');
    for(let i=0;i<7;i++)star(c,x-180+i*60,914+Math.abs(i-3)*11,8,'#fff4d1');
    c.fillStyle='#8873a0';c.font='24px "Jua","Malgun Gothic",sans-serif';c.textAlign='center';c.fillText('별들이 잠시 쉬어가는 곳',x,1502);
  }),0,0);
}
export function drawGarden(ctx,map){
  ctx.drawImage(cached(map,c=>{
    sky(c,map.width,map.height,['#e9b5bd','#ffe1b5','#edc6e7']);ellipse(c,590,475,445,205,'#d6aaa9');ellipse(c,590,450,445,205,'#fff1d4');ellipse(c,590,445,406,179,'#f7dbbc');
    for(let i=0;i<11;i++){const x=210+(i*113)%750,y=260+(i*79)%320;ellipse(c,x,y,40,16,'#f5fff6');ellipse(c,x-14,y-11,23,23,'#f9fff4');ellipse(c,x+14,y-9,26,26,'#f9fff4');star(c,x,y-34,11,'#ffe7a8');}
    const sun=c.createRadialGradient(600,165,32,600,165,180);sun.addColorStop(0,'#fff5b6bb');sun.addColorStop(1,'#fff5b600');c.fillStyle=sun;c.fillRect(420,0,360,345);
    ellipse(c,600,165,62,62,'#fff2ad');c.strokeStyle='#fff4c6';c.lineWidth=4;for(let i=0;i<12;i++){const a=i*Math.PI/6;c.beginPath();c.moveTo(600+Math.cos(a)*76,165+Math.sin(a)*76);c.lineTo(600+Math.cos(a)*90,165+Math.sin(a)*90);c.stroke();}
    c.font='28px "Jua","Malgun Gothic",sans-serif';c.textAlign='center';c.fillStyle='#986c6b';c.fillText(map.name,600,640);
    c.font='17px "Jua","Malgun Gothic",sans-serif';c.fillText('따뜻한 별빛 아래, 잠시 쉬어가요',600,676);
  }),0,0);
}
export function drawRainbowSpace(ctx,map){
  ctx.drawImage(cached(map,c=>{
    sky(c,map.width,map.height,['#7771ad','#a78bbb','#647da6']);
    for(const [i,color] of ['#ffbbd9','#ffdba2','#bceacc','#b9deff','#ddc0ff'].entries()){
      const x=120+i*240,y=250+(i%2)*200,g=c.createRadialGradient(x,y,15,x,y,380);g.addColorStop(0,color+'a0');g.addColorStop(1,color+'00');c.fillStyle=g;c.fillRect(x-380,y-380,760,760);
      c.strokeStyle=color+'60';c.lineWidth=12;c.beginPath();c.moveTo(-50,560+i*20);c.bezierCurveTo(300,80+i*42,720,720-i*38,1250,180+i*30);c.stroke();
    }
  }),0,0);
}
export function drawValley(ctx,map,time){
  ctx.drawImage(cached(map,c=>{
    sky(c,map.width,map.height,['#9a9bc5','#bfc9e5','#c6b7df']);
    const path=()=>{c.beginPath();c.moveTo(-120,780);c.bezierCurveTo(450,780,340,210,1320,290);};
    for(const [width,color] of [[200,'#c7dcf22b'],[135,'#dceafd40'],[72,'#f2f5ff55'],[18,'#fff8ff55']]){c.strokeStyle=color;c.lineWidth=width;path();c.stroke();}
    c.font='29px Jua,sans-serif';c.textAlign='center';c.fillStyle='#6d6494';c.fillText(map.name,600,790);
    c.font='17px Jua,sans-serif';c.fillText('은하수가 들려주는 조용한 이야기',600,824);
  }),0,0);
  const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches,t=reduced?0:time/90000;
  // 아주 느리게 이동하는 빛만 덧그립니다. 큰 배경은 캐시하고 화면 점멸은 하지 않습니다.
  ctx.save();for(let i=0;i<38;i++){
    const u=(i/38+t)%1,v=1-u,x=v*v*v*-120+3*v*v*u*450+3*v*u*u*340+u*u*u*1320;
    const y=v*v*v*780+3*v*v*u*780+3*v*u*u*210+u*u*u*290+(i%5-2)*12;
    ctx.globalAlpha=reduced?.55:.4+.25*Math.sin(time/1900+i);star(ctx,x,y,2.5+i%3,'#fffdf6');
  }ctx.restore();
}
