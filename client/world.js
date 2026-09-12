import { mapOf, PLAZA_ID, PLANET, STREET_ID, MAP, STREET, templateOf } from '/shared/config.js';
import * as config from '/shared/config.js';
const CHAT=config.CHAT||{bubbleMs:4000};
const NEAR=(config.RULES?.radius||16)+(config.INTERACT?.radius||40);
// 여러 캔버스(광장 지도·아바타 카드 일러스트)에서 함께 쓰는 별 그리기.
function drawStar(ctx,x,y,r,fill){
  ctx.beginPath();for(let i=0;i<10;i++){const a=-Math.PI/2+i*Math.PI/5,s=i%2?r*.47:r;
    i?ctx.lineTo(x+Math.cos(a)*s,y+Math.sin(a)*s):ctx.moveTo(x+Math.cos(a)*s,y+Math.sin(a)*s);}
  ctx.closePath();ctx.fillStyle=fill;ctx.fill();
}
// Canvas renderer만 교체하면 서버 규칙을 바꾸지 않고 그림을 바꿀 수 있습니다.
// 행성은 정적 목록이 아니라 room.planets 스냅샷(가변 개수, 최대 PLANET.maxPerRoom)입니다.
export function createWorld(canvas) {
  const ctx=canvas.getContext('2d'); let players=[],selfId=null,planets=[],proposals=[],myMapId=PLAZA_ID,placement=null,placing=false;
  const points=new Map(),bubbles=new Map();
  const stars=Array.from({length:105},(_,i)=>({x:(i*137+41)%1200,y:(i*191+23)%760,r:i%5===0?2:1}));
  const star=(x,y,r,fill)=>drawStar(ctx,x,y,r,fill);
  function currentMap(){return mapOf(myMapId,planets.map(p=>({...p,kind:'planet'})));}
  function placementOk(pt){
    const r=PLANET.radius+(config.RULES?.radius||16);
    if(pt.x<r||pt.y<r||pt.x>1200-r||pt.y>760-r)return false;
    if((PLANET.reserved||[]).some(z=>{const cx=Math.max(z.x,Math.min(pt.x,z.x+z.width)),cy=Math.max(z.y,Math.min(pt.y,z.y+z.height));return Math.hypot(pt.x-cx,pt.y-cy)<PLANET.radius;}))return false;
    const bodies=[...mapOf(PLAZA_ID,[]).objects,...planets,...proposals];
    return !bodies.some(o=>Math.hypot(pt.x-o.x,pt.y-o.y)<PLANET.radius+(o.radius||PLANET.radius)+PLANET.minGap);
  }
  // 행성 종류(templateOf(o.templateId).look)에 따라 겉모습을 다르게 꾸며 줍니다. 종류를 모르면 장식 없이 기본 모양만 그립니다.
  function drawPlanetLook(o,template,time){
    const look=template.look;
    if(look==='ribbon'){
      ctx.save();ctx.beginPath();ctx.arc(o.x,o.y,o.radius,0,Math.PI*2);ctx.clip();
      ctx.translate(o.x,o.y);ctx.rotate(-.5);ctx.fillStyle='#ffffff59';ctx.fillRect(-o.radius*1.3,-10,o.radius*2.6,20);
      ctx.restore();
    } else if(look==='stripes'){
      ctx.save();ctx.beginPath();ctx.arc(o.x,o.y,o.radius,0,Math.PI*2);ctx.clip();
      ctx.fillStyle='#ffffff4a';for(let i=-1;i<=1;i++)ctx.fillRect(o.x-o.radius,o.y+i*16-6,o.radius*2,8);
      ctx.restore();
    } else if(look==='pages'){
      ctx.strokeStyle='#ffffff66';ctx.lineWidth=2;
      for(let i=0;i<3;i++){ctx.beginPath();ctx.arc(o.x,o.y+6,o.radius*.5+i*8,.15*Math.PI,.85*Math.PI);ctx.stroke();}
    } else if(look==='shield'){
      ctx.strokeStyle='#ffffff80';ctx.lineWidth=3;ctx.beginPath();ctx.arc(o.x,o.y,o.radius-6,0,Math.PI*2);ctx.stroke();
      ctx.strokeStyle='#ffffff45';ctx.lineWidth=2;ctx.beginPath();ctx.arc(o.x,o.y,o.radius-12,0,Math.PI*2);ctx.stroke();
    } else if(look==='ball'){
      for(let i=0;i<5;i++){const a=-Math.PI/2+i*2*Math.PI/5,r=o.radius*.55;
        ctx.fillStyle='#5c5470aa';ctx.beginPath();ctx.arc(o.x+Math.cos(a)*r,o.y+Math.sin(a)*r,4,0,Math.PI*2);ctx.fill();}
    } else if(look==='plate'){
      ctx.strokeStyle='#ffffff70';ctx.lineWidth=2;
      ctx.beginPath();ctx.arc(o.x,o.y,o.radius-8,0,Math.PI*2);ctx.stroke();
      ctx.beginPath();ctx.arc(o.x,o.y,o.radius-16,0,Math.PI*2);ctx.stroke();
    } else if(look==='bolts'){
      for(let i=0;i<6;i++){const a=i*Math.PI/3,r=o.radius-9;
        ctx.fillStyle='#5c5470cc';ctx.beginPath();ctx.arc(o.x+Math.cos(a)*r,o.y+Math.sin(a)*r,3,0,Math.PI*2);ctx.fill();}
    } else if(look==='coins'){
      for(const [dx,dy] of [[-14,-8],[10,-14],[2,12]]){
        ctx.fillStyle='#fff3b0cc';ctx.beginPath();ctx.arc(o.x+dx,o.y+dy,7,0,Math.PI*2);ctx.fill();
        ctx.strokeStyle='#c9a13ecc';ctx.lineWidth=1.4;ctx.stroke();
      }
    } else if(look==='heart'){
      const hg=ctx.createRadialGradient(o.x,o.y,4,o.x,o.y,o.radius*1.3);hg.addColorStop(0,'#ff9fc355');hg.addColorStop(1,'#ff9fc300');
      ctx.fillStyle=hg;ctx.fillRect(o.x-o.radius*1.3,o.y-o.radius*1.3,o.radius*2.6,o.radius*2.6);
    } else if(look==='sparkle'){
      for(let i=0;i<3;i++){const phase=(time||0)/300+i*2,r=o.radius*.6;
        const sx=o.x+Math.cos(phase+i)*r*.5,sy=o.y+Math.sin(phase*1.3+i)*r*.5;
        ctx.save();ctx.globalAlpha=(Math.sin(phase*2+i)+1)/2*.7+.3;star(sx,sy,5,'#ffe59b');ctx.restore();
      }
    } else if(look==='splash'){
      for(const [c,dx,dy] of [['#ff8fa8',-16,-10],['#8fd0ff',10,-14],['#ffe08f',-4,12],['#b78fff',14,8]]){
        ctx.fillStyle=c+'cc';ctx.beginPath();ctx.arc(o.x+dx,o.y+dy,5,0,Math.PI*2);ctx.fill();
      }
    } else if(look==='stars'){
      star(o.x-14,o.y-16,6,'#fff3c2');star(o.x+16,o.y-10,5,'#fff3c2');
      ctx.strokeStyle='#ffffff55';ctx.lineWidth=2;ctx.beginPath();ctx.arc(o.x,o.y,o.radius-5,0,Math.PI*2);ctx.stroke();
    } else if(look==='eye'){
      ctx.strokeStyle='#4a4361aa';ctx.lineWidth=3;ctx.beginPath();ctx.arc(o.x,o.y,o.radius*.5,0,Math.PI*2);ctx.stroke();
      ctx.fillStyle='#4a4361cc';ctx.beginPath();ctx.arc(o.x,o.y,6,0,Math.PI*2);ctx.fill();
    }
  }
  // 광장 지도의 행성 하나(구체+하이라이트+내 소속 테두리+종류별 장식+가운데 아이콘)를 그립니다.
  function drawPlanet(o,myDept,time){
    const fill=ctx.createRadialGradient(o.x-22,o.y-25,5,o.x,o.y,o.radius);
    fill.addColorStop(0,'#ffffff');fill.addColorStop(.3,o.color);fill.addColorStop(1,o.color);
    ctx.fillStyle=fill;ctx.beginPath();ctx.arc(o.x,o.y,o.radius,0,Math.PI*2);ctx.fill();
    ctx.strokeStyle='#ffffff77';ctx.lineWidth=8;ctx.beginPath();ctx.ellipse(o.x,o.y+10,o.radius+18,19,-.22,0,Math.PI*2);ctx.stroke();
    ctx.fillStyle='#ffffff38';ctx.beginPath();ctx.arc(o.x+20,o.y-13,12,0,Math.PI*2);ctx.fill();
    if(o.id===myDept){ctx.strokeStyle='#ffffffc5';ctx.lineWidth=3;ctx.beginPath();ctx.arc(o.x,o.y,o.radius+9,0,Math.PI*2);ctx.stroke();}
    const template=templateOf(o.templateId);
    if(template){
      drawPlanetLook(o,template,time);
      ctx.save();ctx.font='28px "Malgun Gothic",sans-serif';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(template.icon,o.x,o.y);ctx.restore();
    }
  }
  function drawMap(map,time){
    const g=ctx.createLinearGradient(0,0,1200,760);g.addColorStop(0,'#e2e9fa');g.addColorStop(.55,'#edebfc');g.addColorStop(1,'#e0edf4');
    ctx.fillStyle=g;ctx.fillRect(0,0,1200,760);
    for(const s of stars){ctx.fillStyle='#ffffffcc';ctx.beginPath();ctx.arc(s.x,s.y,s.r,0,Math.PI*2);ctx.fill();}
    ctx.strokeStyle='#d9d7ef';ctx.lineWidth=1;ctx.setLineDash([4,12]);
    ctx.beginPath();ctx.ellipse(600,380,370,265,0,0,Math.PI*2);ctx.stroke();ctx.setLineDash([]);
    ctx.strokeStyle='#b9b3d85c';ctx.strokeRect(16,16,1168,728);
    const me=players.find(p=>p.id===selfId),myDept=me?.departmentId;
    for(const o of map.objects){
      ctx.fillStyle='#9387b017';ctx.beginPath();ctx.ellipse(o.x,o.y+o.radius*.8,o.radius*1.08,o.radius*.4,0,0,Math.PI*2);ctx.fill();
      if(o.kind==='star'){
        const glow=ctx.createRadialGradient(o.x,o.y,10,o.x,o.y,110);glow.addColorStop(0,'#ffe9a970');glow.addColorStop(1,'#ffe9a900');
        ctx.fillStyle=glow;ctx.fillRect(o.x-110,o.y-110,220,220);star(o.x,o.y,o.radius,'#fff2c9');star(o.x,o.y,o.radius-7,o.color);
      } else if(o.kind==='gate'){
        drawGate(o);continue;
      } else {
        drawPlanet(o,myDept,time);
      }
      // 가장자리 행성의 긴 이름이 캔버스 밖으로 잘리지 않도록 이름표 x를 안쪽으로 밀어 넣습니다.
      ctx.font='600 17px "Malgun Gothic",sans-serif';ctx.textAlign='center';ctx.fillStyle='#716389';
      const half=ctx.measureText(o.name).width/2+8,lx=Math.min(1200-half,Math.max(half,o.x));
      ctx.fillText(o.name,lx,o.y+o.radius+37);
      if(o.kind==='planet'){ctx.font='12px "Malgun Gothic",sans-serif';ctx.fillStyle='#938aab';ctx.fillText('소속 '+(o.memberCount||0)+'명',lx,o.y+o.radius+53);}
    }
    for(const o of proposals){
      ctx.save();ctx.globalAlpha=.6;ctx.setLineDash([5,7]);ctx.strokeStyle=o.color;ctx.lineWidth=3;
      ctx.beginPath();ctx.arc(o.x,o.y,PLANET.radius,0,Math.PI*2);ctx.stroke();ctx.restore();
      const template=templateOf(o.templateId);
      if(template){ctx.save();ctx.globalAlpha=.85;ctx.font='22px "Malgun Gothic",sans-serif';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(template.icon,o.x,o.y);ctx.restore();}
      ctx.font='600 15px "Malgun Gothic",sans-serif';ctx.textAlign='center';ctx.fillStyle='#716389';
      ctx.fillText(o.name,o.x,o.y+PLANET.radius+22);
      ctx.font='11px "Malgun Gothic",sans-serif';ctx.fillStyle='#a09ab7';
      ctx.fillText('승인 기다리는 중',o.x,o.y+PLANET.radius+38);
    }
    if(placing||placement){
      // 배치 모드: 행성을 만들 수 없는 예약 구역(이동 버튼 자리)을 빗금으로 보여 줍니다.
      for(const z of PLANET.reserved||[]){
        ctx.save();ctx.fillStyle='#9a92b41f';ctx.fillRect(z.x,z.y,z.width,z.height);
        ctx.strokeStyle='#9a92b4';ctx.lineWidth=1;ctx.setLineDash([3,5]);ctx.strokeRect(z.x+.5,z.y+.5,z.width-1,z.height-1);ctx.restore();
        ctx.font='12px "Malgun Gothic",sans-serif';ctx.textAlign='center';ctx.fillStyle='#8f84a6';ctx.fillText(z.label||'만들 수 없는 자리',z.x+z.width/2,z.y+22);
      }
    }
    if(placement){
      // 서버와 같은 규칙으로 미리 보여 주기만 합니다(경계·별·행성·신청과의 간격·예약 구역). 최종 판정은 서버가 합니다.
      const ok=placementOk(placement),color=ok?'#6353ae':'#d0506a';
      ctx.save();ctx.setLineDash([6,6]);ctx.strokeStyle=color;ctx.lineWidth=2;
      ctx.beginPath();ctx.arc(placement.x,placement.y,PLANET.radius,0,Math.PI*2);ctx.stroke();ctx.restore();
      ctx.font='600 13px "Malgun Gothic",sans-serif';ctx.textAlign='center';ctx.fillStyle=color;
      ctx.fillText(ok?'여기에 만들기':'여기는 안 돼요 · 다른 자리를 골라요',placement.x,placement.y+PLANET.radius+20);
    }
    if(planets.length===0){
      ctx.font='15px "Malgun Gothic",sans-serif';ctx.fillStyle='#8f84a6';ctx.textAlign='center';
      ctx.fillText('아직 행성이 없어요. 행성 만들기로 첫 행성을 신청해보세요!',600,700);
    }
    ctx.font='14px "Malgun Gothic",sans-serif';ctx.fillStyle='#a09ab7';ctx.fillText('우리의 첫 번째 우주',600,660);
  }
  // 두 맵(광장·별빛 거리) 공통 문 그림: 보라 아치 + 은은한 빛 + 이름표.
  function drawGate(o){
    const glowR=o.radius*2.4;
    const glow=ctx.createRadialGradient(o.x,o.y,6,o.x,o.y,glowR);
    glow.addColorStop(0,'#d9c6f273');glow.addColorStop(1,'#d9c6f200');
    ctx.fillStyle=glow;ctx.fillRect(o.x-glowR,o.y-glowR,glowR*2,glowR*2);
    const postW=12,postH=o.radius*2.1,archY=o.y-o.radius*.5;
    ctx.fillStyle='#b7a4dd';
    ctx.fillRect(o.x-o.radius-postW,archY-postH/2,postW,postH);
    ctx.fillRect(o.x+o.radius,archY-postH/2,postW,postH);
    ctx.beginPath();ctx.arc(o.x,archY,o.radius+postW,Math.PI,0);ctx.closePath();
    ctx.fillStyle='#c9b7ec';ctx.fill();ctx.strokeStyle='#9d86c9';ctx.lineWidth=3;ctx.stroke();
    ctx.fillStyle='#ffffffb0';ctx.beginPath();ctx.arc(o.x,archY,o.radius*.6,0,Math.PI*2);ctx.fill();
    ctx.font='600 15px "Malgun Gothic",sans-serif';ctx.textAlign='center';ctx.fillStyle='#6a5f8a';
    ctx.fillText(o.name,o.x,archY+o.radius+postH/2+26);
  }
  // 천막 모양 별상점: 둥근 지붕 + 줄무늬 + 간판.
  function drawShop(o){
    const w=190,h=150,x=o.x-w/2,topY=o.y-h/2;
    ctx.fillStyle='#00000018';ctx.beginPath();ctx.ellipse(o.x,o.y+h*.42,w*.55,14,0,0,Math.PI*2);ctx.fill();
    ctx.fillStyle='#fffaf0';ctx.beginPath();ctx.roundRect(x,topY+34,w,h-34,16);ctx.fill();
    ctx.strokeStyle='#e7c96a';ctx.lineWidth=2;ctx.stroke();
    const stripes=6,sw=w/stripes;
    for(let i=0;i<stripes;i++){
      ctx.fillStyle=i%2?'#f5bace':'#ffffff';
      ctx.beginPath();ctx.moveTo(x+i*sw,topY+34);ctx.quadraticCurveTo(x+i*sw+sw/2,topY-16,x+(i+1)*sw,topY+34);ctx.closePath();ctx.fill();
      ctx.strokeStyle='#e0a9b8';ctx.lineWidth=1;ctx.stroke();
    }
    ctx.fillStyle='#6353ae';ctx.beginPath();ctx.roundRect(o.x-56,o.y-6,112,36,10);ctx.fill();
    ctx.font='700 19px "Malgun Gothic",sans-serif';ctx.fillStyle='#ffffff';ctx.textAlign='center';ctx.fillText('별상점',o.x,o.y+19);
    star(o.x-72,o.y+44,11,'#ffe59b');star(o.x+72,o.y+44,11,'#ffe59b');
  }
  // 가로등: 기둥 + 빛 번짐.
  function drawLamp(o){
    const poleTop=o.y-o.radius*1.6;
    ctx.strokeStyle='#c8bde8';ctx.lineWidth=5;ctx.beginPath();ctx.moveTo(o.x,o.y+o.radius*.6);ctx.lineTo(o.x,poleTop);ctx.stroke();
    const glow=ctx.createRadialGradient(o.x,poleTop,2,o.x,poleTop,42);
    glow.addColorStop(0,'#fff2c9cc');glow.addColorStop(1,'#fff2c900');
    ctx.fillStyle=glow;ctx.fillRect(o.x-42,poleTop-42,84,84);
    ctx.fillStyle=o.color||'#fff2c9';ctx.beginPath();ctx.arc(o.x,poleTop,10,0,Math.PI*2);ctx.fill();
    ctx.strokeStyle='#e8dba0';ctx.lineWidth=2;ctx.stroke();
  }
  function drawStreet(map){
    const g=ctx.createLinearGradient(0,0,1200,760);g.addColorStop(0,'#372f5c');g.addColorStop(.55,'#453a72');g.addColorStop(1,'#332a54');
    ctx.fillStyle=g;ctx.fillRect(0,0,1200,760);
    for(const s of stars){ctx.fillStyle='#ffffffd0';ctx.beginPath();ctx.arc(s.x,s.y*.82+30,s.r,0,Math.PI*2);ctx.fill();}
    ctx.fillStyle='#5d5093';ctx.fillRect(0,540,1200,220);
    ctx.fillStyle='#7266a6aa';ctx.fillRect(0,540,1200,8);
    ctx.strokeStyle='#ffffff26';ctx.lineWidth=1;ctx.strokeRect(16,16,1168,728);
    for(const o of map.objects){
      if(o.kind==='gate'){drawGate(o);continue;}
      if(o.kind==='shop'){drawShop(o);continue;}
      if(o.kind==='lamp'){drawLamp(o);continue;}
    }
    ctx.font='13px "Malgun Gothic",sans-serif';ctx.fillStyle='#ded6f5';ctx.textAlign='center';
    ctx.fillText(map.name+' · 별상점에서 별 파편으로 물건을 사고팔아요',600,46);
  }
  function drawInterior(map){
    ctx.fillStyle='#f3f1fb';ctx.fillRect(0,0,1200,760);
    const g=ctx.createLinearGradient(0,0,1200,760);g.addColorStop(0,map.color);g.addColorStop(1,'#ffffff');
    ctx.save();ctx.globalAlpha=.18;ctx.fillStyle=g;ctx.fillRect(0,0,1200,760);ctx.restore();
    for(const s of stars){ctx.fillStyle='#ffffffb0';ctx.beginPath();ctx.arc(s.x,s.y,s.r,0,Math.PI*2);ctx.fill();}
    ctx.strokeStyle='#b9b3d85c';ctx.strokeRect(16,16,1168,728);
    const planet=planets.find(p=>p.id===map.planetId);
    for(const o of map.objects){
      if(o.kind==='board'){
        // 규칙은 최대 8줄·한 줄 40자입니다. 줄 수에 맞춰 게시판을 키우고, 긴 줄은 글자를 줄여 판 안에 담습니다.
        const rules=(planet?.rules||[]).slice(0,8);
        const w=520,h=Math.max(120,74+rules.length*19),bx=o.x-w/2,by=o.y-h/2;
        ctx.fillStyle=o.color||'#fff6d6';ctx.strokeStyle='#e7d9a8';ctx.lineWidth=3;
        ctx.beginPath();ctx.roundRect(bx,by,w,h,22);ctx.fill();ctx.stroke();
        const boardTemplate=templateOf(planet?.templateId);
        ctx.font='700 18px "Malgun Gothic",sans-serif';ctx.textAlign='center';ctx.fillStyle='#8a6d2d';
        ctx.fillText((boardTemplate?boardTemplate.icon+' ':'')+(planet?.name||'행성')+' 규칙',o.x,by+30);
        let size=15;
        while(size>10&&rules.some(line=>{ctx.font=size+'px "Malgun Gothic",sans-serif';return ctx.measureText(line).width>w-32;}))size--;
        ctx.font=size+'px "Malgun Gothic",sans-serif';ctx.fillStyle='#6b5c3c';
        rules.forEach((line,i)=>ctx.fillText(line,o.x,by+56+i*19));
      } else if(o.kind==='door'){
        ctx.fillStyle='#d9d3f2';ctx.beginPath();ctx.arc(o.x,o.y,o.radius,Math.PI,0);ctx.fill();ctx.fillRect(o.x-o.radius,o.y,o.radius*2,24);
        ctx.strokeStyle='#b6a9df';ctx.lineWidth=2;ctx.beginPath();ctx.arc(o.x,o.y,o.radius,Math.PI,0);ctx.stroke();ctx.strokeRect(o.x-o.radius,o.y,o.radius*2,24);
        ctx.font='600 14px "Malgun Gothic",sans-serif';ctx.textAlign='center';ctx.fillStyle='#6a5f8a';ctx.fillText(o.name,o.x,o.y+o.radius+30);
      }
    }
    ctx.font='13px "Malgun Gothic",sans-serif';ctx.fillStyle='#9b93b3';ctx.textAlign='center';
    ctx.fillText(map.name+' · 소속 친구들만의 공간',600,46);
  }
  function drawBubble(id,x,y){
    const b=bubbles.get(id);if(!b)return;
    if(Date.now()>b.until){bubbles.delete(id);return;}
    ctx.font='600 13px "Malgun Gothic",sans-serif';
    const w=Math.min(230,ctx.measureText(b.text).width+22),h=30,bx=x-w/2,by=y-54;
    ctx.fillStyle='#ffffff';ctx.strokeStyle='#d8d3ea';ctx.lineWidth=1.5;
    ctx.beginPath();ctx.roundRect(bx,by,w,h,10);ctx.fill();ctx.stroke();
    ctx.beginPath();ctx.moveTo(x-6,by+h-1);ctx.lineTo(x+6,by+h-1);ctx.lineTo(x,by+h+8);ctx.closePath();ctx.fillStyle='#ffffff';ctx.fill();
    ctx.fillStyle='#524969';ctx.textAlign='center';ctx.fillText(b.text,x,by+h/2+4);
  }
  function drawAvatar(p,time){
    const point=points.get(p.id)||{x:p.x,y:p.y};
    const reduce=window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    point.x+=(p.x-point.x)*(reduce?1:.35);point.y+=(p.y-point.y)*(reduce?1:.35);points.set(p.id,point);
    const x=point.x,y=point.y;
    const effects=(p.effects||[]).slice(0,3);
    ctx.save();ctx.globalAlpha=p.connected?1:.45;
    if(effects.some(e=>e.style==='glow')){
      const glow=ctx.createRadialGradient(x,y,4,x,y,40);glow.addColorStop(0,'#fff2b880');glow.addColorStop(1,'#fff2b800');
      ctx.fillStyle=glow;ctx.fillRect(x-40,y-40,80,80);
    }
    ctx.fillStyle='#7f719a29';ctx.beginPath();ctx.ellipse(x,y+19,19,6,0,0,Math.PI*2);ctx.fill();
    if(p.id===selfId){ctx.strokeStyle='#8061b0';ctx.lineWidth=2;ctx.beginPath();ctx.ellipse(x,y+18,23,8,0,0,Math.PI*2);ctx.stroke();}
    ctx.translate(x,y);
    ctx.beginPath();for(let i=0;i<9;i++){const a=i*2*Math.PI/9,r=16+[1,0,2,-1,1,0,1,-1,0][i];
      i?ctx.lineTo(Math.cos(a)*r,Math.sin(a)*r):ctx.moveTo(Math.cos(a)*r,Math.sin(a)*r);}
    ctx.closePath();ctx.fillStyle='#c9c1e6';ctx.fill();ctx.strokeStyle='#aaa0ce';ctx.lineWidth=2;ctx.stroke();
    ctx.fillStyle='#afa4d0';ctx.beginPath();ctx.arc(-6,-7,4,0,Math.PI*2);ctx.fill();ctx.beginPath();ctx.arc(9,8,3,0,Math.PI*2);ctx.fill();
    ctx.fillStyle='#524969';ctx.beginPath();ctx.arc(-4,1,1.6,0,Math.PI*2);ctx.arc(4,1,1.6,0,Math.PI*2);ctx.fill();
    ctx.strokeStyle='#66577e';ctx.lineWidth=1.3;ctx.beginPath();ctx.arc(0,5,3,.15,Math.PI-.15);ctx.stroke();
    if(p.role==='teacher')star(0,-31,7,'#d2a454');
    if(effects.some(e=>e.style==='sparkle')){
      for(let i=0;i<3;i++){
        const phase=(time||0)/260+i*2.1,r=24+i*3;
        const sx=Math.cos(phase)*r,sy=Math.sin(phase*1.4)*r*.6-14;
        ctx.save();ctx.globalAlpha=((Math.sin(phase*2)+1)/2*.85+.15)*(p.connected?1:.45);star(sx,sy,3.5,'#ffe59b');ctx.restore();
      }
    }
    ctx.translate(-x,-y);
    if(effects.length){ctx.font='14px "Malgun Gothic",sans-serif';ctx.textAlign='center';ctx.fillStyle='#3a3450';ctx.fillText(effects.map(e=>e.icon).join(' '),x,y-74);}
    ctx.font=(p.id===selfId?'700 ':'500 ')+'14px "Malgun Gothic",sans-serif';
    const label=p.nickname+(p.id===selfId?' · 나':'')+(!p.connected?' · 연결 중':'');
    const w=ctx.measureText(label).width+16;ctx.fillStyle='#ffffffdf';
    ctx.beginPath();ctx.roundRect(x-w/2,y+29,w,24,9);ctx.fill();
    ctx.fillStyle=p.id===selfId?'#6e4d9b':'#57536d';ctx.textAlign='center';ctx.fillText(label,x,y+46);
    if(effects.some(e=>e.style==='happy')){ctx.font='14px "Malgun Gothic",sans-serif';ctx.fillStyle='#c9628f';ctx.fillText('♪',x+w/2+11,y+46);}
    drawBubble(p.id,x,y);
    ctx.restore();
  }
  function frame(t){
    ctx.clearRect(0,0,1200,760);
    const map=currentMap();
    if(myMapId===PLAZA_ID)drawMap(map,t);else if(myMapId===STREET_ID)drawStreet(map);else drawInterior(map);
    for(const p of players.filter(p=>(p.mapId||PLAZA_ID)===myMapId).sort((a,b)=>a.y-b.y))drawAvatar(p,t);
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
  return {
    setRoom(room,id){
      players=(room?.players||[]).map(p=>({...p}));selfId=id;
      planets=room?.planets||[];proposals=room?.proposals||[];
      myMapId=players.find(p=>p.id===id)?.mapId||PLAZA_ID;
      for(const key of points.keys())if(!players.some(p=>p.id===key))points.delete(key);
      for(const key of bubbles.keys())if(!players.some(p=>p.id===key))bubbles.delete(key);
    },
    positions(data){for(const [id,x,y] of data.positions){const p=players.find(p=>p.id===id);if(p){p.x=x;p.y=y;}}},
    say(playerId,text,ms){
      if(!playerId)return;const str=String(text);
      bubbles.set(playerId,{text:str.length>24?str.slice(0,24)+'…':str,until:Date.now()+(ms||CHAT.bubbleMs||4000)});
    },
    nearby(){
      const me=players.find(p=>p.id===selfId);if(!me)return null;
      if(myMapId===PLAZA_ID){
        const candidates=[...planets.map(o=>({...o,kind:'planet'})),...MAP.objects.filter(o=>o.kind==='gate')];
        let best=null,bestDist=Infinity;
        for(const o of candidates){
          const d=Math.hypot(me.x-o.x,me.y-o.y);
          if(d<=(o.radius||PLANET.radius)+NEAR&&d<bestDist){best=o;bestDist=d;}
        }
        if(!best)return null;
        return best.kind==='gate'?{kind:'gate',target:best.target,name:best.name}:{kind:'planet',id:best.id,name:best.name};
      }
      if(myMapId===STREET_ID){
        const candidates=STREET.objects.filter(o=>o.kind==='gate'||o.kind==='shop');
        let best=null,bestDist=Infinity;
        for(const o of candidates){
          const d=Math.hypot(me.x-o.x,me.y-o.y);
          if(d<=(o.radius||PLANET.radius)+NEAR&&d<bestDist){best=o;bestDist=d;}
        }
        if(!best)return null;
        return best.kind==='gate'?{kind:'gate',target:best.target,name:best.name}:{kind:'shop',name:best.name};
      }
      const door=mapOf(myMapId,planets).objects.find(o=>o.kind==='door');
      if(door&&Math.hypot(me.x-door.x,me.y-door.y)<=door.radius+NEAR)return {kind:'door'};
      return null;
    },
    currentMapId(){return myMapId;},
    setPlacement(point){placement=point;},
    setPlacing(value){placing=Boolean(value);},
    placementOk,
    planetAt(point){
      return planets.find(o=>Math.hypot(point.x-o.x,point.y-o.y)<=(o.radius||PLANET.radius))||null;
    },
    canvasPoint(e){
      // 좁은 화면(휴대폰)에서는 캔버스가 object-fit:contain으로 줄어들어 위아래에 빈 띠가 생깁니다.
      // 그 여백을 빼고 실제 그림이 그려진 영역 기준으로 계산해야 누른 자리와 행성 위치가 맞습니다.
      const rect=canvas.getBoundingClientRect();
      const scale=Math.min(rect.width/canvas.width,rect.height/canvas.height);
      if(!(scale>0))return {x:0,y:0};
      const left=rect.left+(rect.width-canvas.width*scale)/2,top=rect.top+(rect.height-canvas.height*scale)/2;
      return {x:Math.round((e.clientX-left)/scale),y:Math.round((e.clientY-top)/scale)};
    }
  };
}
// 아바타 카드(.card-art)의 작은 일러스트 캔버스에 그 플레이어의 소행성만 크게 그립니다(이름표 없음).
// player.deptIcon을 넘기면 오른쪽 위에 소속 행성 아이콘을 함께 그립니다(호출하는 쪽에서 미리 조회해 붙여 줍니다).
export function renderPortrait(canvas,player,effects){
  const ctx=canvas.getContext('2d'),w=canvas.width,h=canvas.height;
  ctx.clearRect(0,0,w,h);
  const g=ctx.createLinearGradient(0,0,w,h);g.addColorStop(0,'#2c2350');g.addColorStop(1,'#4a3a7a');
  ctx.fillStyle=g;ctx.fillRect(0,0,w,h);
  for(let i=0;i<24;i++){const sx=(i*53+17)%w,sy=(i*37+11)%h,r=i%4===0?1.6:1;
    ctx.fillStyle='#ffffffb0';ctx.beginPath();ctx.arc(sx,sy,r,0,Math.PI*2);ctx.fill();}
  const cx=w/2,cy=h/2+8,list=(effects||player?.effects||[]).slice(0,3);
  if(list.some(e=>e.style==='glow')){
    const glow=ctx.createRadialGradient(cx,cy,6,cx,cy,60);glow.addColorStop(0,'#fff2b880');glow.addColorStop(1,'#fff2b800');
    ctx.fillStyle=glow;ctx.fillRect(cx-60,cy-60,120,120);
  }
  ctx.save();ctx.translate(cx,cy);
  ctx.beginPath();for(let i=0;i<9;i++){const a=i*2*Math.PI/9,r=34+[2,0,4,-2,2,0,2,-2,0][i];
    i?ctx.lineTo(Math.cos(a)*r,Math.sin(a)*r):ctx.moveTo(Math.cos(a)*r,Math.sin(a)*r);}
  ctx.closePath();ctx.fillStyle='#c9c1e6';ctx.fill();ctx.strokeStyle='#aaa0ce';ctx.lineWidth=3;ctx.stroke();
  ctx.fillStyle='#afa4d0';ctx.beginPath();ctx.arc(-13,-15,8,0,Math.PI*2);ctx.fill();ctx.beginPath();ctx.arc(19,17,6,0,Math.PI*2);ctx.fill();
  ctx.fillStyle='#524969';ctx.beginPath();ctx.arc(-8,2,3.2,0,Math.PI*2);ctx.arc(8,2,3.2,0,Math.PI*2);ctx.fill();
  ctx.strokeStyle='#66577e';ctx.lineWidth=2.4;ctx.beginPath();ctx.arc(0,10,6,.15,Math.PI-.15);ctx.stroke();
  if(player?.role==='teacher')drawStar(ctx,0,-58,13,'#d2a454');
  if(list.some(e=>e.style==='sparkle')){
    for(let i=0;i<3;i++){
      const phase=Date.now()/260+i*2.1,r=46+i*5;
      const sx=Math.cos(phase)*r,sy=Math.sin(phase*1.4)*r*.6-24;
      ctx.save();ctx.globalAlpha=(Math.sin(phase*2)+1)/2*.85+.15;drawStar(ctx,sx,sy,6,'#ffe59b');ctx.restore();
    }
  }
  ctx.restore();
  if(list.length){ctx.font='16px "Malgun Gothic",sans-serif';ctx.textAlign='center';ctx.fillStyle='#f2ecff';ctx.fillText(list.map(e=>e.icon).join(' '),cx,cy-52);}
  if(player?.deptIcon){ctx.save();ctx.font='22px "Malgun Gothic",sans-serif';ctx.textAlign='right';ctx.textBaseline='top';ctx.fillText(player.deptIcon,w-10,10);ctx.restore();}
}
