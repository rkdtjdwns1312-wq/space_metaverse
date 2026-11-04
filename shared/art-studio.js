export const ART_TEACHER_OWNER='@teacher';
export const ART_LIMITS=Object.freeze({width:600,height:400,works:10,title:40,strokePoints:1000,points:6000,bytes:96*1024});
export const ART_SHAPE_TOOLS=Object.freeze(['rectangle','ellipse','triangle','star']);
export const isArtShapeTool=tool=>ART_SHAPE_TOOLS.includes(tool);
export const artDrawingPointCount=drawing=>(drawing?.strokes??[]).reduce((total,s)=>total+(s.tool==='fill'?s.spans.length:s.points.length),0);
const fields=(v,keys)=>v&&typeof v==='object'&&!Array.isArray(v)&&Object.keys(v).every(k=>keys.includes(k));
const color=v=>typeof v==='string'&&/^#[0-9a-f]{6}$/i.test(v);
export const blankArtDrawing=()=>({version:1,background:'#ffffff',strokes:[]});
export function normalizeArtDrawing(raw){
 if(!fields(raw,['version','background','strokes'])||raw.version!==1||!color(raw.background)||!Array.isArray(raw.strokes))return null;
 let count=0;const strokes=[];
 for(const s of raw.strokes){
  if(s?.tool==='fill'){
   if(!fields(s,['tool','color','spans'])||!color(s.color)||!Array.isArray(s.spans)||s.spans.length<1)return null;
   count+=s.spans.length;if(count>ART_LIMITS.points)return null;
   const spans=[];let previous=null;
   for(const span of s.spans){
    if(!Array.isArray(span)||span.length!==3||!span.every(Number.isInteger))return null;
    const [y,left,right]=span;
    if(y<0||y>=ART_LIMITS.height||left<0||right>=ART_LIMITS.width||left>right||previous&&(y<previous[0]||y===previous[0]&&left<=previous[2]+1))return null;
    previous=span;spans.push([...span]);
   }
   strokes.push({tool:'fill',color:s.color.toLowerCase(),spans});continue;
  }
  if(!fields(s,['tool','color','width','points'])||!['brush','eraser',...ART_SHAPE_TOOLS].includes(s.tool)||!color(s.color)||!Number.isInteger(s.width)||s.width<1||s.width>40||!Array.isArray(s.points)||s.points.length<1||s.points.length>ART_LIMITS.strokePoints||isArtShapeTool(s.tool)&&s.points.length!==2)return null;
  count+=s.points.length;if(count>ART_LIMITS.points)return null;
  const points=[];for(const p of s.points){if(!Array.isArray(p)||p.length!==2||!p.every(Number.isInteger)||p[0]<0||p[0]>600||p[1]<0||p[1]>400)return null;points.push([...p]);}
  strokes.push({tool:s.tool,color:s.color.toLowerCase(),width:s.width,points});
 }
 const drawing={version:1,background:raw.background.toLowerCase(),strokes};
 return JSON.stringify(drawing).length<=ART_LIMITS.bytes?drawing:null;
}
// Capture the chosen connected region once. Stored horizontal runs make future
// redraws deterministic and avoid repeating a flood fill for every pointer move.
export function createArtFill(imageData,x,y,fillColor,{tolerance=12,maxSpans=ART_LIMITS.points}={}){
 const {data,width,height}=imageData??{};
 if(!Number.isInteger(width)||width<1||width>ART_LIMITS.width||!Number.isInteger(height)||height<1||height>ART_LIMITS.height||!(data instanceof Uint8ClampedArray||data instanceof Uint8Array)||data.length!==width*height*4||!Number.isInteger(x)||x<0||x>=width||!Number.isInteger(y)||y<0||y>=height||!color(fillColor)||!Number.isInteger(tolerance)||tolerance<0||tolerance>32||!Number.isInteger(maxSpans)||maxSpans<0||maxSpans>ART_LIMITS.points)throw new TypeError('그림 채우기 입력을 확인해주세요.');
 const origin=(y*width+x)*4,target=[data[origin],data[origin+1],data[origin+2],data[origin+3]],rgb=[1,3,5].map(i=>parseInt(fillColor.slice(i,i+2),16));
 if(target[3]===255&&rgb.every((v,i)=>v===target[i]))return null;
 const seen=new Uint8Array(width*height),queue=new Uint32Array(width*height);let head=0,tail=0;
 const enqueue=index=>{if(seen[index])return;const at=index*4;for(let c=0;c<4;c++)if(Math.abs(data[at+c]-target[c])>tolerance)return;seen[index]=1;queue[tail++]=index;};
 enqueue(y*width+x);
 while(head<tail){const index=queue[head++],column=index%width;if(column>0)enqueue(index-1);if(column+1<width)enqueue(index+1);if(index>=width)enqueue(index-width);if(index+width<seen.length)enqueue(index+width);}
 const spans=[];
 for(let row=0;row<height;row++)for(let column=0;column<width;column++)if(seen[row*width+column]){
  const left=column;while(column+1<width&&seen[row*width+column+1])column++;
  if(spans.length>=maxSpans)throw new RangeError('그림이 꽉 찼어요. 되돌리거나 지운 뒤 다시 채워주세요.');
  spans.push([row,left,column]);
 }
 return {tool:'fill',color:fillColor.toLowerCase(),spans};
}

