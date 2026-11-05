import {MONSTER_BODY_GEOMETRY} from '../shared/monster-geometry.js';
import assert from 'node:assert/strict';
import {mkdirSync} from 'node:fs';
import {chromium} from 'playwright';
import {createClassroomServer} from '../server/app.js';
import {fillNewClass} from './class-setup.mjs';
import {mapOf} from '../shared/config.js';
import {FORGOTTEN_CONSTELLATION as spec} from '../shared/forgotten-constellation.js';
import {STAR_RECORD} from '../shared/star-record.js';

const key='isolated-forgotten',now=Date.now(),game=createClassroomServer({teacherKey:key,studentHours:false,clock:()=>now});
const {port}=await game.listen(),browser=await chromium.launch({headless:true,channel:'msedge',args:['--no-proxy-server']});
const output='.local/forgotten-constellation';mkdirSync(output,{recursive:true});
try{
 const page=await browser.newPage({viewport:{width:1280,height:900}}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://127.0.0.1:'+port);await page.locator('#teacher-tab').click();await page.locator('#teacher-key').fill(key);await fillNewClass(page,['검사']);await page.locator('#teacher-form .submit').click();
 await page.locator('#lobby').waitFor({state:'hidden'});for(let i=0;i<12&&await page.locator('dialog[open]').count();i++)await page.keyboard.press('Escape');
 const room=game.store.rooms.get(await page.locator('#room-code').textContent()),player=[...room.players.values()].find(p=>p.role==='teacher');
 const move=async(mapId,x,y)=>{Object.assign(player,{mapId,x,y,input:{x:0,y:0,at:0}});game.io.to(player.socketId).emit('room:state',game.store.snapshot(room,player,now));await page.waitForFunction(id=>document.querySelector('#minimap').dataset.mapId===id,mapId);};
 const statue=mapOf(spec.mapId).objects.find(o=>o.id===spec.statueId),dialog=page.locator('#forgotten-constellation-dialog');
 await move(spec.mapId,statue.x,statue.y+110);
 await page.waitForFunction(()=>document.querySelector('#world').dataset.artStatus==='ready');await page.locator('#interact-prompt').click();
 assert.match(await dialog.innerText(),/별자리의 기원을 소환할까요/);await dialog.locator('img').evaluate(img=>img.decode());await page.screenshot({path:output+'/summon.png'});
 await dialog.locator('[data-cancel]').click();assert(!room.monsters.has(spec.monsterId));
 await page.locator('#interact-prompt').click();await dialog.locator('[data-summon]').click();await dialog.waitFor({state:'hidden'});
 await page.waitForFunction(()=>document.querySelector('#world').dataset.monsterMaxHp==='20000'&&document.querySelector('#world').dataset.monsterMaxMp==='100');
 const boss=room.monsters.get(spec.monsterId);assert.deepEqual([boss.x,boss.y,boss.hp,boss.mp],[statue.x,statue.y,20000,100]);
 await move(spec.mapId,boss.x-210,boss.y+80);await page.waitForTimeout(300);
 await page.screenshot({path:output+'/boss-desktop.png'});await page.setViewportSize({width:390,height:844});await page.locator('#minimap-toggle').click();await move(spec.mapId,boss.x,boss.y+195);await page.waitForTimeout(400);await page.screenshot({path:output+'/boss-mobile.png'});
 // Verify that the renderer preserves the artwork proportions and animates only when motion is enabled.
 const frames=()=>page.evaluate(async()=>{
  const {preloadForgottenArt,drawForgottenBoss,forgottenBounds}=await import('/forgotten-constellation-art.js');await preloadForgottenArt();
  const canvas=document.createElement('canvas');canvas.width=720;canvas.height=500;const ctx=canvas.getContext('2d'),m={x:340,y:250,radius:150};
  const frame=t=>{ctx.clearRect(0,0,720,500);drawForgottenBoss(ctx,m,t);return canvas.toDataURL();};
  const bounds=forgottenBounds(m);return {animated:frame(0)!==frame(780),ratio:bounds.width/bounds.height};
 });
 const geometry=await page.evaluate(async()=>{
  const img=new Image();img.src='/assets/monsters/forgotten-constellation.webp';await img.decode();
  const canvas=document.createElement('canvas');canvas.width=img.width;canvas.height=img.height;const ctx=canvas.getContext('2d');ctx.drawImage(img,0,0);
  const pixels=ctx.getImageData(0,0,img.width,img.height).data;let left=img.width,right=0;
  for(let y=0;y<img.height;y++)for(let x=0;x<img.width;x++)if(pixels[(y*img.width+x)*4+3]>=128){left=Math.min(x,left);right=Math.max(x+1,right);}
  return {width:img.width,left,right};
 });
 const body=MONSTER_BODY_GEOMETRY[spec.typeId];assert.deepEqual(geometry,{width:body.sourceWidth,left:body.left,right:body.right});assert.equal(body.anchorX,geometry.width/2);
 const first=await frames();assert(first.animated);assert(Math.abs(first.ratio-704/296)<.001);
 await page.emulateMedia({reducedMotion:'reduce'});assert.equal((await frames()).animated,false);
 const previousStatue=mapOf(STAR_RECORD.mapId).objects.find(o=>o.id===STAR_RECORD.statueId);
 await page.locator('#minimap-toggle').click();await move(STAR_RECORD.mapId,previousStatue.x,previousStatue.y+110);
 await page.locator('#interact-prompt').click();await page.locator('#star-record-dialog [data-summon]').click();await page.waitForFunction(()=>document.querySelector('#world').dataset.monsterMaxHp==='15000');
 assert.deepEqual(errors,[]);console.log('PASS actual stage3 statue, prompt, cancel, summon, HP20000 MP100, desktop/mobile artwork and reduced-motion, stage2 HP15000; JS errors0');
}finally{await browser.close();await game.close();}
