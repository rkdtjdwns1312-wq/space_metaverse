import {monitorEventLoopDelay} from 'node:perf_hooks';
const REASONS=new Set(['transport close','transport error','ping timeout','client namespace disconnect','server namespace disconnect','server shutting down','forced close','parse error']);
// Aggregate operational counters only: never retain names, room codes, addresses,
// tokens, request bodies, drawings or error messages.
export function createConnectionHealth({enabled=false,log=console.log,intervalMs=60000}={}){
 if(!enabled)return {connected(){},disconnected(){},action(){},stop(){},flush(){}};
 const delay=monitorEventLoopDelay({resolution:20});delay.enable();
 let joins=0,disconnects={},actions=0,failures=0,slow={},maxActionMs=0;
 function flush(){
  const report={connected:joins,disconnected:disconnects,actions,failures,slowActions:slow,maxActionMs:Math.round(maxActionMs),eventLoopP99Ms:Math.round(delay.percentile(99)/1e6),eventLoopMaxMs:Math.round(delay.max/1e6),rssMB:Math.round(process.memoryUsage().rss/1048576)};
  log('[connection-health] '+JSON.stringify(report));joins=actions=failures=maxActionMs=0;disconnects={};slow={};delay.reset();return report;
 }
 const timer=setInterval(flush,intervalMs);timer.unref();
 return {connected(){joins++;},disconnected(reason){const key=REASONS.has(reason)?reason:'other';disconnects[key]=(disconnects[key]||0)+1;},action(name,ms,failed=false){actions++;if(failed)failures++;if(Number.isFinite(ms)){maxActionMs=Math.max(maxActionMs,ms);if(ms>=250){const key=/^[a-z][a-z0-9:_-]{0,60}$/.test(name)?name:'other';if(Object.hasOwn(slow,key)||Object.keys(slow).length<64)slow[key]=(slow[key]||0)+1;}}},flush,stop(){clearInterval(timer);delay.disable();}};
}
