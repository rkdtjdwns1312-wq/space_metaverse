// 쉼터의 원형 정원. 화단·분수의 발밑 좌표는 shared/street-layout.js와 같습니다.
import {STREET_PARK} from '/shared/street-layout.js';
function oval(c,x,y,rx,ry,color){c.fillStyle=color;c.beginPath();c.ellipse(x,y,rx,ry,0,0,Math.PI*2);c.fill();}
function path(c,points,width,color){c.strokeStyle=color;c.lineWidth=width;c.lineCap='round';c.lineJoin='round';c.beginPath();points.forEach(([x,y],i)=>i?c.lineTo(x,y):c.moveTo(x,y));c.stroke();}
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
function bench(c,x,y,angle){
  c.save();c.translate(x,y);c.rotate(angle);oval(c,4,11,47,12,'#5b567e22');
  path(c,[[-34,1],[-34,17]],5,'#877b92');path(c,[[34,1],[34,17]],5,'#877b92');
  for(let i=0;i<3;i++)path(c,[[-42,-10+i*7],[42,-10+i*7]],6,i===0?'#f2d8bb':'#ccad95');
  path(c,[[-43,-24],[43,-24]],9,'#ddbea1');path(c,[[-39,-25],[39,-25]],2,'#fae6c7');
  c.restore();
}
function tree(c,x,y,scale=1){
  c.save();c.translate(x,y);c.scale(scale,scale);
  oval(c,4,9,30,13,'#6b668537');
  path(c,[[0,4],[0,-74]],14,'#856b7b');path(c,[[-3,-6],[-3,-74]],4,'#e6bfaa');
  for(const [dx,dy,rx,ry] of [[-24,-76,35,39],[22,-78,36,40],[0,-104,43,44]]){
    const leaves=c.createRadialGradient(dx-13,dy-19,2,dx,dy,55);
    leaves.addColorStop(0,'#e8edc7');leaves.addColorStop(.43,'#a8c8ac');leaves.addColorStop(1,'#568a8d');
    oval(c,dx+4,dy+5,rx+3,ry+3,'#4e748a77');oval(c,dx,dy,rx,ry,leaves);
  }
  for(let i=0;i<75;i++){
    const a=i*2.399,r=Math.sqrt((i+.5)/75),px=Math.cos(a)*47*r,py=-88+Math.sin(a)*47*r;
    if(py> -42)continue;
    oval(c,px,py,2.6+(i%3),1.8+(i%2),['#fff1ca','#f2c4d6','#d6e5cf','#c8c8ec'][i%4]);
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
export function drawStreetPark(c,texture=null,art={}){
  c.save();
  // 예전 긴 중앙 길·벤치·분수 배치를 지우고 별꽃 모자이크를 중심으로 재구성합니다.
  oval(c,850,1738,298,204,'#8f809e67');oval(c,850,1731,290,196,'#fff8e8');oval(c,850,1731,280,187,'#cfc2d3');
  oval(c,850,1731,271,178,'#eee5df');
  c.save();c.beginPath();c.ellipse(850,1731,269,176,0,0,Math.PI*2);c.clip();
  // 맞물린 연보라·크림 석재를 조금씩 다르게 채색해 기하학적 도식처럼 보이지 않게 합니다.
  for(let row=0;row<12;row++)for(let col=0;col<14;col++){
    const x=577+col*43+(row%2)*21,y=1549+row*33,j=(row*17+col*11)%7;
    c.fillStyle=['#f8f1e8','#e6dce3','#fff5e8','#e1d8e8','#eee7e1','#f2e7dc','#e8e1ed'][j];
    c.strokeStyle='#b8a9c078';c.lineWidth=1.8;c.beginPath();c.roundRect(x+2+(j%3),y+2,38,27,5);c.fill();c.stroke();
    c.strokeStyle='#fffaf3a6';c.lineWidth=1;c.beginPath();c.moveTo(x+5,y+5);c.lineTo(x+32,y+5);c.stroke();
  }
  c.restore();
  c.strokeStyle='#fff9e8';c.lineWidth=7;c.beginPath();c.ellipse(850,1731,279,186,0,0,Math.PI*2);c.stroke();
  c.strokeStyle='#a994bf99';c.lineWidth=2;c.beginPath();c.ellipse(850,1731,283,190,0,0,Math.PI*2);c.stroke();
  if(texture?.complete&&texture.naturalWidth){
    c.save();c.beginPath();c.ellipse(850,1731,274,183,0,0,Math.PI*2);c.clip();const pattern=c.createPattern(texture,'repeat');pattern.setTransform(new DOMMatrix().scale(.17));c.globalAlpha=.1;c.globalCompositeOperation='multiply';c.fillStyle=pattern;c.fillRect(570,1540,560,390);c.restore();
  }
  for(const bed of STREET_PARK.beds){
    if(art.flowerbed?.complete&&art.flowerbed.naturalWidth)c.drawImage(art.flowerbed,bed.x-112,bed.y-67,224,112);
    else gardenBed(c,bed.x,bed.y,bed.rx,bed.ry,bed.seed);
  }
  tree(c,555,1450,.64);tree(c,560,1885,.64);
  bench(c,625,1690,-.4);bench(c,1080,1790,.4);
  const f=STREET_PARK.fountain;
  if(art.fountain?.complete&&art.fountain.naturalWidth)c.drawImage(art.fountain,f.x-104,f.y-100,208,208*2/3);
  else fountain(c,f.x,f.y);
  c.restore();
}
