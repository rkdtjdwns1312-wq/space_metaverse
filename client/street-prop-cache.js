import {PAINTED_PROPS,drawPaintedProp} from './painted-props.js';
import {drawDuelArcade} from './duel-arcade-art.js';

// Buildings, Korean signs and arcade labels do not animate. Rasterize them at
// the current display density once, instead of shaping/stroking text every frame.
const entries=new Map(),LIMIT=16*1024*1024;
let bytes=0,builds=0;
function clear(){entries.clear();bytes=0;}
document.fonts?.addEventListener('loadingdone',clear);
export const streetPropCacheStats=()=>({entries:entries.size,bytes,builds,limit:LIMIT});
export function drawCachedStreetProp(ctx,o,artReady){
  const spec=PAINTED_PROPS[o.kind],duel=o.kind==='duel-arcade';
  if(!artReady||(!spec&&!duel))return false;
  const transform=ctx.getTransform(),density=Math.max(Math.abs(transform.a),Math.abs(transform.d));
  // Overview text is tiny: retain direct vector text instead of downsampling it.
  if(density<1)return false;
  const scale=Math.ceil(density*2)/2;
  if(scale>4||transform.b||transform.c)return false;
  const key=JSON.stringify([o.kind,o.name,o.gameId,duel?o.id:null,scale]);
  let entry=entries.get(key);
  if(!entry){
    const canvas=document.createElement('canvas'),c=canvas.getContext('2d');
    c.font=`${duel||o.kind==='arcade'?16:19}px "Jua","Malgun Gothic",sans-serif`;
    const width=Math.ceil(Math.max(duel?210:spec.width,c.measureText(o.name||'').width+32)+12);
    const top=duel?-146:spec.foot-spec.height-6,bottom=duel?116:Math.max(spec.foot+6,o.kind==='arcade'?78:0),height=bottom-top;
    canvas.width=Math.ceil(width*scale);canvas.height=Math.ceil(height*scale);
    c.setTransform(scale,0,0,scale,width*scale/2,-top*scale);
    const local={...o,x:0,y:0};
    if(duel)drawDuelArcade(c,local);else if(!drawPaintedProp(c,local))return false;
    entry={canvas,width,height,top,bytes:canvas.width*canvas.height*4};
    entries.set(key,entry);bytes+=entry.bytes;builds++;
    while(bytes>LIMIT&&entries.size>1){const oldest=entries.keys().next().value;bytes-=entries.get(oldest).bytes;entries.delete(oldest);}
  }else{entries.delete(key);entries.set(key,entry);}
  ctx.drawImage(entry.canvas,o.x-entry.width/2,o.y+entry.top,entry.width,entry.height);
  return true;
}