function shapePath(ctx,s){
 const [[x1,y1],[x2,y2]]=s.points,left=Math.min(x1,x2),top=Math.min(y1,y2),w=Math.abs(x2-x1),h=Math.abs(y2-y1),cx=left+w/2,cy=top+h/2;
 if(!w||!h){if(!w&&!h){ctx.arc(x1,y1,s.width/2,0,Math.PI*2);ctx.fill();return false;}ctx.moveTo(x1,y1);ctx.lineTo(x2,y2);return true;}
 if(s.tool==='rectangle')ctx.rect(left,top,w,h);
 else if(s.tool==='ellipse')ctx.ellipse(cx,cy,w/2,h/2,0,0,Math.PI*2);
 else if(s.tool==='triangle'){ctx.moveTo(cx,top);ctx.lineTo(left+w,top+h);ctx.lineTo(left,top+h);ctx.closePath();}
 else{for(let i=0;i<10;i++){const angle=-Math.PI/2+i*Math.PI/5,r=i%2?.45:1,px=cx+Math.cos(angle)*w/2*r,py=cy+Math.sin(angle)*h/2*r;if(i===0)ctx.moveTo(px,py);else ctx.lineTo(px,py);}ctx.closePath();}
 return true;
}
// The caller keeps a normalized drawing; repainting never allocates another copy.
export function paintArtDrawing(ctx,drawing,width=ART_LIMITS.width,height=ART_LIMITS.height){
 ctx.save();ctx.clearRect(0,0,width,height);ctx.scale(width/ART_LIMITS.width,height/ART_LIMITS.height);ctx.fillStyle=drawing.background;ctx.fillRect(0,0,600,400);ctx.lineCap='round';ctx.lineJoin='round';
 for(const s of drawing.strokes){ctx.fillStyle=ctx.strokeStyle=s.tool==='eraser'?drawing.background:s.color;if(s.tool==='fill'){for(const [y,left,right]of s.spans)ctx.fillRect(left,y,right-left+1,1);continue;}ctx.lineWidth=s.width;ctx.beginPath();if(isArtShapeTool(s.tool)){if(shapePath(ctx,s))ctx.stroke();}else if(s.points.length===1){ctx.arc(s.points[0][0],s.points[0][1],s.width/2,0,Math.PI*2);ctx.fill();}else{ctx.moveTo(...s.points[0]);for(let i=1;i<s.points.length;i++)ctx.lineTo(...s.points[i]);ctx.stroke();}}
 ctx.restore();
}
