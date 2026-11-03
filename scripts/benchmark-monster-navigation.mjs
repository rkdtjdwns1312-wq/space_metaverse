// Identical collision queries; this measures collision probing, not whole-game FPS.
import assert from 'node:assert/strict';
import {performance} from 'node:perf_hooks';
import {nearbyMonsterBodies,bodyBlocksStep} from '../server/monster-navigation.js';
const self={mapId:'arena',x:500,y:500,radius:30,hp:100};
const monsters=new Map([['self',self]]);
// One close obstruction, same-map distant bodies and other-map bodies.
for(let i=0;i<79;i++)monsters.set(String(i),{mapId:i<20?'arena':'elsewhere',x:1000+(i%10)*100,y:1000+Math.floor(i/10)*100,radius:30,hp:100});
monsters.set('near',{mapId:'arena',x:570,y:500,radius:30,hp:100});
const queries=Array.from({length:11},(_,i)=>({x:500+Math.cos(i*Math.PI/6)*6,y:500+Math.sin(i*Math.PI/6)*6}));
let beforeChecks=0,afterChecks=0;
function before(count=false){return queries.map(({x,y})=>[...monsters.values()].some(o=>{
  if(count)beforeChecks++;
  if(o===self||o.hp<=0||o.mapId!==self.mapId)return false;
  const next=Math.hypot(x-o.x,y-o.y),current=Math.hypot(self.x-o.x,self.y-o.y),gap=self.radius+o.radius+10;
  return next<gap&&!(current<gap&&next>current+1e-6);
}));}
function after(count=false){const nearby=nearbyMonsterBodies(monsters,self,6);if(count)afterChecks+=monsters.size+nearby.length*queries.length;return queries.map(({x,y})=>bodyBlocksStep(nearby,x,y));}
assert.deepEqual(after(true),before(true));
for(let i=0;i<1000;i++){before();after();}
const samples={before:[],after:[]};let checksum=0;
for(let sample=0;sample<9;sample++)for(const [name,fn] of sample%2?[['after',after],['before',before]]:[['before',before],['after',after]]){
 const start=performance.now();for(let i=0;i<10000;i++)checksum+=fn().filter(Boolean).length;
 samples[name].push(performance.now()-start);
}
const median=a=>[...a].sort((a,b)=>a-b)[Math.floor(a.length/2)];
console.log(JSON.stringify({scenario:'81 bodies across maps, 11 blocked-direction probes, 10000 moves per sample, 9 alternating samples',beforeCandidateChecks:beforeChecks,afterCandidateChecks:afterChecks,beforeMedianMs:median(samples.before),afterMedianMs:median(samples.after),checksum,scope:'synthetic collision probes only, not whole server or student FPS'},null,2));
