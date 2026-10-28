// 쉼터의 왼쪽 반원 화단. 화단·분수의 발밑 좌표는 shared/street-layout.js와 같습니다.
import {STREET_PARK} from '/shared/street-layout.js';
function oval(c,x,y,rx,ry,color){c.fillStyle=color;c.beginPath();c.ellipse(x,y,rx,ry,0,0,Math.PI*2);c.fill();}
function gardenBed(c,x,y,rx,ry,seed){
  oval(c,x+3,y+7,rx+9,ry+9,'#6d708c25');oval(c,x,y,rx+8,ry+8,'#c6b8c0');oval(c,x,y-2,rx+5,ry+5,'#fff4de');
  const g=c.createLinearGradient(x,y-ry,x,y+ry);g.addColorStop(0,'#b4cfab');g.addColorStop(1,'#789d8e');oval(c,x,y,rx,ry,g);
  c.save();c.beginPath();c.ellipse(x,y,rx-3,ry-3,0,0,Math.PI*2);c.clip();
  for(let i=0;i<280;i++){
    const a=i*2.399+seed,r=Math.sqrt((i+.5)/280),px=x+Math.cos(a)*rx*r,py=y+Math.sin(a)*ry*r;
    const leaf=c.createRadialGradient(px-2,py-3,1,px,py,12);leaf.addColorStop(0,['#dae7b8','#aeca9e','#e6e9bd','#9bb99b'][i%4]);leaf.addColorStop(1,['#6e9a8240','#83a68d30','#9fb99e40','#71948830'][i%4]);
    oval(c,px,py,8+(i%5),5+(i%3),leaf);
    if(i%7===0){for(let p=0;p<5;p++)oval(c,px+Math.cos(p*1.256+i)*4,py+Math.sin(p*1.256+i)*3,3+(p%2),2.8,['#fff0dc','#ebb5cc','#d2c5ed','#f7d7a1'][i%4]);oval(c,px,py,1.5,1.5,'#d8aa54');}
  }
  c.restore();
}
function fountain(c,x,y){
  // 낮은 별 모양 수반과 세 갈래 샘물: 기존 높은 원기둥 분수와 다른 실루엣.
  oval(c,x+5,y+27,105,43,'#6f648f28');
  const stone=c.createLinearGradient(0,y-30,0,y+30);stone.addColorStop(0,'#fff9e8');stone.addColorStop(.48,'#e9dcef');stone.addColorStop(1,'#b9abc9');
  oval(c,x,y+21,94,39,'#9d8db7');oval(c,x,y+11,94,37,stone);oval(c,x,y+3,86,32,'#fff8df');oval(c,x,y+1,79,27,'#ad9fc5');
  const water=c.createLinearGradient(0,y-24,0,y+26);water.addColorStop(0,'#b2e1e9');water.addColorStop(.5,'#cceef3');water.addColorStop(1,'#83bdcd');oval(c,x,y,74,25,water);
  c.strokeStyle='#f6ffffb0';c.lineWidth=1.5;for(const radius of [37,55,68]){c.beginPath();c.ellipse(x,y+2,radius,radius*.29,0,.12,Math.PI*1.86);c.stroke();}
  oval(c,x,y-13,29,14,'#c6b5d2');oval(c,x,y-20,26,11,stone);
  for(const direction of [-1,0,1]){
    c.strokeStyle='#73bfd5b9';c.lineWidth=7;c.lineCap='round';c.beginPath();c.moveTo(x+direction*12,y-21);c.quadraticCurveTo(x+direction*33,y-72,x+direction*48,y-4);c.stroke();
    c.strokeStyle='#f6ffffd7';c.lineWidth=2;c.stroke();
    oval(c,x+direction*48,y-4,3,3,'#e7fcff');
  }
  c.save();c.translate(x,y-50);c.fillStyle='#fff2bd';c.strokeStyle='#aa9ac0';c.lineWidth=2;c.beginPath();for(let i=0;i<10;i++){const a=-Math.PI/2+i*Math.PI/5,r=i%2?7:16;i?c.lineTo(Math.cos(a)*r,Math.sin(a)*r):c.moveTo(Math.cos(a)*r,Math.sin(a)*r);}c.closePath();c.fill();c.stroke();c.restore();
}
export function drawStreetPark(c,art={}){
  c.save();
  for(const bed of STREET_PARK.beds){
    if(art.flowerbed?.complete&&art.flowerbed.naturalWidth)c.drawImage(art.flowerbed,bed.x-112,bed.y-67,224,112);
    else gardenBed(c,bed.x,bed.y,bed.rx,bed.ry,bed.seed);
  }
  const f=STREET_PARK.fountain;
  if(art.fountain?.complete&&art.fountain.naturalWidth)c.drawImage(art.fountain,f.x-104,f.y-100,208,208*2/3);
  else fountain(c,f.x,f.y);
  c.restore();
}
