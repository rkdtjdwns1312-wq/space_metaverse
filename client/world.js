import { MAP } from '/shared/config.js';
import * as config from '/shared/config.js';
const CHAT=config.CHAT||{bubbleMs:4000};
// Canvas renderer만 교체하면 서버 규칙을 바꾸지 않고 그림을 바꿀 수 있습니다.
export function createWorld(canvas) {
  const ctx=canvas.getContext('2d'); let players=[],selfId=null;
  const points=new Map(),bubbles=new Map();
  const stars=Array.from({length:105},(_,i)=>({x:(i*137+41)%1200,y:(i*191+23)%760,r:i%5===0?2:1}));
  const star=(x,y,r,fill)=>{
    ctx.beginPath();for(let i=0;i<10;i++){const a=-Math.PI/2+i*Math.PI/5,s=i%2?r*.47:r;
      i?ctx.lineTo(x+Math.cos(a)*s,y+Math.sin(a)*s):ctx.moveTo(x+Math.cos(a)*s,y+Math.sin(a)*s);}
    ctx.closePath();ctx.fillStyle=fill;ctx.fill();
  };
  function drawMap(){
    const g=ctx.createLinearGradient(0,0,1200,760);g.addColorStop(0,'#e2e9fa');g.addColorStop(.55,'#edebfc');g.addColorStop(1,'#e0edf4');
    ctx.fillStyle=g;ctx.fillRect(0,0,1200,760);
    for(const s of stars){ctx.fillStyle='#ffffffcc';ctx.beginPath();ctx.arc(s.x,s.y,s.r,0,Math.PI*2);ctx.fill();}
    ctx.strokeStyle='#d9d7ef';ctx.lineWidth=1;ctx.setLineDash([4,12]);
    ctx.beginPath();ctx.ellipse(600,380,370,265,0,0,Math.PI*2);ctx.stroke();ctx.setLineDash([]);
    ctx.strokeStyle='#b9b3d85c';ctx.strokeRect(16,16,1168,728);
    for(const o of MAP.objects){
      ctx.fillStyle='#9387b017';ctx.beginPath();ctx.ellipse(o.x,o.y+o.radius*.8,o.radius*1.08,o.radius*.4,0,0,Math.PI*2);ctx.fill();
      if(o.kind==='star'){
        const glow=ctx.createRadialGradient(o.x,o.y,10,o.x,o.y,110);glow.addColorStop(0,'#ffe9a970');glow.addColorStop(1,'#ffe9a900');
        ctx.fillStyle=glow;ctx.fillRect(o.x-110,o.y-110,220,220);star(o.x,o.y,o.radius,'#fff2c9');star(o.x,o.y,o.radius-7,o.color);
      } else {
        const fill=ctx.createRadialGradient(o.x-22,o.y-25,5,o.x,o.y,o.radius);
        fill.addColorStop(0,'#ffffff');fill.addColorStop(.3,o.color);fill.addColorStop(1,o.color);
        ctx.fillStyle=fill;ctx.beginPath();ctx.arc(o.x,o.y,o.radius,0,Math.PI*2);ctx.fill();
        ctx.strokeStyle='#ffffff77';ctx.lineWidth=8;ctx.beginPath();ctx.ellipse(o.x,o.y+10,o.radius+18,19,-.22,0,Math.PI*2);ctx.stroke();
        ctx.fillStyle='#ffffff38';ctx.beginPath();ctx.arc(o.x+20,o.y-13,12,0,Math.PI*2);ctx.fill();
      }
      ctx.font='600 17px "Malgun Gothic",sans-serif';ctx.textAlign='center';ctx.fillStyle='#716389';
      ctx.fillText(o.name,o.x,o.y+o.radius+37);
    }
    ctx.font='14px "Malgun Gothic",sans-serif';ctx.fillStyle='#a09ab7';ctx.fillText('우리의 첫 번째 우주',600,660);
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
  function frame(t){ctx.clearRect(0,0,1200,760);drawMap();for(const p of [...players].sort((a,b)=>a.y-b.y))drawAvatar(p,t);requestAnimationFrame(frame);}
  requestAnimationFrame(frame);
  return {
    setRoom(room,id){players=(room?.players||[]).map(p=>({...p}));selfId=id;for(const key of points.keys())if(!players.some(p=>p.id===key))points.delete(key);for(const key of bubbles.keys())if(!players.some(p=>p.id===key))bubbles.delete(key);},
    positions(data){for(const [id,x,y] of data.positions){const p=players.find(p=>p.id===id);if(p){p.x=x;p.y=y;}}},
    say(playerId,text,ms){
      if(!playerId)return;const str=String(text);
      bubbles.set(playerId,{text:str.length>24?str.slice(0,24)+'…':str,until:Date.now()+(ms||CHAT.bubbleMs||4000)});
    }
  };
}
