import test from 'node:test';
import assert from 'node:assert/strict';
import {piscesPortalGeometry} from '../shared/pisces-portals.js';
import {waterProjectilePoint} from '../shared/water-skills.js';
import {launchProjectiles,advanceProjectiles} from '../server/projectiles.js';
test('입출구는 단계별 물고기보다 넓고 물고기는 이동 중 고정 크기다',()=>{
 let last=0;
 for(const level of [2,3,4]){
  const cast={piscesPortal:true,level,size:100,range:480,originOffset:50,x:300,y:400,dx:1,dy:0};
  const start=piscesPortalGeometry(cast,0),end=piscesPortalGeometry(cast,1);
  assert(start.length>last);last=start.length;assert(start.portalRadius*2>start.height);
  assert.equal(start.center+start.length/2,50);assert.equal(end.center-end.length/2,480);
  for(let i=0;i<=48;i++){const g=piscesPortalGeometry(cast,i/48);assert.equal(g.length,start.length);assert.equal(g.height,start.height);assert(g.nose>=50&&g.nose<=480);}
  for(const [dx,dy]of [[1,0],[-1,0],[0,1],[0,-1]]){const p=waterProjectilePoint({...cast,dx,dy},.5);assert.equal(p.x,300+dx*265);assert.equal(p.y,400+dy*265);}
 }
});
test('입구 뒤·출구 밖에는 몸통 반높이만큼 가짜 사거리가 늘어나지 않는다',()=>{
 const player={id:'p',connected:true,role:'student',mapId:'m',avatar:{level:4,constellationId:'pisces'}};
 const room={players:new Map([['p',player]])};
 const base={piscesPortal:true,fishStage:4,kind:'pisces-skill',basic:false,piercing:true,size:100,width:56.25,visualScale:1.85,
  range:480,originOffset:50,durationMs:2000,x:0,y:0,dx:1,dy:0,power:1};
 const enemies=[['behind',20,0],['inside',180,50],['past',550,0]].map(([id,x,y])=>({kind:'monster',radius:5,entity:{id,x,y}}));
 launchProjectiles(room,player,base,1000);const hit=[];
 const damage=(r,p,selected)=>{hit.push(...selected.map(t=>t.entity.id));return {targets:[]};};
 advanceProjectiles(room,1000,()=>enemies,damage);assert.deepEqual(hit,[]);
 advanceProjectiles(room,2800,()=>enemies,damage);assert.deepEqual(hit,['inside']);
 assert.equal(room.projectiles.length,1,'머리가 출구에 들어가도 꼬리가 끝날 때까지 유지');
 advanceProjectiles(room,3000,()=>enemies,damage);assert.deepEqual(hit,['inside']);assert.equal(room.projectiles.length,0);
});
