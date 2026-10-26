import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
import {chromium} from 'playwright';
import {createClassroomServer} from '../server/app.js';
import {fillNewClass} from './class-setup.mjs';
import {CONSTELLATIONS,constellationOf} from '../shared/constellations.js';
import {PLAZA_ID,MAP} from '../shared/config.js';
import {isFree} from '../server/world.js';
// Track generated canvas frames back to their original sprite, including pixel
// composition; an Image.src-only spy silently misses actual walking poses.
function instrument(){
 const sources=new WeakMap(),proto=CanvasRenderingContext2D.prototype,draw=proto.drawImage,get=proto.getImageData,put=proto.putImageData,ellipse=proto.ellipse;
 window.spriteTransforms={};window.walkTransforms={};window.avatarRingCount=0;
 proto.ellipse=function(x,y,rx,ry,...args){if(this.strokeStyle==='#ffe8a3'||this.canvas.id==='world'&&rx===23&&ry===8&&this.strokeStyle==='#8061b0')window.avatarRingCount++;return ellipse.call(this,x,y,rx,ry,...args);};
 proto.drawImage=function(image,...args){const paths=image?.src?new Set([new URL(image.src,location.href).pathname]):sources.get(image);
  if(paths){if(this.canvas.id==='world')for(const path of paths){window.spriteTransforms[path]=this.getTransform().a;if(!image.src)window.walkTransforms[path]=this.getTransform().a;}
  else sources.set(this.canvas,new Set([...(sources.get(this.canvas)||[]),...paths]));}return draw.call(this,image,...args);};
 proto.getImageData=function(...args){const result=get.apply(this,args),paths=sources.get(this.canvas);if(paths)sources.set(result,new Set(paths));return result;};
 proto.putImageData=function(data,...args){const paths=sources.get(data);if(paths)sources.set(this.canvas,new Set(paths));return put.call(this,data,...args);};
}
const LV2_LEFT_FACING=new Set(['corvus','taurus','leo','ophiuchus','cancer','cygnus','aries']);
const LV3_LEFT_FACING=new Set(['taurus','leo','cancer']);
const LV4_LEFT_FACING=new Set(['ophiuchus','corvus']);
const LV5_LEFT_FACING=new Set(['aquarius','taurus','cetus','ophiuchus']);
const key='facing-layout-isolated-key',game=createClassroomServer({teacherKey:key,studentHours:false});
const url=`http://127.0.0.1:${(await game.listen()).port}`;
const browser=await chromium.launch({headless:true,...(process.platform==='win32'?{channel:'msedge'}:{})}),errors=[];
try{
 await mkdir('.local',{recursive:true});
 const teacher=await browser.newPage({viewport:{width:1440,height:960}}),page=await browser.newPage({viewport:{width:1440,height:960}});
 for(const [label,tab] of [['self',page],['peer',teacher]]){tab.setDefaultTimeout(10000);tab.on('pageerror',e=>errors.push(label+': '+e.message));await tab.addInitScript(instrument);}
 await teacher.goto(url);await teacher.locator('#teacher-tab').click();await teacher.locator('#teacher-key').fill(key);await fillNewClass(teacher,['1']);await teacher.locator('#teacher-form .submit').click();await teacher.locator('#lobby').waitFor({state:'hidden'});
 const room=[...game.store.rooms.values()][0];await page.goto(url);await page.locator('#student-tab').click();await page.locator('#join-code').fill(room.code);await page.locator('#nickname').fill('1');await page.locator('#student-pin').fill('1234');await page.locator('#student-form .submit').click();await page.locator('#lobby').waitFor({state:'hidden'});if(await page.locator('#tutorial-dialog').isVisible().catch(()=>false))await page.locator('#tutorial-later').click();
 const p=[...room.players.values()].find(p=>p.role==='student');
 const observer=[...room.players.values()].find(p=>p.role==='teacher');
 const publish=()=>{for(const viewer of [p,observer])game.io.to(viewer.socketId).emit('room:state',game.store.snapshot(room,viewer));};
 for(const c of CONSTELLATIONS)for(const [level,transformed] of [[2,false],[3,false],[4,false],[5,false],[5,true]])for(const sign of [-1,1]){
  p.avatar.level=level;p.avatar.constellationId=c.id;p.transformation=transformed?{active:true,constellationId:c.id,endsAt:Date.now()+60000,cooldownUntil:Date.now()+60000}:null;const appearanceLevel=level===5&&!transformed?4:level;p.facingX=sign;const stage=constellationOf(c.id,appearanceLevel),sprite=stage.sprite;
  const expectedSign=sign*(((appearanceLevel===2&&LV2_LEFT_FACING.has(c.id))||(appearanceLevel===3&&LV3_LEFT_FACING.has(c.id))||(appearanceLevel===4&&LV4_LEFT_FACING.has(c.id))||(appearanceLevel===5&&LV5_LEFT_FACING.has(c.id)))?-1:1);
  await page.evaluate(path=>{delete window.spriteTransforms[path];window.avatarRingCount=0;},sprite);publish();await page.waitForTimeout(250);
  await page.waitForFunction(({sprite,expectedSign})=>Math.sign(window.spriteTransforms[sprite])===expectedSign,{sprite,expectedSign}).catch(async error=>{throw new Error(`sprite transform missing ${sprite}; keys=${JSON.stringify(await page.evaluate(()=>Object.keys(window.spriteTransforms)))}`,{cause:error});});
  assert.equal(await page.evaluate(()=>window.avatarRingCount),0,`${c.id} LV${level} ring overlay absent`);
 }
 console.log('PASS: 160 actual canvas poses: 16 constellations × LV2/3/4/LV5 ordinary/LV5 transformed × left/right; independent golden facing sets');
 // Keep the observer close enough to render the moving student. Require real
 // displacement and offscreen-frame draws, not just a facing dataset change.
 p.avatar.level=5;p.avatar.constellationId='aries';p.transformation=null;p.mapId=PLAZA_ID;observer.mapId=PLAZA_ID;
 let safe;
 for(let y=250;y<MAP.height-250&&!safe;y+=80)for(let x=300;x<MAP.width-300&&!safe;x+=80)
  if([-180,0,180].every(dx=>[-140,0,140].every(dy=>isFree(room,x+dx,y+dy,p.id,PLAZA_ID,false,p))))safe={x,y};
 assert.ok(safe,'safe movement corridor');
 Object.assign(p,safe,{facingX:1,input:{x:0,y:0,at:0}});Object.assign(observer,{x:safe.x,y:safe.y+180,input:{x:0,y:0,at:0}});publish();
 if(await teacher.locator('#tutorial-dialog').isVisible())await teacher.locator('#tutorial-later').click();
 const walkingSprite=constellationOf('aries',4).sprite;
 await Promise.all([page,teacher].map(tab=>tab.waitForFunction(path=>!!window.spriteTransforms[path],walkingSprite)));
 await page.locator('#world').focus();
 for(const [button,sign] of [['a',-1],['d',1]]){
  const before=p.x;
  await Promise.all([page,teacher].map(tab=>tab.evaluate(path=>{delete window.walkTransforms[path];},walkingSprite)));
  await page.keyboard.down(button);await page.waitForTimeout(220);await page.keyboard.up(button);
  assert.ok((p.x-before)*sign>5,button+' produces actual displacement');assert.equal(p.facingX,sign);
  for(const tab of [page,teacher])await tab.waitForFunction(({path,sign})=>Math.sign(window.walkTransforms[path])===sign,{path:walkingSprite,sign});
  await page.waitForFunction(sign=>document.getElementById('world').dataset.selfFacingX===String(sign),sign);
  await page.screenshot({path:'.local/217-'+(sign<0?'left':'right')+'.png'});
 }
 const beforeY=p.y;await page.keyboard.down('w');await page.waitForTimeout(130);await page.keyboard.up('w');
 assert.ok(p.y<beforeY-5,'W produces actual displacement');assert.equal(p.facingX,1);await page.waitForTimeout(220);assert.equal(p.facingX,1);
 assert.equal(await page.locator('#world').getAttribute('data-self-facing-x'),'1');
 console.log('PASS: Aries LV5 ordinary real A/D displacement and generated walking-frame direction in BOTH self and peer; W/idle preserve horizontal facing');
 console.log('SCOPE: Q/E geometry is covered by current combat/Aries tests, not this facing harness; obsolete generic-melee constants are not asserted.');
 await page.locator('#dock-avatar').click();await page.waitForTimeout(200);assert.equal(await page.evaluate(()=>window.avatarRingCount),0);await page.screenshot({path:'.local/229-no-ring-portrait.png'});
 console.log('PASS: LV2-5 world avatar ring overlays absent; LV5 portrait ring absent');
 assert.deepEqual(errors,[]);
}finally{await browser.close();await game.close();}
