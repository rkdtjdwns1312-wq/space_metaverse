const FONT='"Jua","Malgun Gothic",sans-serif';
const HEIGHT=40,PAD=2;

function labelWidth(ctx,label,self){
  ctx.font=(self?'700 ':'500 ')+'14px '+FONT;const name=ctx.measureText(label.name).width;
  ctx.font='11px '+FONT;return Math.max(name,ctx.measureText(label.detail).width)+18;
}
function paint(ctx,label,self,x,top,width){
  ctx.textAlign='center';ctx.textBaseline='alphabetic';
  ctx.fillStyle='#fffffff0';ctx.beginPath();ctx.roundRect(x-width/2,top,width,HEIGHT,9);ctx.fill();
  ctx.fillStyle=self?'#6e4d9b':'#57536d';ctx.font='14px '+FONT;ctx.fillText(label.name,x,top+16);
  ctx.fillStyle='#726782';ctx.font='11px '+FONT;ctx.fillText(label.detail,x,top+32);
}
export function drawAvatarLabelDirect(ctx,label,self,x,top){
  ctx.save();const width=labelWidth(ctx,label,self);paint(ctx,label,self,x,top,width);ctx.restore();return width;
}

// Each world owns at most 4MiB of nameplate pixels. Recent-frame entries are
// pinned: a dense/high-DPI crowd that exceeds the budget falls back to direct
// text for the excess instead of rebuilding and evicting the whole set each frame.
export function createAvatarLabelCache({limit=4*1024*1024,maxEntries=128,createCanvas=()=>document.createElement('canvas'),fonts=globalThis.document?.fonts}={}){
  const entries=new Map();let bytes=0,frame=0,builds=0,hits=0,fallbacks=0;
  function clear(){entries.clear();bytes=0;}
  fonts?.addEventListener('loadingdone',clear);
  function reserve(size){
    if(size>limit||maxEntries<1)return false;
    for(const [key,entry] of entries){
      if(bytes+size<=limit&&entries.size<maxEntries)return true;
      if(entry.frame>=frame-1)continue;
      entries.delete(key);bytes-=entry.bytes;
    }
    return bytes+size<=limit&&entries.size<maxEntries;
  }
  function draw(ctx,label,self,x,top){
    const t=ctx.getTransform(),density=t.a;
    // Retain vector text in zoomed-out maps and unusual transforms.
    // Flattening translucent text+background would change their overlap alpha.
    if(density<1||density>4||Math.abs(t.d-density)>.00001||t.b||t.c||(ctx.globalAlpha!==undefined&&ctx.globalAlpha!==1)){
      fallbacks++;return drawAvatarLabelDirect(ctx,label,self,x,top);
    }
    const key=JSON.stringify([label.name,label.detail,!!self,density]);
    let entry=entries.get(key);
    if(!entry){
      ctx.save();const width=labelWidth(ctx,label,self);ctx.restore();
      const pixelWidth=Math.ceil((width+PAD*2)*density),pixelHeight=Math.ceil((HEIGHT+PAD*2)*density),size=pixelWidth*pixelHeight*4;
      if(!reserve(size)){fallbacks++;return drawAvatarLabelDirect(ctx,label,self,x,top);}
      const canvas=createCanvas();canvas.width=pixelWidth;canvas.height=pixelHeight;
      const c=canvas.getContext('2d');c.setTransform(density,0,0,density,0,0);
      paint(c,label,self,width/2+PAD,PAD,width);
      entry={canvas,width,pixelWidth,pixelHeight,density,bytes:size,frame};entries.set(key,entry);bytes+=size;builds++;
    }else{hits++;entry.frame=frame;entries.delete(key);entries.set(key,entry);}
    ctx.drawImage(entry.canvas,x-entry.width/2-PAD,top-PAD,entry.pixelWidth/entry.density,entry.pixelHeight/entry.density);
    return entry.width;
  }
  return {draw,clear,beginFrame(){frame++;},stats:()=>({entries:entries.size,bytes,limit,builds,hits,fallbacks}),
    dispose(){fonts?.removeEventListener('loadingdone',clear);clear();}};
}
