import assert from 'node:assert/strict';
import {mkdirSync} from 'node:fs';
import {chromium} from 'playwright';
import {createClassroomServer} from '../server/app.js';
import {fillNewClass} from './class-setup.mjs';
import {saveNotice} from '../server/temple.js';
import {isNear} from '../server/world.js';
import {MAP,STREET} from '../shared/config.js';
let now=Date.parse('2026-11-03T03:00:00Z');
const teacherKey='isolated-stat-growth',game=createClassroomServer({teacherKey,studentHours:false,clock:()=>now,statGrowthDraw:()=>0});
const {port}=await game.listen(),browser=await chromium.launch({headless:true,channel:'msedge',args:['--no-proxy-server']}),errors=[];
mkdirSync('.local/stat-growth',{recursive:true});
const close=async page=>{for(let n=0;n<12&&await page.locator('dialog[open]').count();n++)await page.keyboard.press('Escape');};
try{
 const teacher=await browser.newPage({viewport:{width:1280,height:900}}),page=await browser.newPage({viewport:{width:1280,height:900},hasTouch:true});
 for(const p of [teacher,page]){p.on('pageerror',e=>errors.push(e.message));await p.goto(`http://127.0.0.1:${port}`);}
 await teacher.locator('#teacher-tab').click();await teacher.locator('#teacher-key').fill(teacherKey);await fillNewClass(teacher,['학생1']);await teacher.locator('#teacher-form .submit').click();await teacher.locator('#lobby').waitFor({state:'hidden'});await close(teacher);
 const code=await teacher.locator('#room-code').textContent(),room=game.store.rooms.get(code);
 await page.locator('#student-tab').click();await page.locator('#join-code').fill(code);await page.locator('#nickname').fill('학생1');await page.locator('#student-pin').fill('1234');await page.locator('#student-form .submit').click();await page.locator('#lobby').waitFor({state:'hidden'});await close(page);
 const player=[...room.players.values()].find(p=>p.role==='student'),shop=STREET.objects.find(o=>o.kind==='energy-shop');
 const send=()=>game.io.to(player.socketId).emit('room:state',game.store.snapshot(room,player,now));
 const open=async()=>{Object.assign(player,{mapId:STREET.id,x:shop.x,y:shop.y+shop.radius+28});send();await page.locator('#interact-prompt').filter({hasText:'우주에너지 상점'}).waitFor({state:'visible'});await page.locator('#world').focus();await page.keyboard.press('f');await page.locator('#energy-shop-dialog[open]').waitFor();};

 player.avatar.level=2;saveNotice(room,'알림 과제',[0],now);send();
 await page.locator('#student-reminders-toggle').waitFor({state:'visible'});
 assert(await teacher.locator('#student-reminders').isHidden());
 for(const [label,width,height]of [['pc',1280,900],['mobile',390,844],['small',320,740]]){
  await page.setViewportSize({width,height});await page.locator('#student-reminders-toggle').click();
  await page.locator('#student-reminders-list').waitFor({state:'visible'});
  const geometry=await page.evaluate(()=>{const b=document.querySelector('#student-reminders-toggle').getBoundingClientRect(),h=document.querySelector('.vitals-hp').getBoundingClientRect(),l=document.querySelector('#student-reminders-list').getBoundingClientRect();return {left:b.right<=h.left,inside:l.left>=0&&l.right<=innerWidth};});assert.deepEqual(geometry,{left:true,inside:true});
  assert(await page.locator('[data-reminder="stats"]').isVisible());assert(await page.locator('[data-reminder="assignments"]').isVisible());
  await page.screenshot({path:'.local/stat-growth/reminders-'+label+'.png'});await page.keyboard.press('Escape');
 }
 for(const [id,map,kind]of [['stats',STREET,'energy-shop'],['assignments',MAP,'andromeda'],['missions',MAP,'mission-board']]){
  await page.locator('#student-reminders-toggle').click();if(!await page.locator('[data-reminder="'+id+'"]').count()){await page.keyboard.press('Escape');continue;}
  await page.locator('[data-reminder="'+id+'"]').click();await page.locator('#student-reminders-list').waitFor({state:'hidden'});assert.equal(player.mapId,map.id);assert(isNear(player,map.objects.find(o=>o.kind===kind)));
 }
 assert.deepEqual(errors,[]);console.log('PASS reminders PC/mobile/small viewport left of HP, vertical list, facility travel, teacher hidden, browser errors0');
}finally{await browser.close();await game.close();}
