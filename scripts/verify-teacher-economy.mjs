import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {createClassroomServer} from '../server/app.js';
import {fillNewClass} from './class-setup.mjs';
import {STREET,STREET_ID,VALLEY,VALLEY_ID} from '../shared/config.js';

const key='teacher-economy-browser-test-key';
const recipes=[{ingredients:[{id:'space-food-card',quantity:2}],output:{id:'android-card',quantity:1}}];
const game=createClassroomServer({teacherKey:key,studentHours:false,craftingRecipes:recipes});
const {port}=await game.listen(),url='http://127.0.0.1:'+port;
const browser=await chromium.launch({headless:true,...(process.platform==='win32'?{channel:'msedge'}:{})});
const page=await browser.newPage({viewport:{width:1440,height:960}}),errors=[],checks=[];
page.setDefaultTimeout(10000);page.on('pageerror',e=>errors.push(e.message));
const check=t=>{checks.push(t);console.log('Teacher economy '+checks.length+': '+t);};
await mkdir('.local',{recursive:true});
try{
  await page.goto(url);await page.locator('#teacher-tab').click();await page.locator('#teacher-key').fill(key);
  await fillNewClass(page,['1']);await page.locator('#teacher-form .submit').click();await page.locator('#lobby').waitFor({state:'hidden'});
  const room=[...game.store.rooms.values()][0],p=[...room.players.values()].find(p=>p.role==='teacher');
  const publish=()=>game.io.to(p.socketId).emit('room:state',game.store.snapshot(room,p));
  async function approach(object,mapId){
    Object.assign(p,{mapId,x:object.x,y:object.y});publish();
    await page.locator('#interact-prompt').filter({hasText:object.kind==='shop'?'별상점 구경하기':object.name}).waitFor({state:'visible'});
    await page.locator('#world').focus();await page.keyboard.press('f');
  }
  await page.locator('#dock-inventory').click();await page.locator('#bag-currency').waitFor({state:'visible'});
  assert.match(await page.locator('#self-shards').innerText(),/∞.*무제한/);await page.keyboard.press('Escape');
  check('가방에 선생님 별 파편 무제한 표시');
  await approach(STREET.objects.find(o=>o.kind==='shop'),STREET_ID);
  await page.locator('#shop-dialog').waitFor({state:'visible'});
  assert.match(await page.locator('#shop-shards').innerText(),/∞/);
  const row=page.locator('#shop-buy-list li[data-item-id="space-food-card"]');
  await row.locator('.qty').fill('3');assert.match(await row.locator('.price').innerText(),/무료/);
  assert.equal(await row.locator('.buy').isEnabled(),true);await row.locator('.buy').click();
  await page.locator('#toast').filter({hasText:/샀어요/}).waitFor();
  assert.equal(p.starShards,0);assert.equal(p.inventory.find(i=>i.id==='space-food-card').quantity,3);
  await page.screenshot({path:'.local/201-teacher-free-shop.png'});await page.locator('#shop-close').click();
  check('실제 잔액0에서 상점 무료 구매·무한 잔액 유지');
  await approach(STREET.objects.find(o=>o.kind==='crafting'),STREET_ID);
  await page.locator('#crafting-dialog').waitFor({state:'visible'});
  const food=page.locator('#crafting-bag [data-item-id="space-food-card"]');
  await food.click();await food.click();assert.match(await page.locator('#crafting-submit').innerText(),/무료/);
  await page.locator('#crafting-submit').click();await page.locator('#crafting-note').filter({hasText:'조합 성공'}).waitFor();
  assert.equal(p.starShards,0);assert.equal(p.inventory.find(i=>i.id==='android-card').quantity,1);
  await food.click();await page.locator('#crafting-submit').click();await page.locator('#crafting-note').filter({hasText:'실패'}).waitFor();
  assert.equal(p.starShards,0);assert.equal(p.inventory.find(i=>i.id==='space-food-card').quantity,1);
  await page.setViewportSize({width:390,height:844});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  await page.screenshot({path:'.local/201-teacher-free-crafting.png'});await page.locator('#crafting-close').click();
  check('조합 성공·실패 수수료0 및 실패 재료 보존·작은 화면');
  await approach(VALLEY.objects.find(o=>o.kind==='growth'),VALLEY_ID);
  await page.locator('#growth-info').filter({hasText:/∞/}).waitFor();
  assert.equal(await page.locator('#growth-buy').isDisabled(),true);assert.equal(p.avatar.level,6);
  await page.locator('#growth-close').click();check('성장의 별 무한 표시·교사 LV6 최고단계 보존');
  await page.reload();await page.locator('#lobby').waitFor({state:'hidden'});
  await page.locator('#dock-inventory').click();assert.match(await page.locator('#self-shards').innerText(),/∞/);
  await page.keyboard.press('Escape');check('재접속 후 무한 표시 복원');
  const student=await browser.newPage();await student.goto(url);
  await student.locator('#join-code').fill(room.code);await student.locator('#nickname').fill('1');await student.locator('#student-pin').fill('1234');
  await student.locator('#student-form .submit').click();await student.locator('#lobby').waitFor({state:'hidden'});
  const sp=[...room.players.values()].find(v=>v.role==='student'),shop=STREET.objects.find(o=>o.kind==='shop');
  Object.assign(sp,{mapId:STREET_ID,x:shop.x,y:shop.y});game.io.to(sp.socketId).emit('room:state',game.store.snapshot(room,sp));
  await student.locator('#interact-prompt').filter({hasText:'별상점 구경하기'}).waitFor();await student.locator('#world').focus();await student.keyboard.press('f');
  await student.locator('#shop-dialog').waitFor({state:'visible'});
  assert.equal(await student.locator('#shop-buy-list li[data-item-id="space-food-card"] .buy').isDisabled(),true);
  assert.doesNotMatch(await student.locator('#shop-shards').innerText(),/∞/);check('학생 잔액0에서는 구매 불가·일반 잔액 표시 유지');
  assert.deepEqual(errors,[]);await writeFile('.local/201-teacher-economy.json',JSON.stringify({checks,errors},null,2));
}catch(e){await page.screenshot({path:'.local/201-teacher-economy-failure.png'}).catch(()=>{});throw e;}
finally{await browser.close();await game.close();}
