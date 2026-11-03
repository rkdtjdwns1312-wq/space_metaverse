import assert from 'node:assert/strict';
import {mkdirSync} from 'node:fs';
import {chromium} from 'playwright';
import {createClassroomServer} from '../server/app.js';
import {fillNewClass} from './class-setup.mjs';
import {mapOf,STREET_ID} from '../shared/config.js';
const key='isolated-context-layout',game=createClassroomServer({teacherKey:key,studentHours:false});let browser;
try{
 const {port}=await game.listen();browser=await chromium.launch({channel:'msedge',headless:true,args:['--no-proxy-server']});
 const page=await browser.newPage({viewport:{width:1280,height:900}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://127.0.0.1:'+port);await page.locator('#teacher-tab').click();await page.locator('#teacher-key').fill(key);await fillNewClass(page,['검사']);await page.locator('#teacher-form .submit').click();await page.locator('#lobby').waitFor({state:'hidden'});
 for(let i=0;i<12&&await page.locator('dialog[open]').count();i++)await page.keyboard.press('Escape');
 const room=[...game.store.rooms.values()][0],player=[...room.players.values()].find(p=>p.role==='teacher');
 const openObject=async kind=>{
  for(let i=0;i<12&&await page.locator('dialog[open]').count();i++)await page.keyboard.press('Escape');
  const object=mapOf(STREET_ID).objects.find(o=>o.kind===kind);Object.assign(player,{mapId:STREET_ID,x:object.x,y:object.y+(object.radius||40)+20});
  game.io.sockets.sockets.get(player.socketId).emit('room:state',game.store.snapshot(room,player));
  await page.locator('#interact-prompt[data-object-id="'+object.id+'"]').waitFor({state:'visible'});await page.locator('#world').focus();await page.keyboard.press('f');
 };
 mkdirSync('.local/context-layout',{recursive:true});
 await openObject('crafting');await page.locator('#crafting-dialog').waitFor({state:'visible'});
 for(const [width,height] of [[1280,900],[390,844],[320,568],[740,360]]){
  await page.setViewportSize({width,height});
  const recipe=await page.locator('#crafting-recipes-open').boundingBox(),close=await page.locator('#crafting-close').boundingBox();
  assert(recipe&&close);assert(recipe.x+recipe.width<=close.x+1);assert(Math.abs(recipe.y-close.y)<2);
  assert(await page.locator('#crafting-dialog').evaluate(el=>el.scrollWidth<=el.clientWidth+1));
  await page.screenshot({path:'.local/context-layout/crafting-'+width+'.png'});
 }
 await page.locator('#crafting-recipes-open').click();await page.locator('#crafting-recipes-panel').waitFor({state:'visible'});
 await page.locator('#crafting-close').click();await page.setViewportSize({width:1280,height:900});
 await openObject('shop');await page.locator('#shop-dialog').waitFor({state:'visible'});
 const contents=await page.locator('#shop-buy-list').innerText();
 for(const name of ['반짝 별 스티커','우주 간식','소행성 헬멧','반딧불 램프'])assert(!contents.includes(name),name);
 assert(contents.includes('꼬마 해'));await page.screenshot({path:'.local/context-layout/shop-lv1.png'});await page.keyboard.press('Escape');
 await openObject('energy-shop');await page.locator('#energy-shop-dialog').waitFor({state:'visible'});await page.locator('#energy-shop-level-tabs [data-level="5"]').click();
 for(const [id,expected] of [['primordial-star-gem',/10초마다 체력 회복 \+5.*10초마다 마나 회복 \+5/],['truth-convergence',/최대 체력 \+10.*최대 마나 \+10/],['primordial-star-sigil',/최대 체력 \+40/]]){
  assert.match(await page.locator('#energy-shop-list [data-item-id="'+id+'"]').innerText(),expected);
 }
 await page.screenshot({path:'.local/context-layout/equipment-lv5.png'});await page.keyboard.press('Escape');
 const ids=['inventory-dialog','tasks-dialog','student-missions-dialog','crafting-dialog','energy-shop-dialog','shop-dialog','assignment-dialog','evolution-dialog'];
 for(const [width,height] of [[1280,900],[390,844]]){
  await page.setViewportSize({width,height});
  for(const id of ids){
   const host=page.locator('#'+id);await host.evaluate(el=>{el.showModal();el.scrollTop=0;});
   const layout=await host.evaluate(el=>{const heading=el.querySelector('h2'),row=el.querySelector('.student-help-row'),header=heading.closest('header')||heading,b=el.querySelector('[data-student-help]');const a=header.getBoundingClientRect(),r=row.getBoundingClientRect(),bb=b.getBoundingClientRect();return {gap:r.y-a.bottom,left:r.x,buttonLeft:bb.x,width:bb.width,rowWidth:r.width,buttonCount:el.querySelectorAll('[data-student-help]').length};});
   assert.equal(layout.buttonCount,1);assert(Math.abs(layout.gap-8)<1,JSON.stringify({id,layout}));assert.equal(layout.left,layout.buttonLeft);assert(layout.width<=layout.rowWidth);
   await host.locator('[data-student-help]').click();await page.locator('#classroom-help-dialog').waitFor({state:'visible'});await page.locator('#classroom-help-close').click();assert(await host.isVisible());await host.evaluate(el=>el.close());
  }
 }
 assert.deepEqual(errors,[]);console.log('PASS crafting actions same row/left of close at4sizes; removed4legacy teacher shop entries; threeLv5equipment stats; help8dialogs same row/gap atPC/mobile and context return; errors0');
}finally{await browser?.close();await game.close();}
