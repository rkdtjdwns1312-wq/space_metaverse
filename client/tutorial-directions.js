import {MAP,STREET,VALLEY,STATIC_MAPS,PLAZA_ID,STREET_ID,VALLEY_ID,mapOf} from '../shared/config.js';
import {PLAZA_LAYOUT} from '../shared/plaza-layout.js';
import {STREET_LAYOUT} from '../shared/street-layout.js';
import {VALLEY_LAYOUT} from '../shared/valley-layout.js';
import {avatarPositionIsClear,avatarCollisionShape} from '../shared/avatar-boundary.js';

export function journeyDestination(goal){
 const pillar=MAP.objects.find(o=>o.id===goal||(goal==='effects-seen'&&o.id==='pillar-effects'));
 if(pillar)return {...pillar,mapId:PLAZA_ID,interact:true};
 const island=PLAZA_LAYOUT.islands.find(i=>i.id===goal);
 if(island)return {...island,mapId:PLAZA_ID};
 const zones={station:STREET_LAYOUT.north,shops:STREET_LAYOUT.upper,playground:STREET_LAYOUT.lower};
 if(zones[goal])return {...zones[goal],name:{station:'별 발전소',shops:'상점가',playground:'놀이터'}[goal],mapId:STREET_ID};
 const star=VALLEY.objects.find(o=>o.id===goal);
 return star?{...star,mapId:VALLEY_ID,interact:true}:null;
}
function nextGate(mapId,targetId,planets){
 const map=mapOf(mapId,planets),queue=[{map,first:null}],seen=new Set([mapId]);
 while(queue.length){const current=queue.shift();for(const gate of current.map.objects.filter(o=>o.kind==='gate'||o.kind==='door')){
  const id=gate.target||(gate.kind==='door'?PLAZA_ID:null);if(!id||seen.has(id))continue;
  const first=current.first||gate;if(id===targetId)return first;
  if(STATIC_MAPS[id]){seen.add(id);queue.push({map:STATIC_MAPS[id],first});}
 }}return null;
}
const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
const routeGraphs=new Map();
function clear(map,a,b,player){
 // Thin bridge corners can be missed by coarse sampling, especially on a
 // long direct shortcut between two otherwise valid floor locations.
 const n=Math.max(1,Math.ceil(distance(a,b)/8));
 for(let i=1;i<=n;i++)if(!avatarPositionIsClear(map,a.x+(b.x-a.x)*i/n,a.y+(b.y-a.y)*i/n,player,[],{...a,mapId:map.id}))return false;
 return true;
}
function goalCandidates(map,target,player,shape){
 const blocked=target.interact&&!target.passable;
 if(!blocked)return [{x:target.x,y:target.y}];
 const radius=(target.radius||0)+shape.radius+12,origin={x:target.x,y:target.y};
 // Sweep around the object so walls or adjacent props cannot leave the route
 // aimed at an unreachable south side. Keep ordering independent of the
 // player's position so cached static graph edges remain reusable.
 const start=0,points=[];
 for(let i=0;i<24;i++){
  const angle=start+i*Math.PI*2/24,p={x:origin.x+Math.cos(angle)*radius,y:origin.y+Math.sin(angle)*radius-shape.offsetY};
  if(avatarPositionIsClear(map,p.x,p.y,player))points.push(p);
 }
 return points;
}
// Use the same floor and lower-body collision rules as movement; route along bridges.
export function journeyRoute(player,goal,planets=[]){
 const destination=journeyDestination(goal);if(!destination)return null;
 const map=mapOf(player.mapId,planets),gate=player.mapId===destination.mapId?null:nextGate(player.mapId,destination.mapId,planets);
 if(player.mapId!==destination.mapId&&!gate)return null;
 const target=gate?{...gate,interact:true,mapId:map.id}:destination,shape=avatarCollisionShape(player);
 const ends=goalCandidates(map,target,player,shape);if(!ends.length)return {target,points:[],reachable:false};
 const end=ends[0];
 if(clear(map,player,end,player))return {target,points:[end],reachable:true};
 const hubs=map.id===PLAZA_ID?[PLAZA_LAYOUT.center,...PLAZA_LAYOUT.islands]:map.id===STREET_ID?[STREET_LAYOUT.north,STREET_LAYOUT.upper,STREET_LAYOUT.lower,{x:STREET_LAYOUT.upper.x,y:STREET_LAYOUT.upper.y-300},{x:STREET_LAYOUT.upper.x,y:STREET_LAYOUT.upper.y+300}]:map.id===VALLEY_ID?[VALLEY_LAYOUT.center,...VALLEY_LAYOUT.temples]:[];
 const nodes=[{x:player.x,y:player.y},...ends,...hubs];
 for(const object of map.objects.filter(o=>!o.passable))for(let i=0;i<8;i++){
  const a=i*Math.PI/4,r=object.radius+shape.radius+26;
  const p={x:object.x+Math.cos(a)*r,y:object.y+Math.sin(a)*r-shape.offsetY};
  if(avatarPositionIsClear(map,p.x,p.y,player))nodes.push(p);
 }
 const graphKey=map.id+':'+shape.radius+':'+shape.offsetY+':'+shape.halfWidth+':'+JSON.stringify(nodes.slice(1))+':'+JSON.stringify(map.objects.map(o=>[o.id,o.x,o.y,o.radius,o.passable]));
 let edges=routeGraphs.get(graphKey);if(!edges){if(routeGraphs.size>=16)routeGraphs.delete(routeGraphs.keys().next().value);edges=new Map();routeGraphs.set(graphKey,edges);}
 const costs=nodes.map(()=>Infinity),previous=[],visited=new Set();costs[0]=0;
 for(let k=0;k<nodes.length;k++){
  let best=-1;for(let i=0;i<nodes.length;i++)if(!visited.has(i)&&(best<0||costs[i]<costs[best]))best=i;
  if(best<0||!Number.isFinite(costs[best]))break;if(best>0&&best<=ends.length)break;visited.add(best);
  for(let i=0;i<nodes.length;i++){if(visited.has(i))continue;const d=distance(nodes[best],nodes[i]);if(costs[best]+d>=costs[i])continue;
   const key=[Math.min(i,best),Math.max(i,best)].join(':');
   const allowed=best===0?clear(map,nodes[best],nodes[i],player):edges.has(key)?edges.get(key):clear(map,nodes[best],nodes[i],player);
   if(best!==0&&!edges.has(key))edges.set(key,allowed);
   if(allowed){costs[i]=costs[best]+d;previous[i]=best;}
  }
 }
 let reached=-1;for(let i=1;i<=ends.length;i++)if(Number.isFinite(costs[i])&&(reached<0||costs[i]<costs[reached]))reached=i;
 const points=[];if(reached>0){for(let i=reached;i!==0;i=previous[i])points.unshift(nodes[i]);}
 return {target,points,reachable:points.length>0};
}

// Share the same collision sampling with the tutorial UI when it decides
// whether an emitted waypoint remains a safe next step after the player moves.
export function journeySegmentClear(player,from,to,planets=[]){
 if(!player||!from||!to||!Number.isFinite(from.x)||!Number.isFinite(from.y)||!Number.isFinite(to.x)||!Number.isFinite(to.y))return false;
 const map=mapOf(player.mapId,planets);
 if(map.id!==player.mapId)return false;
 if((from.mapId&&from.mapId!==map.id)||(to.mapId&&to.mapId!==map.id))return false;
 return clear(map,from,to,player);
}
