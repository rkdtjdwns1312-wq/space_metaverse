import {drawParadiseFloor} from './paradise-floor.js';
import {drawValleyGround} from './valley-art.js';
import {onParadiseArtReady,paradiseArtCacheKey,drawParadiseBackdrop} from './paradise-art.js';
import {drawOriginArt,originArtCacheKey,onOriginArtReady} from './origin-art.js';
// 동화풍 배경은 한 번 그려 보관합니다. 매 프레임 복잡한 성운을 다시 그리지 않아
// 크롬북에서도 이동·채팅에 쓸 여유를 남깁니다. 외부 이미지로 교체하기 쉬운 모듈입니다.
const backgrounds=new Map();
document.fonts.load('20px Jua').then(()=>backgrounds.clear());
onParadiseArtReady(()=>backgrounds.clear());
onOriginArtReady(()=>backgrounds.clear());
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
  const key=`${map.id}:${map.vista?.bodyRadius??''}:${map.vista?.bodyX??''}:${map.vista?.bodyY??''}:${paradiseArtCacheKey()}:${originArtCacheKey()}`;
  if(!backgrounds.has(key)){const canvas=document.createElement('canvas');canvas.width=map.width;canvas.height=map.height;draw(canvas.getContext('2d'));backgrounds.set(key,canvas);}
  return backgrounds.get(key);
}
export function drawTemple(ctx,map){
  ctx.drawImage(cached(map,c=>{
    sky(c,map.width,map.height);
    const {x,y}=map.templeCenter;
    ellipse(c,x,y+70,455,258,'#887ca62c');
    ellipse(c,x,y+26,443,257,'#bda9d6');ellipse(c,x,y+14,443,246,'#e7d6f0');
    ellipse(c,x,y,421,235,'#c9b7df');ellipse(c,x,y-10,419,229,'#fbf4fc');
    ellipse(c,x,y-16,380,203,'#e9e3f7');
    c.strokeStyle='#bfaed766';c.lineWidth=2;
    for(const r of [120,235,342]){c.beginPath();c.ellipse(x,y-16,r,r*.52,0,0,Math.PI*2);c.stroke();}
    for(let i=0;i<12;i++){const a=i*Math.PI/6;c.beginPath();c.moveTo(x+Math.cos(a)*120,y-16+Math.sin(a)*62);c.lineTo(x+Math.cos(a)*377,y-16+Math.sin(a)*198);c.stroke();}
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
// 낙원8맵: 같은 손그림 하늘/석판 계열, 각 천체의 위치·크기는 맵 설정 유지.
function drawPaintedParadise(ctx,map){ctx.drawImage(cached(map,c=>{drawParadiseBackdrop(c,map);drawParadiseFloor(c,map);}),0,0);}
export function drawCrossroads(ctx,map){drawPaintedParadise(ctx,map);}
export function drawParadise(ctx,map){drawPaintedParadise(ctx,map);}
export function drawStarParadise(ctx,map){drawPaintedParadise(ctx,map);}
export function drawRainbowSpace(ctx,map){
  ctx.drawImage(cached(map,c=>{
    sky(c,map.width,map.height,['#7771ad','#a78bbb','#647da6']);
    for(const [i,color] of ['#ffbbd9','#ffdba2','#bceacc','#b9deff','#ddc0ff'].entries()){
      const x=120+i*240,y=250+(i%2)*200,g=c.createRadialGradient(x,y,15,x,y,380);g.addColorStop(0,color+'a0');g.addColorStop(1,color+'00');c.fillStyle=g;c.fillRect(x-380,y-380,760,760);
      c.strokeStyle=color+'60';c.lineWidth=12;c.beginPath();c.moveTo(-50,560+i*20);c.bezierCurveTo(300,80+i*42,720,720-i*38,1250,180+i*30);c.stroke();
    }
  }),0,0);
}
export function drawValley(ctx,map,time){drawValleyGround(ctx,map,time);}

// 별의 시작점은 거의 검은 공간 위에 별을 드문드문 놓습니다. 위치와 색은
// 맵 이름으로 만든 시드에서 결정해 캐시된 배경이 매번 달라지지 않게 합니다.
export function drawStarOrigin(ctx,map,time=0){
  ctx.drawImage(cached(map,c=>drawOriginArt(c,map)),0,0);
  const reduced=typeof matchMedia!=='undefined'&&matchMedia('(prefers-reduced-motion: reduce)').matches;
  if(reduced)return;
  let seed=2166136261;for(const ch of `${map.id??''}:${map.name??'star-origin'}`){seed^=ch.charCodeAt(0);seed=Math.imul(seed,16777619);}
  const rand=()=>{seed=Math.imul(seed^seed>>>16,2246822519);seed=Math.imul(seed^seed>>>13,3266489917);return ((seed^seed>>>16)>>>0)/4294967296;};
  const elapsed=Number.isFinite(time)?time:0;ctx.save();
  for(let i=0;i<14;i++){
    const x=(i*137+rand()*map.width)%map.width,y=(i*191+rand()*map.height)%map.height,r=.7+rand()*1.1,phase=rand()*Math.PI*2;
    ctx.globalAlpha=.25+.48*(.5+.5*Math.sin(elapsed*.001+phase));ctx.fillStyle=i%3?'#f4edff':'#fff2cf';ctx.beginPath();ctx.arc(x,y,r,0,Math.PI*2);ctx.fill();
  }
  ctx.restore();
}
