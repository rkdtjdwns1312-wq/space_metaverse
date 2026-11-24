// Warm only the nearest approached gate, not every map at login. The actual
// renderer owns/reuses the Images. Entering a map never waits for this queue.
export function createMapTransitionPreload({prepare,mapOf,connection=()=>globalThis.navigator?.connection,isHidden=()=>!!globalThis.document?.hidden,schedule=fn=>setTimeout(fn,180),cancel=clearTimeout}={}){
  let pending=null,busy=false,lastCheck=-Infinity;
  const attempted=new Set();
  function clearPending(){if(pending){cancel(pending.timer);pending=null;}}
  function update({map,player,planets=[],ready=false,hidden=false,time=0}){
    const net=connection();
    if(hidden||!ready||!player||net?.saveData||['slow-2g','2g'].includes(net?.effectiveType)){
      clearPending();return;
    }
    if(pending&&pending.from!==map.id)clearPending();
    if(time-lastCheck<250)return;
    lastCheck=time;
    const gate=map.objects.filter(o=>['gate','black-hole'].includes(o.kind)&&o.target&&o.target!==map.id)
      .map(o=>({gate:o,distance:Math.hypot(player.x-o.x,player.y-o.y)}))
      .filter(o=>o.distance<=650).sort((a,b)=>a.distance-b.distance)[0]?.gate;
    if(!gate||attempted.has(gate.target)){clearPending();return;}
    if(pending?.target===gate.target||busy)return;
    clearPending();
    const task={from:map.id,target:gate.target};
    task.timer=schedule(()=>{
      if(pending!==task)return;
      const net=connection();
      if(isHidden()||net?.saveData||['slow-2g','2g'].includes(net?.effectiveType)){pending=null;return;}
      pending=null;busy=true;attempted.add(task.target);
      // A prefetch failure must not escape as an unhandled rejection or prevent
      // the foreground loader from using its existing retry/error handling.
      Promise.resolve().then(()=>prepare(mapOf(task.target,planets),planets,{speculative:true})?.promise)
        .catch(()=>{}).finally(()=>{busy=false;});
    });
    pending=task;
  }
  return {update,cancel:clearPending};
}
