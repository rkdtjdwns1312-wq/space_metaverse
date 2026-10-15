// A small rigid body response complements the separate limbs. Speed never drives its frequency.
export function createBodyMotion(){
 const actors=new Map();
 return {
  sample(id,key,x,y,time,reduced=false,floating=false){
   let s=actors.get(id);
   if(!s||s.key!==key||time<s.time||Math.hypot(x-s.x,y-s.y)>240){s={key,x,y,time,phase:0,weight:0,until:time};actors.set(id,s);}
   const dt=Math.min(80,Math.max(0,time-s.time));
   if(Math.hypot(x-s.x,y-s.y)>.12)s.until=time+130;
   const active=!reduced&&time<s.until;
   s.weight=reduced?0:Math.max(0,Math.min(1,s.weight+(active?dt/220:-dt/280)));
   if(s.weight)s.phase+=dt*(Math.PI*2/(floating?2100:1500));else s.phase=0;
   Object.assign(s,{x,y,time});
   return {y:-s.weight*(floating?2.4:1.7)*(1-Math.cos(s.phase*(floating?1:2)))/2,angle:s.weight*Math.sin(s.phase)*(floating?.014:.012),weight:s.weight};
  },
  clear(){actors.clear();},retain(ids){const keep=new Set(ids);for(const id of actors.keys())if(!keep.has(id))actors.delete(id);}
 };
}
