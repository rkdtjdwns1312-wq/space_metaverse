// Presentation only: input, server ticks and effect deadlines never use this clock.
export const RENDER_QUALITY_KEY='woozooclass-render-quality-v1';
export const renderQualityMode=value=>['auto','normal','low'].includes(value)?value:'auto';
export function createRenderQuality({mode='auto',lowPower=false}={}){
  let selected=renderQualityMode(mode),effective=selected==='low'||selected==='auto'&&lowPower?'low':'normal';
  let lastTick=null,nextFrame=null,windowStart=null,intervalTotal=0,intervalCount=0,cpuTotal=0,cpuCount=0;
  let slowWindows=0,fastWindows=0,frames=0,cpuMs=0,frameMs=0;
  const resetSamples=()=>{windowStart=null;intervalTotal=intervalCount=cpuTotal=cpuCount=0;slowWindows=fastWindows=0;};
  function setMode(value){selected=renderQualityMode(value);effective=selected==='low'?'low':'normal';lastTick=nextFrame=null;resetSamples();}
  function pause(){lastTick=nextFrame=null;resetSamples();}
  function shouldRender(now){
    if(!Number.isFinite(now))return false;
    if(lastTick!==null){
      const elapsed=now-lastTick;
      // Hidden tabs, system sleep and debugger pauses are not device benchmarks.
      if(elapsed>1000||elapsed<0){pause();}
      else if(elapsed>0){intervalTotal+=elapsed;intervalCount++;}
    }
    lastTick=now;windowStart??=now;
    if(now-windowStart>=1000){
      const interval=intervalCount?intervalTotal/intervalCount:0,cpu=cpuCount?cpuTotal/cpuCount:0;
      if(intervalCount&&cpuCount){
        frameMs=interval;
        if(selected==='auto'){
          slowWindows=effective==='normal'&&(cpu>18||interval>25)?slowWindows+1:0;
          fastWindows=effective==='low'&&cpu<8&&interval<20?fastWindows+1:0;
          if(slowWindows>=3){effective='low';slowWindows=fastWindows=0;nextFrame=null;}
          // Require twenty healthy windows before probing full quality again.
          if(fastWindows>=20){effective='normal';slowWindows=fastWindows=0;nextFrame=null;}
        }
      }
      windowStart=now;intervalTotal=intervalCount=cpuTotal=cpuCount=0;
    }
    const interval=1000/(effective==='low'?30:60);
    if(nextFrame!==null&&now+.5<nextFrame)return false;
    // Carry fractional refresh periods forward, but never render catch-up bursts.
    nextFrame=nextFrame===null||now-nextFrame>interval?now+interval:nextFrame+interval;
    return true;
  }
  function recordRender(duration){
    if(!Number.isFinite(duration)||duration<0)return;
    cpuTotal+=duration;cpuCount++;frames++;cpuMs=frames===1?duration:cpuMs*.9+duration*.1;
  }
  return {setMode,pause,shouldRender,recordRender,
    get low(){return effective==='low';},
    dpr(deviceRatio=1){return Math.min(Math.max(1,Number(deviceRatio)||1),effective==='low'?1:2);},
    stats(){return {mode:selected,quality:effective,fps:effective==='low'?30:60,frames,cpuMs,frameMs};}};
}

// Bounds are in world coordinates. Unknown bounds are rendered conservatively.
export function intersectsView(view,box,padding=0){
  if(![view?.x,view?.y,view?.width,view?.height,box?.x,box?.y,box?.width,box?.height,padding].every(Number.isFinite))return true;
  return box.x+box.width+padding>=view.x&&box.x-padding<=view.x+view.width&&
    box.y+box.height+padding>=view.y&&box.y-padding<=view.y+view.height;
}
