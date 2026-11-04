export const ART_LIMITS=Object.freeze({width:600,height:400,works:10,title:40,strokes:100,strokePoints:1000,points:6000,bytes:96*1024});
const fields=(v,keys)=>v&&typeof v==='object'&&!Array.isArray(v)&&Object.keys(v).every(k=>keys.includes(k));
const color=v=>typeof v==='string'&&/^#[0-9a-f]{6}$/i.test(v);
export const blankArtDrawing=()=>({version:1,background:'#ffffff',strokes:[]});
export function normalizeArtDrawing(raw){
 if(!fields(raw,['version','background','strokes'])||raw.version!==1||!color(raw.background)||!Array.isArray(raw.strokes)||raw.strokes.length>ART_LIMITS.strokes)return null;
 let count=0;const strokes=[];
 for(const s of raw.strokes){
  if(!fields(s,['tool','color','width','points'])||!['brush','eraser'].includes(s.tool)||!color(s.color)||!Number.isInteger(s.width)||s.width<1||s.width>40||!Array.isArray(s.points)||s.points.length<1||s.points.length>ART_LIMITS.strokePoints)return null;
  count+=s.points.length;if(count>ART_LIMITS.points)return null;
  const points=[];for(const p of s.points){if(!Array.isArray(p)||p.length!==2||!p.every(Number.isInteger)||p[0]<0||p[0]>600||p[1]<0||p[1]>400)return null;points.push([...p]);}
  strokes.push({tool:s.tool,color:s.color.toLowerCase(),width:s.width,points});
 }
 const drawing={version:1,background:raw.background.toLowerCase(),strokes};
 return JSON.stringify(drawing).length<=ART_LIMITS.bytes?drawing:null;
}
// The caller keeps a normalized drawing; repainting never allocates another copy.
export function paintArtDrawing(ctx,drawing,width=ART_LIMITS.width,height=ART_LIMITS.height){
 ctx.save();ctx.clearRect(0,0,width,height);ctx.scale(width/ART_LIMITS.width,height/ART_LIMITS.height);ctx.fillStyle=drawing.background;ctx.fillRect(0,0,600,400);ctx.lineCap='round';ctx.lineJoin='round';
 for(const s of drawing.strokes){ctx.fillStyle=ctx.strokeStyle=s.tool==='eraser'?drawing.background:s.color;ctx.lineWidth=s.width;ctx.beginPath();if(s.points.length===1){ctx.arc(s.points[0][0],s.points[0][1],s.width/2,0,Math.PI*2);ctx.fill();}else{ctx.moveTo(...s.points[0]);for(let i=1;i<s.points.length;i++)ctx.lineTo(...s.points[i]);ctx.stroke();}}
 ctx.restore();
}
