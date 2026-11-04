// Keep the existing per-second execution budget. A short input burst must not
// terminate the student's session; only repeated extreme traffic disconnects.
export function createSocketRateLimit({clock=Date.now,limit=80,floodLimit=400,floodWindows=3}={}){
 let started=clock(),count=0,previousFloods=0;
 return ()=>{
  const now=clock(),elapsed=now-started;
  if(elapsed>=1000||elapsed<0){
   previousFloods=elapsed>=1000&&elapsed<2000&&count>floodLimit?previousFloods+1:0;
   started=now;count=0;
  }
  count++;
  if(count>floodLimit&&previousFloods>=floodWindows-1)return 'disconnect';
  return count>limit?'reject':'allow';
 };
}
export function socketRateMiddleware(socket,options){
 const check=createSocketRateLimit(options);
 return (packet,next)=>{
  const decision=check();
  if(decision==='allow'){next();return;}
  if(decision==='disconnect'){socket.disconnect(true);return;}
  const ack=packet[packet.length-1];
  if(typeof ack==='function')ack({ok:false,error:'요청이 잠시 몰렸어요. 잠시 뒤 다시 시도해주세요.',retryable:true});
 };
}
