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
    const centralStar=map.objects.find(o=>o.id==='square');
    const x=centralStar?.x??map.width/2,y=(centralStar?.y??map.height/2)+160;
    ellipse(c,x,y+70,455,258,'#887ca62c');
    ellipse(c,x,y+26,443,257,'#bda9d6');ellipse(c,x,y+14,443,246,'#e7d6f0');
    ellipse(c,x,y,421,235,'#c9b7df');ellipse(c,x,y-10,419,229,'#fbf4fc');
    ellipse(c,x,y-16,380,203,'#e9e3f7');
    c.strokeStyle='#bfaed766';c.lineWidth=2;
    for(const r of [120,235,342]){c.beginPath();c.ellipse(x,y-16,r,r*.52,0,0,Math.PI*2);c.stroke();}
    for(let i=0;i<12;i++){const a=i*Math.PI/6;c.beginPath();c.moveTo(x+Math.cos(a)*120,y-16+Math.sin(a)*62);c.lineTo(x+Math.cos(a)*377,y-16+Math.sin(a)*198);c.stroke();}
    // 중앙의 낮은 제단 위에는 world.js가 커다란 별을 그립니다.
    ellipse(c,x,y-122,112,60,'#bba5d2');ellipse(c,x,y-135,114,58,'#fff6e1');ellipse(c,x,y-142,93,42,'#eddaec');
    for(const pillar of map.objects.filter(o=>o.kind==='pillar')){
      const px=pillar.x,py=pillar.y-34;
      ellipse(c,px,py+42,42,17,'#9583af25');
      c.fillStyle='#c8b5dc';c.beginPath();c.roundRect(px-22,py-105,44,144,14);c.fill();
      c.fillStyle='#faf0ff';c.beginPath();c.roundRect(px-19,py-106,29,142,12);c.fill();
      ellipse(c,px,py+34,35,12,'#f7eafa');ellipse(c,px,py-102,35,13,'#f9edff');
      star(c,px,py-129,20,'#ffeab3');ellipse(c,px-5,py-130,2,3,'#a08496');ellipse(c,px+5,py-130,2,3,'#a08496');
    }
    // 둥근 초승달 장식과 별사탕을 놓아 위압적인 건물 대신 쉬어가는 쉼터로 만듭니다.
    ellipse(c,x,y-316,44,44,'#fff0bf');ellipse(c,x+18,y-328,36,38,'#d3c0e2');
    for(let i=0;i<7;i++)star(c,x-180+i*60,y-266+Math.abs(i-3)*11,8,'#fff4d1');
  }),0,0);
}
export function drawCrossroads(ctx,map){
  ctx.drawImage(cached(map,c=>{
    sky(c,map.width,map.height,['#c4c3e8','#eadcf3','#cce6df']);
    ellipse(c,600,425,395,175,'#afa3ce');ellipse(c,600,407,395,175,'#f3eefb');
    // 북쪽 금빛 길, 남쪽 달빛 길, 동쪽 광장 길이 만나는 휴식처입니다.
    c.lineCap='round';
    for(const [x,y,color] of [[600,80,'#fff0c4'],[600,680,'#d6dcff'],[1120,380,'#e0f6eb']]){
      c.strokeStyle='#b5a8cb';c.lineWidth=66;c.beginPath();c.moveTo(600,400);c.lineTo(x,y);c.stroke();
      c.strokeStyle=color;c.lineWidth=54;c.stroke();
    }
    ellipse(c,600,400,135,76,'#e4d9f1');ellipse(c,600,390,135,76,'#fff8f1');
    star(c,600,387,42,'#f6d798');
    for(const [x,y] of [[335,330],[365,535],[860,535]]){ellipse(c,x,y+18,48,20,'#cfebdf');star(c,x,y-4,18,'#fff2c7');}
    c.textAlign='center';c.font='28px "Jua","Malgun Gothic",sans-serif';c.fillStyle='#786394';c.fillText(map.name,300,160);
    c.font='17px "Jua","Malgun Gothic",sans-serif';c.fillText('위로는 햇살, 아래로는 달빛',300,192);
  }),0,0);
}
export function drawParadise(ctx,map){
  ctx.drawImage(cached(map,c=>{
    const moon=map.theme==='moon-paradise',{bodyX:x,bodyY:y,bodyRadius:r}=map.vista;
    sky(c,map.width,map.height,moon?['#aaa9d9','#c2bae5','#96bdd6']:['#efbfbb','#ffe6be','#edd0e0']);
    ellipse(c,670,485,425,190,moon?'#9492c0':'#d7afab');
    ellipse(c,670,466,425,190,moon?'#e8e9fc':'#fff2db');
    ellipse(c,670,461,390,168,moon?'#cdd8f0':'#f9dfbe');
    c.strokeStyle=moon?'#f4f7ffb0':'#fffaf0c0';c.lineWidth=3;c.setLineDash([8,16]);c.beginPath();c.ellipse(670,461,366,145,0,0,Math.PI*2);c.stroke();c.setLineDash([]);
    for(let i=0;i<7;i++){
      const px=380+i*88,py=440+Math.sin(i*1.8)*75;
      ellipse(c,px,py+15,29,13,moon?'#b0b9e0':'#ebc9a5');
      star(c,px,py,moon?10:13,moon?'#f5f5ff':'#fff4ca');
    }
    const glow=c.createRadialGradient(x,y,r*.65,x,y,r*1.65);
    glow.addColorStop(0,moon?'#eeedffbb':'#fff4b9dd');glow.addColorStop(1,'#ffffff00');
    c.fillStyle=glow;c.fillRect(x-r*1.65,y-r*1.65,r*3.3,r*3.3);
    const body=c.createRadialGradient(x-r*.3,y-r*.3,r*.08,x,y,r);
    body.addColorStop(0,moon?'#fffdf7':'#fffde1');body.addColorStop(.65,moon?'#eeeaff':'#fff1ac');body.addColorStop(1,moon?'#bcbce9':'#f8cc79');
    ellipse(c,x,y,r,r,body);
    if(moon){
      for(const [dx,dy,size] of [[-.36,-.25,.15],[.27,-.4,.09],[.3,.29,.2],[-.31,.42,.08]]){
        ellipse(c,x+dx*r,y+dy*r,size*r,size*r,'#a9afd23d');
        ellipse(c,x+dx*r+size*r*.16,y+dy*r+size*r*.12,size*r*.76,size*r*.76,'#e5e7fa99');
      }
    }else{
      c.strokeStyle='#fff2b6aa';c.lineWidth=5;c.lineCap='round';
      for(let i=0;i<16;i++){const a=i*Math.PI/8;c.beginPath();c.moveTo(x+Math.cos(a)*r*1.12,y+Math.sin(a)*r*1.12);c.lineTo(x+Math.cos(a)*r*1.26,y+Math.sin(a)*r*1.26);c.stroke();}
    }
    c.textAlign='center';c.font='29px "Jua","Malgun Gothic",sans-serif';c.fillStyle=moon?'#5d608d':'#936967';c.fillText(map.name,820,140);
    c.font='17px "Jua","Malgun Gothic",sans-serif';c.fillText(moon?'은빛 달의 품으로, 한 걸음 더':'따스한 태양의 품으로, 한 걸음 더',820,174);
  }),0,0);
}
// 금빛 햇살과 은빛 달빛이 중앙에서 섞이는 별들의 쉼터입니다.
export function drawStarParadise(ctx,map){
  ctx.drawImage(cached(map,c=>{
    sky(c,map.width,map.height,['#bdb0d9','#e4cfe5','#a9c6df']);
    for(const [x,y,color] of [[220,180,'#ffe5a8'],[970,530,'#d5eaff']]){
      const light=c.createRadialGradient(x,y,20,x,y,590);light.addColorStop(0,color+'dd');light.addColorStop(1,color+'00');
      c.fillStyle=light;c.fillRect(x-590,y-590,1180,1180);
    }
    // 서로 엇갈리는 빛의 띠와 별 정원은 장식이므로 이동을 막지 않습니다.
    c.lineCap='round';
    for(const [i,color] of ['#ffe8b4','#f8e0ee','#dceaff'].entries()){
      c.strokeStyle=color+'77';c.lineWidth=22;c.beginPath();c.moveTo(-60,190+i*55);c.bezierCurveTo(310,650,760,90,1260,490+i*50);c.stroke();
    }
    ellipse(c,600,443,355,174,'#a995c4');ellipse(c,600,425,355,174,'#fff2f8');
    const floor=c.createLinearGradient(245,270,955,560);floor.addColorStop(0,'#fff0ce');floor.addColorStop(.5,'#eee1f6');floor.addColorStop(1,'#dce9fc');
    ellipse(c,600,418,331,154,floor);
    c.strokeStyle='#ffffffaa';c.lineWidth=3;for(const r of [112,220,300]){c.beginPath();c.ellipse(600,418,r,r*.45,0,0,Math.PI*2);c.stroke();}
    star(c,600,415,56,'#fff9e0');star(c,600,415,35,'#e0d4f4');
    for(let i=0;i<12;i++){const a=i*Math.PI/6;star(c,600+Math.cos(a)*282,418+Math.sin(a)*122,10,i%2?'#f4f8ff':'#ffe4a5');}
    ellipse(c,220,180,68,68,'#fff0b1');
    c.strokeStyle='#fff3c5';c.lineWidth=4;for(let i=0;i<12;i++){const a=i*Math.PI/6;c.beginPath();c.moveTo(220+Math.cos(a)*80,180+Math.sin(a)*80);c.lineTo(220+Math.cos(a)*94,180+Math.sin(a)*94);c.stroke();}
    ellipse(c,970,530,80,80,'#f4f4ff');ellipse(c,994,511,65,65,'#b9c8e1');
    c.textAlign='center';c.font='30px "Jua","Malgun Gothic",sans-serif';c.fillStyle='#76628e';c.fillText(map.name,815,173);
    c.font='17px "Jua","Malgun Gothic",sans-serif';c.fillText('햇살과 달빛이 만나, 별이 쉬어가는 곳',815,208);
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

// 별의 시작점은 거의 검은 공간 위에 별을 드문드문 놓습니다. 위치와 색은
// 맵 이름으로 만든 시드에서 결정해 캐시된 배경이 매번 달라지지 않게 합니다.
export function drawStarOrigin(ctx,map,time=0){
  const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
  ctx.drawImage(cached(map,c=>{
    c.fillStyle='#050710';c.fillRect(0,0,map.width,map.height);
    let seed=2166136261;
    for(const ch of `${map.id??''}:${map.name??'star-origin'}`){seed^=ch.charCodeAt(0);seed=Math.imul(seed,16777619);}
    const rand=()=>{seed=Math.imul(seed^seed>>>16,2246822519);seed=Math.imul(seed^seed>>>13,3266489917);return ((seed^seed>>>16)>>>0)/4294967296;};
    const colors=['#d9e7ff','#fff4d0','#cfe8ff','#eee1ff'];
    const cols=9,rows=5,cellW=map.width/cols,cellH=map.height/rows,stars=[];
    for(let row=0;row<rows;row++)for(let col=0;col<cols;col++){
      if(stars.length>=45)break;
      const x=(col+.5+(rand()-.5)*.58)*cellW;
      const y=(row+.5+(rand()-.5)*.58)*cellH;
      const r=.9+rand()*1.25;
      stars.push({x,y,r,color:colors[Math.floor(rand()*colors.length)],phase:rand()*Math.PI*2,speed:6000+rand()*6000,animated:stars.length<5+Math.floor(rand()*4)});
    }
    for(const s of stars){c.fillStyle=s.color;c.globalAlpha=.48+rand()*.35;c.beginPath();c.arc(s.x,s.y,s.r,0,Math.PI*2);c.fill();}
    c.globalAlpha=1;
  }),0,0);
  if(reduced)return;
  const elapsed=Number.isFinite(time)?time:0;
  let seed=2166136261;for(const ch of `${map.id??''}:${map.name??'star-origin'}`){seed^=ch.charCodeAt(0);seed=Math.imul(seed,16777619);}
  const rand=()=>{seed=Math.imul(seed^seed>>>16,2246822519);seed=Math.imul(seed^seed>>>13,3266489917);return ((seed^seed>>>16)>>>0)/4294967296;};
  const cols=9,rows=5,cellW=map.width/cols,cellH=map.height/rows,animated=[];
  for(let row=0;row<rows;row++)for(let col=0;col<cols;col++){
    const x=(col+.5+(rand()-.5)*.58)*cellW,y=(row+.5+(rand()-.5)*.58)*cellH,r=.9+rand()*1.25,color=['#d9e7ff','#fff4d0','#cfe8ff','#eee1ff'][Math.floor(rand()*4)],phase=rand()*Math.PI*2,speed=6000+rand()*6000;
    if(animated.length<5+Math.floor(rand()*4))animated.push({x,y,r,color,phase,speed});
  }
  ctx.save();
  for(const s of animated){
    const alpha=.42+.28*(.5+.5*Math.sin(elapsed*2*Math.PI/s.speed+s.phase));
    ctx.globalAlpha=alpha;ctx.fillStyle=s.color;ctx.beginPath();ctx.arc(s.x,s.y,s.r,0,Math.PI*2);ctx.fill();
    ctx.globalAlpha=alpha*.14;ctx.beginPath();ctx.arc(s.x,s.y,s.r*3.2,0,Math.PI*2);ctx.fill();
  }
  ctx.restore();
}
