import {interiorDecorStyle,interiorDecorColor} from '/shared/interior-decor.js';
import {INTERIOR_VARIANT_ART,INTERIOR_PROP_GEOMETRY,interiorVisual} from './interior-visuals.js';

export const INTERIOR_ART={...Object.fromEntries(Object.keys(INTERIOR_VARIANT_ART).filter(k=>k!=='room').map(k=>[k,interiorVisual(k)])),
  'interior-decor-machine':'/assets/interior/control.png'};
export const INTERIOR_UPGRADE_ART=Object.freeze(Object.fromEntries(Object.entries(INTERIOR_VARIANT_ART).filter(([k])=>k!=='room').map(([k,v])=>[k,Object.fromEntries(['tier1','tier2','tier3'].map(id=>[id,v[id]]))])));
const images=new Map(),floors=new Map(),tints=new Map();
function asset(src){if(!images.has(src)){const image=new Image();image.src=src;images.set(src,image);}return images.get(src);}
const ready=image=>image?.complete&&image.naturalWidth>0;
// Compressed assets are decoded once; changing a room's style never shows old generic shapes.
export async function preloadInteriorArt(){await Promise.all([...Object.values(INTERIOR_VARIANT_ART).flatMap(Object.values),INTERIOR_ART['interior-decor-machine']].map(src=>asset(src).decode()));}
function cachedPut(cache,key,value,limit){if(cache.size>=limit)cache.delete(cache.keys().next().value);cache.set(key,value);return value;}
export function drawInteriorFloor(ctx,map,planet){
  const style=interiorDecorStyle(planet?.interiorDecor,'room'),color=interiorDecorColor(style.colorId)?.hex;
  const selected=interiorVisual('room',style.shapeId),img=asset(selected),fallback=asset(interiorVisual('room'));
  const source=ready(img)?img:ready(fallback)?fallback:null;
  if(!source){ctx.fillStyle='#e5dfd8';ctx.fillRect(0,0,map.width,map.height);return;}
  const key=[map.width,map.height,source.src,style.colorId].join(':');let floor=floors.get(key);
  if(!floor){floor=document.createElement('canvas');floor.width=map.width;floor.height=map.height;const c=floor.getContext('2d');
    c.drawImage(source,0,0,map.width,map.height);
    if(color){c.fillStyle=color;c.globalAlpha=.13;c.fillRect(0,0,map.width,map.height);}
    cachedPut(floors,key,floor,8);
  }ctx.drawImage(floor,0,0);
}
function label(ctx,text,x,y,size=18){ctx.font=`${size}px "Jua","Malgun Gothic",sans-serif`;ctx.textAlign='center';ctx.textBaseline='alphabetic';ctx.lineWidth=4;ctx.strokeStyle='#fffdf7';ctx.strokeText(text,x,y);ctx.fillStyle='#594c75';ctx.fillText(text,x,y);}
// Legacy door styling remains compatible; the five editable targets now have full original art.
export function drawInteriorDecoration(ctx,o,style){
  if(o.kind!=='door'||!style||style.shapeId==='default')return;
  const x=o.x,y=o.y+30,r=22;ctx.save();ctx.fillStyle=interiorDecorColor(style.colorId)?.hex||'#e2d7f2';ctx.strokeStyle='#a696bc';ctx.lineWidth=2;
  ctx.beginPath();
  if(style.shapeId==='star'){for(let i=0;i<10;i++){const a=-Math.PI/2+i*Math.PI/5,s=i%2?r*.46:r;i?ctx.lineTo(x+Math.cos(a)*s,y+Math.sin(a)*s):ctx.moveTo(x+Math.cos(a)*s,y+Math.sin(a)*s);}ctx.closePath();}
  else ctx.ellipse(x,y,r,r*.75,0,0,Math.PI*2);
  ctx.fill();ctx.stroke();ctx.restore();
}
export function drawInteriorProp(ctx,o,planet){
  const style=interiorDecorStyle(planet?.interiorDecor,o.id),src=interiorVisual(o.kind,style.shapeId)||INTERIOR_ART[o.kind];if(!src)return false;
  const desired=asset(src),fallback=asset(INTERIOR_ART[o.kind]),img=ready(desired)?desired:ready(fallback)?fallback:null;
  const color=interiorDecorColor(style.colorId)?.hex,{width:w,height:h,foot}=INTERIOR_PROP_GEOMETRY[o.kind],top=o.y+foot-h;
  ctx.save();
  if(img){const scale=Math.min(w/img.naturalWidth,h/img.naturalHeight),dw=img.naturalWidth*scale,dh=img.naturalHeight*scale;
    ctx.drawImage(img,o.x-dw/2,top+(h-dh)/2,dw,dh);
    if(color){const key=[img.src,color,dw,dh].join(':');let tint=tints.get(key);
      if(!tint){tint=document.createElement('canvas');tint.width=Math.ceil(dw);tint.height=Math.ceil(dh);const t=tint.getContext('2d');t.drawImage(img,0,0,dw,dh);t.globalCompositeOperation='source-atop';t.globalAlpha=.22;t.fillStyle=color;t.fillRect(0,0,dw,dh);cachedPut(tints,key,tint,48);}
      ctx.drawImage(tint,o.x-dw/2,top+(h-dh)/2);
    }
  }
  if(o.kind!=='board'){
    const names={mailbox:'가입 신청 우체통','report-board':'실적작성표','warning-rock':'경고 제어돌','interior-decor-machine':'부서행성 제어장치'};
    label(ctx,names[o.kind],o.x,o.y+foot+22);
    if(o.kind==='mailbox'&&planet?.mailboxCount){ctx.fillStyle='#d96693';ctx.beginPath();ctx.arc(o.x+39,o.y-45,15,0,Math.PI*2);ctx.fill();ctx.fillStyle='#fff';ctx.font='16px "Jua",sans-serif';ctx.fillText(String(planet.mailboxCount),o.x+39,o.y-40);}
  }
  ctx.restore();return true;
}
