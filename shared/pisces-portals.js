const clamp=x=>Math.max(0,Math.min(1,x));
export function piscesPortalTiming(stage){const hits=stage===2?4:stage===3?2:1,stagger=hits===2?500:300;return {hits,stagger,durationMs:2000-(hits-1)*stagger};}
export function piscesPortalGeometry(cast,progress=0){
  const stage=Math.max(2,Math.min(4,cast.fishStage||cast.level||2));
  const length=cast.size*({2:.95,3:1.45,4:2.25}[stage]);
  const height=length*.5,start=cast.originOffset??cast.size*.5,end=cast.range;
  const p=clamp(progress),center=start-length/2+(end-start+length)*p;
  return {stage,length,height,start,end,center,nose:Math.min(end,center+length/2),
    portalRadius:height*.67,progress:p};
}
