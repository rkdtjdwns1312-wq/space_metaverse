// A small, bounded drawing format shared by the editor, renderer and server.
// Only native canvas primitives are accepted; images, URLs and markup are never stored.
export const PLANET_DESIGN_SIZE=256;
export const PLANET_DESIGN_LIMITS=Object.freeze({marks:120,strokePoints:256,totalPoints:4096,bytes:65536});
const ownKeys=(value,keys)=>value&&typeof value==='object'&&!Array.isArray(value)&&Object.keys(value).every(key=>keys.includes(key));
const color=value=>typeof value==='string'&&/^#[0-9a-f]{6}$/i.test(value);
const number=(value,min=0,max=256)=>typeof value==='number'&&Number.isFinite(value)&&value>=min&&value<=max;
const round=value=>Math.round(value*100)/100;

export function normalizePlanetDesign(value){
  if(!ownKeys(value,['version','background','marks'])||value.version!==1||!color(value.background)||!Array.isArray(value.marks)||value.marks.length>PLANET_DESIGN_LIMITS.marks)return null;
  let pointCount=0;
  const marks=[];
  for(const mark of value.marks){
    if(!mark||!color(mark.color)||!number(mark.width,1,40))return null;
    const base={tool:mark.tool,color:mark.color.toLowerCase(),width:round(mark.width)};
    if(mark.tool==='brush'){
      if(!ownKeys(mark,['tool','color','width','points'])||!Array.isArray(mark.points)||mark.points.length<1||mark.points.length>PLANET_DESIGN_LIMITS.strokePoints)return null;
      pointCount+=mark.points.length;if(pointCount>PLANET_DESIGN_LIMITS.totalPoints)return null;
      const points=[];
      for(const point of mark.points){
        if(!Array.isArray(point)||point.length!==2||!point.every(n=>number(n)))return null;
        points.push(point.map(round));
      }
      marks.push({...base,points});
    }else{
      if(!['circle','rect','star'].includes(mark.tool)||!ownKeys(mark,['tool','color','width','fill','x','y','w','h'])||typeof mark.fill!=='boolean'||!['x','y','w','h'].every(key=>number(mark[key]))||mark.w<=0||mark.h<=0||mark.x+mark.w>256||mark.y+mark.h>256)return null;
      // Round both endpoints so normalization never moves a shape outside the canvas.
      const x=round(mark.x),y=round(mark.y),w=round(round(mark.x+mark.w)-x),h=round(round(mark.y+mark.h)-y);
      if(w<=0||h<=0)return null;
      marks.push({...base,fill:mark.fill,x,y,w,h});
    }
  }
  const result={version:1,background:value.background.toLowerCase(),marks};
  return JSON.stringify(result).length<=PLANET_DESIGN_LIMITS.bytes?result:null;
}

export function createBlankPlanetDesign(background='#a9cddd'){
  return {version:1,background:color(background)?background.toLowerCase():'#a9cddd',marks:[]};
}

/** Draw inside the supplied box. The outer corners stay transparent. */
export function drawPlanetDesign(ctx,design,x,y,width,height=width){
  const valid=normalizePlanetDesign(design);
  if(!valid||!ctx||![x,y,width,height].every(Number.isFinite)||width<=0||height<=0)return false;
  ctx.save();ctx.translate(x,y);ctx.scale(width/256,height/256);
  ctx.beginPath();ctx.arc(128,128,126,0,Math.PI*2);ctx.clip();
  ctx.fillStyle=valid.background;ctx.fillRect(0,0,256,256);
  for(const mark of valid.marks){
    ctx.strokeStyle=ctx.fillStyle=mark.color;ctx.lineWidth=mark.width;ctx.lineCap='round';ctx.lineJoin='round';ctx.beginPath();
    if(mark.tool==='brush'){
      if(mark.points.length===1){ctx.arc(...mark.points[0],mark.width/2,0,Math.PI*2);ctx.fill();}
      else{ctx.moveTo(...mark.points[0]);for(const point of mark.points.slice(1))ctx.lineTo(...point);ctx.stroke();}
      continue;
    }
    if(mark.tool==='rect')ctx.rect(mark.x,mark.y,mark.w,mark.h);
    else if(mark.tool==='circle')ctx.ellipse(mark.x+mark.w/2,mark.y+mark.h/2,mark.w/2,mark.h/2,0,0,Math.PI*2);
    else{
      for(let i=0;i<10;i++){
        const angle=-Math.PI/2+i*Math.PI/5,r=i%2?.45:1;
        const px=mark.x+mark.w/2+Math.cos(angle)*mark.w/2*r,py=mark.y+mark.h/2+Math.sin(angle)*mark.h/2*r;
        if(i===0)ctx.moveTo(px,py);else ctx.lineTo(px,py);
      }
      ctx.closePath();
    }
    if(mark.fill)ctx.fill();else ctx.stroke();
  }
  const light=ctx.createRadialGradient(80,65,5,142,145,164);
  light.addColorStop(0,'rgba(255,250,225,.22)');light.addColorStop(.52,'rgba(255,255,255,0)');light.addColorStop(1,'rgba(40,29,67,.26)');
  ctx.fillStyle=light;ctx.fillRect(0,0,256,256);
  ctx.strokeStyle='rgba(255,245,216,.55)';ctx.lineWidth=3;ctx.beginPath();ctx.arc(128,128,124,0,Math.PI*2);ctx.stroke();ctx.restore();
  return true;
}
