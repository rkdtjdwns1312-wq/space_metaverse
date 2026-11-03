// Build the local collision set once per moving monster, not once per detour.
// Positions are read fresh so movement, summons and deaths earlier in the tick count.
export function nearbyMonsterBodies(monsters,m,travel){
  const bodies=[];
  for(const other of monsters.values()){
    if(other===m||other.hp<=0||other.mapId!==m.mapId)continue;
    const gap=m.radius+other.radius+10,dx=m.x-other.x,dy=m.y-other.y;
    if(Math.abs(dx)>gap+travel||Math.abs(dy)>gap+travel)continue;
    bodies.push({x:other.x,y:other.y,gapSquared:gap*gap,currentSquared:dx*dx+dy*dy});
  }
  return bodies;
}

export function bodyBlocksStep(bodies,x,y){
  return bodies.some(body=>{
    const dx=x-body.x,dy=y-body.y,nextSquared=dx*dx+dy*dy;
    // Existing overlaps can separate but cannot move farther into a neighbour.
    return nextSquared<body.gapSquared&&!(body.currentSquared<body.gapSquared&&nextSquared>body.currentSquared+1e-6);
  });
}

const TURNS=[30,60,90,120,150].map(deg=>deg*Math.PI/180);
export function monsterDetour(m,travel,blockedAt){
  const angle=Math.atan2(m.dy,m.dx),side=m.avoidanceSide===-1?-1:1;
  // Keep the chosen side along the obstacle instead of oscillating left/right.
  for(const directionSide of [side,-side])for(const turn of TURNS){
    const direction=angle+turn*directionSide,dx=Math.cos(direction),dy=Math.sin(direction);
    const x=m.x+dx*travel,y=m.y+dy*travel;
    if(!blockedAt(x,y))return {x,y,dx,dy,side:directionSide};
  }
  return null;
}
