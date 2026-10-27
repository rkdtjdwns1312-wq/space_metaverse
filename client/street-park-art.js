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
function fountain(c,x,y){
  oval(c,x+5,y+27,99,38,'#6f648f28');
  const stone=c.createLinearGradient(0,y-30,0,y+30);stone.addColorStop(0,'#fff9e8');stone.addColorStop(.48,'#e9dcef');stone.addColorStop(1,'#b9abc9');
  oval(c,x,y+20,92,35,'#ac9bbf');oval(c,x,y+13,92,34,stone);oval(c,x,y+5,85,31,'#fff8df');oval(c,x,y+3,78,27,'#b4a9c8');
  const water=c.createLinearGradient(0,y-24,0,y+26);water.addColorStop(0,'#b2e1e9');water.addColorStop(.5,'#cceef3');water.addColorStop(1,'#83bdcd');oval(c,x,y,74,25,water);
  c.strokeStyle='#f6ffffb0';c.lineWidth=1.5;for(const radius of [34,52,67]){c.beginPath();c.ellipse(x,y+2,radius,radius*.29,0,.12,Math.PI*1.86);c.stroke();}
  const pillar=c.createLinearGradient(x-13,0,x+13,0);pillar.addColorStop(0,'#b5a7c9');pillar.addColorStop(.45,'#fff7e3');pillar.addColorStop(.7,'#f4e8ee');pillar.addColorStop(1,'#b8a6c9');
  c.fillStyle=pillar;c.beginPath();c.moveTo(x-20,y+4);c.quadraticCurveTo(x-11,y-24,x-10,y-56);c.lineTo(x+10,y-56);c.quadraticCurveTo(x+11,y-24,x+20,y+4);c.closePath();c.fill();oval(c,x,y+3,20,7,'#d9c9df');
  oval(c,x,y-55,43,17,'#b6a3c4');oval(c,x,y-61,43,17,stone);oval(c,x,y-65,36,12,'#d5f2f4');
  c.lineCap='round';
  for(const direction of [-1,1]){c.strokeStyle='#8ac5daaa';c.lineWidth=6;c.beginPath();c.moveTo(x+direction*25,y-61);c.quadraticCurveTo(x+direction*55,y-43,x+direction*54,y);c.stroke();c.strokeStyle='#f4ffffdf';c.lineWidth=2;c.stroke();}
  path(c,[[x,y-64],[x,y-96]],9,pillar);oval(c,x,y-97,11,11,'#ad97c0');oval(c,x,y-99,8,9,'#e4dcff');
  c.save();c.translate(x,y-104);c.fillStyle='#ffe6a0';c.strokeStyle='#bda575';c.lineWidth=1;c.beginPath();for(let i=0;i<10;i++){const a=-Math.PI/2+i*Math.PI/5,r=i%2?5:11;i?c.lineTo(Math.cos(a)*r,Math.sin(a)*r):c.moveTo(Math.cos(a)*r,Math.sin(a)*r);}c.closePath();c.fill();c.stroke();c.restore();
  for(const [dx,dy] of [[-61,-4],[62,6],[-31,9],[29,-8]]){oval(c,x+dx,y+dy,2.5,1.5,'#fffef0');}
}
export function drawStreetPark(c,texture=null){
  c.save();
  // Wide walking routes remain open. Low flower beds mark their edges visually;
  // the small fountain and all planting are decorative, not collision objects.
  path(c,[[900,1280],[900,2160]],116,'#c8bacd');path(c,[[900,1280],[900,2160]],106,'#fff4df');path(c,[[900,1280],[900,2160]],92,'#f0e3d9');
  path(c,[[330,1690],[740,1745],[1220,1745]],104,'#c8bacd');path(c,[[330,1690],[740,1745],[1220,1745]],94,'#fff4df');path(c,[[330,1690],[740,1745],[1220,1745]],80,'#f0e3d9');
  oval(c,740,1748,121,106,'#baaac5');oval(c,740,1744,118,103,'#fff5e4');oval(c,740,1744,108,94,'#eadfe4');
  if(texture?.complete&&texture.naturalWidth){
    c.save();c.beginPath();c.ellipse(740,1744,108,94,0,0,Math.PI*2);c.clip();const pattern=c.createPattern(texture,'repeat');pattern.setTransform(new DOMMatrix().scale(.17));c.globalAlpha=.16;c.globalCompositeOperation='multiply';c.fillStyle=pattern;c.fillRect(630,1645,220,200);c.restore();
  }
  gardenBed(c,620,1515,117,48,1);gardenBed(c,1050,1555,48,103,2);
  gardenBed(c,620,1950,117,48,3);gardenBed(c,1050,1940,48,103,4);
  bench(c,643,1600,-.12);bench(c,653,1867,.12);
  fountain(c,740,1748);
  c.font='18px "Jua","Malgun Gothic",sans-serif';c.textAlign='center';c.lineWidth=4;c.strokeStyle='#fff9ed';c.fillStyle='#7a6a90';c.strokeText('오색별빛 쉼터',740,1905);c.fillText('오색별빛 쉼터',740,1905);
  c.restore();
}
