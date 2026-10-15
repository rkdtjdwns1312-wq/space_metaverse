// Actual game integration of the eight legacy animation generators and teacher.
import assert from 'node:assert/strict';
import {writeFile,mkdir} from 'node:fs/promises';
import {chromium} from 'playwright';
import {createClassroomServer} from '../server/app.js';
import {fillNewClass} from './class-setup.mjs';
import {PLAZA_ID} from '../shared/config.js';
const game=createClassroomServer({teacherKey:'custom-motion-local-test',studentHours:false});let browser;const errors=[],results=[];
try{
 const url=`http://127.0.0.1:${(await game.listen()).port}`;
 browser=await chromium.launch({headless:true,...(process.platform==='win32'?{channel:'msedge'}:{}),args:['--no-proxy-server']});
 const page=await browser.newPage({viewport:{width:1100,height:800}});page.on('pageerror',e=>errors.push(e.message));
 await page.addInitScript(()=>{const original=CanvasRenderingContext2D.prototype.drawImage;CanvasRenderingContext2D.prototype.drawImage=function(source,...args){if(this.canvas.id==='world'&&args.length===4&&args[0]===-args[2]/2&&args[1]===-args[3]/2&&(source instanceof HTMLCanvasElement&&source.width===256||source instanceof HTMLImageElement&&source.src.includes('/avatars/')))window.avatarDrawKind=source instanceof HTMLCanvasElement?'frame':'original';return original.call(this,source,...args);};});
 await page.goto(url);await page.locator('#teacher-tab').click();await page.locator('#teacher-key').fill('custom-motion-local-test');await fillNewClass(page,['연습학생']);await page.locator('#teacher-form .submit').click();await page.locator('#lobby').waitFor({state:'hidden'});
 const room=[...game.store.rooms.values()][0],p=[...room.players.values()].find(p=>p.role==='teacher');
 const publish=()=>game.io.to(p.socketId).emit('room:state',game.store.snapshot(room,p));
 const move=async(n=10)=>{for(let i=0;i<n;i++){p.x+=4;publish();await page.waitForTimeout(90);}};
 for(const id of ['cetus','gemini','aquarius','capricorn','taurus','libra','hercules','corvus','teacher'])for(const level of id==='teacher'?[1]:[2,3,4]){
  Object.assign(p,{mapId:PLAZA_ID,x:650,y:900,facingX:1});Object.assign(p.avatar,{level,constellationId:id==='teacher'?'aquarius':id,form:'constellation',teacherPreview:id!=='teacher'});publish();
  await page.waitForFunction(id=>document.querySelector('#world').dataset.selfSprite.includes(id==='teacher'?'star-sovereign':id),id);
  await move(18);await page.waitForTimeout(1200);await move();
  await page.waitForFunction(()=>window.avatarDrawKind==='frame');
  await page.waitForTimeout(500);assert.equal(await page.evaluate(()=>window.avatarDrawKind),'original',`${id}${level} idle`);
  p.facingX=-1;publish();await page.waitForFunction(()=>document.querySelector('#world').dataset.selfFacingX==='-1');
  await page.emulateMedia({reducedMotion:'reduce'});await move(4);assert.equal(await page.evaluate(()=>window.avatarDrawKind),'original',`${id}${level} reduced motion`);await page.emulateMedia({reducedMotion:'no-preference'});
  results.push({id,level,moving:true,idle:true,left:true,reduced:true});
 }
 assert.deepEqual(errors,[]);await mkdir('.local/644-walk',{recursive:true});await writeFile('.local/644-walk/custom-integration.json',JSON.stringify({results,errors},null,2));console.log(JSON.stringify({integrations:results.length,errors}));
}finally{await browser?.close();await game.close();}
