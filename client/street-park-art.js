// Ground-layer city park: the broad crosswalks stay open to both bridges and
// the eastern shops. All foliage is low decorative planting, not hidden walls.
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
export function drawStreetPark(c,texture=null){
  c.save();
  // Pearl edging and warm paving connect the park to the existing stone art.
  oval(c,780,1745,338,348,'#8d8aab1c');oval(c,780,1737,333,341,'#c6becf');oval(c,780,1732,327,335,'#f6eddc');
  const lawn=c.createLinearGradient(450,1400,1070,2060);lawn.addColorStop(0,'#dbe6c9');lawn.addColorStop(.6,'#c3d6bd');lawn.addColorStop(1,'#aecbbb');oval(c,780,1732,315,323,lawn);
  c.save();c.beginPath();c.ellipse(780,1732,315,323,0,0,Math.PI*2);c.clip();
  for(let i=0;i<380;i++){const x=460+(i*137)%640,y=1400+(i*193)%670;oval(c,x,y,3+i%4,1.3,['#fff8d724','#69998016','#ecf3db40'][i%3]);}
  // Four wide promenades retain a straight north/south route at x=900.
  path(c,[[330,1690],[780,1732],[1220,1732]],92,'#d0c5c9');path(c,[[330,1690],[780,1732],[1220,1732]],82,'#f1e7d6');
  path(c,[[900,1280],[900,2160]],104,'#d0c5c9');path(c,[[900,1280],[900,2160]],94,'#f1e7d6');
  oval(c,780,1732,161,148,'#c8b9c4');oval(c,780,1730,155,142,'#faf1df');oval(c,780,1730,139,126,'#e6d9cd');
  c.strokeStyle='#fff7e5';c.lineWidth=2;for(const r of [68,108,134]){c.beginPath();c.ellipse(780,1730,r,r*.9,0,0,Math.PI*2);c.stroke();}
  for(let i=0;i<10;i++){const a=-Math.PI/2+i*Math.PI/5,r=i%2?36:82;c.beginPath();c.moveTo(780,1730);c.lineTo(780+Math.cos(a)*r,1730+Math.sin(a)*r*.9);c.lineTo(780+Math.cos(a+.628)*(i%2?82:36),1730+Math.sin(a+.628)*(i%2?82:36)*.9);c.fillStyle=i%2?'#d5bdd0':'#f7e3ad';c.fill();}
  c.restore();
  gardenBed(c,628,1513,111,63,1);gardenBed(c,1050,1570,54,101,2);gardenBed(c,610,1932,104,66,3);gardenBed(c,1030,1937,61,90,4);
  bench(c,680,1595,-.15);bench(c,690,1870,.15);bench(c,974,1748,Math.PI/2);
  if(texture?.complete&&texture.naturalWidth){
    c.save();c.beginPath();c.ellipse(780,1732,327,335,0,0,Math.PI*2);c.clip();
    const pattern=c.createPattern(texture,'repeat');pattern.setTransform(new DOMMatrix().scale(.17));
    c.globalAlpha=.16;c.globalCompositeOperation='multiply';c.fillStyle=pattern;c.fillRect(450,1390,660,680);c.restore();
  }
  c.font='21px "Jua","Malgun Gothic",sans-serif';c.textAlign='center';c.lineWidth=4;c.strokeStyle='#fff9ed';c.fillStyle='#6c817d';c.strokeText('오색별빛 공원',780,2088);c.fillText('오색별빛 공원',780,2088);
  c.restore();
}
