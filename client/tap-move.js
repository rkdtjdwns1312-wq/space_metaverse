// Touch destinations use the ordinary server-authoritative movement input.
export function createTapMove(){
  let target=null;
  const cancel=()=>{target=null;};
  return {
    cancel,
    start(point,player,now){
      if(!player||!Number.isFinite(point?.x)||!Number.isFinite(point?.y))return;
      target={...point,mapId:player.mapId,until:now+20000,anchor:{x:player.x,y:player.y},progressAt:now};
    },
    steer(player,now){
      if(!target)return {x:0,y:0};
      if(!player||player.mapId!==target.mapId||player.vitals?.defeated||now>=target.until){cancel();return {x:0,y:0};}
      const dx=target.x-player.x,dy=target.y-player.y,distance=Math.hypot(dx,dy);
      // A fast avatar may cross the destination between snapshots. Stop there
      // instead of reversing direction indefinitely around the tapped point.
      if(distance<=12||(target.previous&&dx*target.previous.x+dy*target.previous.y<=0)){cancel();return {x:0,y:0};}
      target.previous={x:dx,y:dy};
      if(Math.hypot(player.x-target.anchor.x,player.y-target.anchor.y)>2){target.anchor={x:player.x,y:player.y};target.progressAt=now;}
      if(now-target.progressAt>900){cancel();return {x:0,y:0};}
      return {x:dx/distance,y:dy/distance};
    }
  };
}
