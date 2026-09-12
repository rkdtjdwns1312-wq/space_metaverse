import { mapOf, PLAZA_ID, PLANET, STREET_ID, MAP, STREET } from '/shared/config.js';
import * as config from '/shared/config.js';
const CHAT=config.CHAT||{bubbleMs:4000};
const NEAR=(config.RULES?.radius||16)+(config.INTERACT?.radius||40);
// Canvas renderer만 교체하면 서버 규칙을 바꾸지 않고 그림을 바꿀 수 있습니다.
// 행성은 정적 목록이 아니라 room.planets 스냅샷(가변 개수, 최대 PLANET.maxPerRoom)입니다.
export function createWorld(canvas) {
  const ctx=canvas.getContext('2d'); let players=[],selfId=null,planets=[],proposals=[],myMapId=PLAZA_ID,placement=null,placing=false;
  const points=new Map(),bubbles=new Map();
  const stars=Array.from({length:105},(_,i)=>({x:(i*137+41)%1200,y:(i*191+23)%760,r:i%5===0?2:1}));
  const star=(x,y,r,fill)=>{
    ctx.beginPath();for(let i=0;i<10;i++){const a=-Math.PI/2+i*Math.PI/5,s=i%2?r*.47:r;
      i?ctx.lineTo(x+Math.cos(a)*s,y+Math.sin(a)*s):ctx.moveTo(x+Math.cos(a)*s,y+Math.sin(a)*s);}
    ctx.closePath();ctx.fillStyle=fill;ctx.fill();
  };
  function currentMap(){return mapOf(myMapId,planets.map(p=>({...p,kind:'planet'})));}
  function placementOk(pt){
    const r=PLANET.radius+(config.RULES?.radius||16);
    if(pt.x<r||pt.y<r||pt.x>1200-r||pt.y>760-r)return false;
    if((PLANET.reserved||[]).some(z=>{const cx=Math.max(z.x,Math.min(pt.x,z.x+z.width)),cy=Math.max(z.y,Math.min(pt.y,z.y+z.height));return Math.hypot(pt.x-cx,pt.y-cy)<PLANET.radius;}))return false;
    const bodies=[...mapOf(PLAZA_ID,[]).objects,...planets,...proposals];
    return !bodies.some(o=>Math.hypot(pt.x-o.x,pt.y-o.y)<PLANET.radius+(o.radius||PLANET.radius)+PLANET.minGap);
  }
  function drawMap(map){
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
        const fill=ctx.createRadialGradient(o.x-22,o.y-25,5,o.x,o.y,o.radius);
        fill.addColorStop(0,'#ffffff');fill.addColorStop(.3,o.color);fill.addColorStop(1,o.color);
        ctx.fillStyle=fill;ctx.beginPath();ctx.arc(o.x,o.y,o.radius,0,Math.PI*2);ctx.fill();
        ctx.strokeStyle='#ffffff77';ctx.lineWidth=8;ctx.beginPath();ctx.ellipse(o.x,o.y+10,o.radius+18,19,-.22,0,Math.PI*2);ctx.stroke();
        ctx.fillStyle='#ffffff38';ctx.beginPath();ctx.arc(o.x+20,o.y-13,12,0,Math.PI*2);ctx.fill();
        if(o.kind==='planet'&&o.id===myDept){ctx.strokeStyle='#ffffffc5';ctx.lineWidth=3;ctx.beginPath();ctx.arc(o.x,o.y,o.radius+9,0,Math.PI*2);ctx.stroke();}
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
        ctx.font='700 18px "Malgun Gothic",sans-serif';ctx.textAlign='center';ctx.fillStyle='#8a6d2d';ctx.fillText('행성 규칙',o.x,by+30);
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
    ctx.save();ctx.globalAlpha=p.connected?1:.45;
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
    ctx.translate(-x,-y);ctx.font=(p.id===selfId?'700 ':'500 ')+'14px "Malgun Gothic",sans-serif';
    const label=p.nickname+(p.id===selfId?' · 나':'')+(!p.connected?' · 연결 중':'');
    const w=ctx.measureText(label).width+16;ctx.fillStyle='#ffffffdf';
    ctx.beginPath();ctx.roundRect(x-w/2,y+29,w,24,9);ctx.fill();
    ctx.fillStyle=p.id===selfId?'#6e4d9b':'#57536d';ctx.textAlign='center';ctx.fillText(label,x,y+46);
    drawBubble(p.id,x,y);
    ctx.restore();
  }
  function frame(t){
    ctx.clearRect(0,0,1200,760);
    const map=currentMap();
    if(myMapId===PLAZA_ID)drawMap(map);else if(myMapId===STREET_ID)drawStreet(map);else drawInterior(map);
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
