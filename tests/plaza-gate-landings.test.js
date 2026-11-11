import test from 'node:test';
import assert from 'node:assert/strict';
import {MAP,STATIC_MAPS} from '../shared/config.js';
import {PLAZA_GATE_LANDINGS,PLAZA_ROUTES,PLAZA_VIEW_BOUNDS,PLAZA_LAYOUT,onPlazaFloor,migrateLegacyPlazaPosition} from '../shared/plaza-layout.js';
import {avatarPositionIsClear} from '../shared/avatar-boundary.js';
import {gateLabelBaseline,gateLabelBelow} from '../client/gate-art.js';

test('four diagonal gate landings fit the map and join the central floor for large avatars',()=>{
 const bounds=PLAZA_VIEW_BOUNDS,c=PLAZA_LAYOUT.center,player={role:'student',avatar:{level:5},transformation:{active:true}};
 for(const z of PLAZA_GATE_LANDINGS){
  assert(z.x-z.rx>=bounds.x&&z.x+z.rx<=bounds.x+bounds.width);
  assert(z.y-z.ry>=bounds.y&&z.y+z.ry<=bounds.y+bounds.height);
  const route=PLAZA_ROUTES.find(r=>r.id===z.id),gate=MAP.objects.find(o=>o.target===route.target);
  assert.equal(gate.labelBelow,z.y<c.y);
  assert(avatarPositionIsClear(MAP,gate.x,gate.y,player));
  for(let step=0;step<=100;step++){
   const t=step/100,x=c.x+(z.x-c.x)*t,y=c.y+(z.y-c.y)*t;
   assert(onPlazaFloor(MAP,x,y,60),z.id+' bridge '+step);
  }
  const saved={mapId:MAP.id,x:gate.x,y:gate.y};
  assert.deepEqual(migrateLegacyPlazaPosition(saved),saved,'new landing must not become an old satellite save');
  const back=STATIC_MAPS[route.target].objects.find(o=>o.target===MAP.id);
  assert(avatarPositionIsClear(MAP,back.arrival.x,back.arrival.y,player));
 }
});

test('gate names have six pixels of visible separation above or below artwork',()=>{
 const ctx={lineWidth:5,measureText:()=>({actualBoundingBoxAscent:17,actualBoundingBoxDescent:3})},box={y:100,height:130};
 const above=gateLabelBaseline(ctx,'목적지',box),below=gateLabelBaseline(ctx,'목적지',box,true);
 assert.equal(box.y-(above+3+2.5),6);
 assert.equal(below-17-2.5-(box.y+box.height),6);
});

test('northern gate labels move below within cropped map bounds without flipping side and southern gates',()=>{
 const north=MAP.objects.find(o=>o.id==='gate-origin');assert.equal(gateLabelBelow(north,MAP),true);
 for(const id of ['gate-street','gate-garden','gate-valley','gate-market','gate-department'])assert.equal(gateLabelBelow(MAP.objects.find(o=>o.id===id),MAP),false,id);
 for(const map of Object.values(STATIC_MAPS))for(const o of map.objects||[]){
  if(o.kind==='gate'&&o.y-(map.viewBounds?.y??0)<=100)assert.equal(gateLabelBelow(o,map),true,map.id);
 }
});
