import assert from 'node:assert/strict';
import {mkdirSync} from 'node:fs';
import {chromium} from 'playwright';
import {createClassroomServer} from '../server/app.js';
import {fillNewClass} from './class-setup.mjs';
import {STREET} from '../shared/config.js';
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
 player.cosmicEnergy=5000;await open();assert(await page.locator('#energy-stat-buy').isDisabled());assert.match(await page.locator('#energy-stat-description').textContent(),/Lv2로 진화/);await close(page);
 let hp=0;
 for(const [level,cost,weights,amounts]of [[2,20,[45,45,5,5],[1,1,1,1]],[3,60,[40,40,15,5],[1,1,1,1]],[4,140,[40,40,10,10],[2,2,1,1]],[5,300,[35,35,20,10],[3,3,2,1]]]){
  player.avatar.level=level;player.avatar.constellationId='aries';await open();
  assert.match(await page.locator('#energy-stat-description').textContent(),new RegExp(`Lv${level}.*${cost}개`));
  const labels=['최대 체력','최대 마나','공격력','방어력'];assert.equal(await page.locator('#energy-stat-chances').textContent(),labels.map((s,i)=>`${s} +${amounts[i]} (${weights[i]}%)`).join(' · '));
  assert.equal(await page.locator('#energy-stat-buy').textContent(),`능력치 구매 · ${cost}`);assert.equal(await page.locator('#energy-stat-buy').isDisabled(),false);
  await page.locator('#energy-shop-level-tabs [data-level="1"]').click();assert.match(await page.locator('#energy-stat-description').textContent(),new RegExp(`Lv${level}`));
  for(const [label,width,height]of [['pc',1280,900],['mobile',390,844]]){await page.setViewportSize({width,height});await page.locator('#energy-shop-dialog').evaluate(el=>el.scrollTop=0);assert(await page.locator('#energy-shop-dialog').evaluate(el=>el.scrollWidth<=el.clientWidth+1));await page.screenshot({path:`.local/stat-growth/lv${level}-${label}.png`});}
  const balance=player.cosmicEnergy;await page.locator('#energy-stat-buy').tap();await page.locator('#energy-stat-result').filter({hasText:`영구적으로 ${amounts[0]}`}).waitFor();hp+=amounts[0];assert.equal(player.statGrowth.bonuses.hp,hp);assert.equal(player.cosmicEnergy,balance-cost);assert(await page.locator('#energy-stat-buy').isDisabled());
  if(level<5){player.avatar.level=level+1;send();await page.waitForFunction(()=>document.querySelector('#energy-stat-buy')?.textContent==='오늘 구매 완료');assert(await page.locator('#energy-stat-buy').isDisabled());}
  await close(page);now+=86400000;await page.setViewportSize({width:1280,height:900});
 }
 assert.deepEqual(errors,[]);console.log('PASS stat shop Lv1 lock; Lv2/3/4/5 exact costs, probabilities, increases; PC/mobile 8 screens; touch purchase 4; equipment tab cannot change rule; evolution same-day locked; next-day unlock; existing bonus accumulation; errors0');
}finally{await browser.close();await game.close();}
