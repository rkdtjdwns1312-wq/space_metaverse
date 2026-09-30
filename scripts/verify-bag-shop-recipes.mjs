import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve,dirname} from 'node:path';
import {chromium} from 'playwright';
import {io} from 'socket.io-client';
import {createClassroomServer} from '../server/app.js';
import {SHOP,STREET,STREET_ID} from '../shared/config.js';
import {recipeItemId} from '../shared/recipe-items.js';
import {loadCraftingRecipes} from '../server/crafting-recipes.js';

const root=resolve(tmpdir()),dir=await mkdtemp(join(root,'bag-shop-recipes-')),key='isolated-bag-shop-key';
let now=Date.parse('2026-10-04T23:59:50+09:00');
const game=createClassroomServer({teacherKey:key,dataDir:dir,studentHours:false,clock:()=>now});
const {port}=await game.listen(),url=`http://127.0.0.1:${port}`;
const browser=await chromium.launch({headless:true,...(process.platform==='win32'?{channel:'msedge'}:{})});
const teacher=io(url,{transports:['websocket'],reconnection:false}),checks=[],errors=[];
const check=text=>{checks.push(text);console.log('PASS:',text);};
try{
  await mkdir('.local',{recursive:true});
  await new Promise((r,j)=>{teacher.once('connect',r);teacher.once('connect_error',j);});
  const made=await teacher.timeout(5000).emitWithAck('room:create',{teacherKey:key,studentAccounts:[{nickname:'가방검사',pin:'1234'}]});assert.ok(made.ok,made.error);
  const page=await browser.newPage({viewport:{width:1280,height:900}});page.setDefaultTimeout(10000);page.on('pageerror',error=>errors.push(error.message));
  await page.goto(url+'/?class='+made.room.code);await page.locator('#nickname').fill('가방검사');await page.locator('#student-pin').fill('1234');await page.locator('#student-form .submit').click();await page.locator('#password-offer-no').click();
  const room=game.store.rooms.get(made.room.code),p=[...room.players.values()].find(p=>p.nickname==='가방검사');
  const publish=()=>game.io.to(p.socketId).emit('room:state',game.store.snapshot(room,p));
  const close=async()=>{for(let i=0;i<10&&await page.locator('dialog[open]').count();i++)await page.keyboard.press('Escape');};
  const bag=async()=>{await close();await page.locator('#dock-inventory').click();};
  const select=async id=>{if(!await page.locator(`#bag-list .selected[data-item-id="${id}"]`).count())await page.locator(`#bag-list [data-item-id="${id}"] .slot-btn`).click();};
  game.store.transact(()=>{Object.assign(p.avatar,{level:4,constellationId:'aquarius',form:'constellation'});p.inventory=[{id:'galaxy-card',quantity:2},{id:'galaxy-cluster-card',quantity:1}];p.starShards=100;});publish();await bag();
  assert.equal(await page.locator('.inventory-page-tab').count(),3);assert.equal(await page.locator('.item-discard').count(),0);
  await select('galaxy-card');await page.locator('.holding-use').filter({hasText:'보유능력 사용하기'}).click();await page.locator('.holding-dialog .primary').click();
  await page.locator('.holding-use').filter({hasText:'이번주 사용'}).waitFor();assert.equal(p.starShards,102);assert.equal(p.inventory[0].quantity,2);
  assert.equal(await page.locator('.holding-use').isDisabled(),true);
  await page.reload();await page.locator('#lobby').waitFor({state:'hidden'});await bag();await select('galaxy-card');await page.locator('.holding-use').filter({hasText:'이번주 사용'}).waitFor();
  now=Date.parse('2026-10-05T00:00:00+09:00');await page.waitForTimeout(2100);publish();await page.locator('.holding-use').filter({hasText:'보유능력 사용하기'}).waitFor();
  await page.locator('.holding-use').click();await page.locator('.holding-dialog .primary').click();await page.locator('.holding-use').filter({hasText:'이번주 사용'}).waitFor();assert.equal(p.starShards,104);
  check('가방3페이지·버리기 없음·보유능력 실제 사용/재접속 유지/월요일0시 재사용');
  await page.locator('.item-info').click();const bagInfo=await page.locator('#item-info-text').textContent();assert.equal(bagInfo.split('사용하면 별 카드 1장을 받습니다.').length-1,1);await close();
  const shop=STREET.objects.find(o=>o.kind==='shop');Object.assign(p,{mapId:STREET_ID,x:shop.x,y:shop.y+80});p.avatar.level=1;publish();await page.waitForTimeout(250);await page.locator('#world').focus();await page.keyboard.press('f');await page.locator('#shop-dialog').waitFor({state:'visible'});
  assert.equal(await page.locator('[data-shop-level="2"]').isDisabled(),true);assert.equal(await page.locator('[data-shop-level="5"]').isDisabled(),true);assert.ok(await page.locator('#shop-buy-list .buy').count()>0);
  p.avatar.level=4;publish();await page.locator('[data-shop-level="4"]:enabled').waitFor();
  for(const level of [2,3,4]){await page.locator(`[data-shop-level="${level}"]`).click();assert.ok(await page.locator('#shop-buy-list .item-info').count()>0);assert.equal(await page.locator('#shop-buy-list .buy,#shop-buy-list .price,#shop-buy-list .qty').count(),0);}
  await page.locator('[data-shop-level="2"]').click();await page.locator('#shop-buy-list [data-item-id="galaxy-card"] .item-info').click();assert.equal(await page.locator('#item-info-text').textContent(),bagInfo);await page.locator('[data-close="item-info-dialog"]').click();
  for(const width of [1280,390,320]){await page.setViewportSize({width,height:900});await page.screenshot({path:`.local/316-shop-${width}.png`});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);}
  check('상점 레벨 해금·LV2~4 구매/가격 없음·아이콘 아래 정보·가방과 동일 설명·320px');
  await page.setViewportSize({width:1280,height:900});await bag();await page.locator('#bag-recipes').click();assert.equal(await page.locator('.recipe-book-list li').count(),0);await close();
  const recipe=loadCraftingRecipes().find(r=>SHOP.items.find(i=>i.id===r.output.id)?.level===2),id=recipeItemId(recipe.output.id);
  const fillers=SHOP.items.filter(i=>i.id!=='galaxy-card').slice(0,40).map(item=>({id:item.id,quantity:1}));
  game.store.transact(()=>{p.inventory=[...fillers,{id,quantity:2}];p.lastItemUseAt=0;});publish();await bag();await page.locator('.inventory-page-tab').filter({hasText:'3'}).click();await select(id);
  await page.locator('#bag-detail .use').click();await page.locator('#use-confirm').click();await page.locator('#use-dialog').waitFor({state:'hidden'});assert.ok(p.learnedRecipeIds.includes(recipe.output.id));assert.equal(p.inventory.find(i=>i.id===id).quantity,1);
  await page.locator('#bag-recipes').click();await page.locator(`.recipe-book-list [data-recipe-id="${recipe.output.id}"]`).waitFor();assert.equal(await page.locator('.recipe-book-list li').count(),1);await page.screenshot({path:'.local/317-recipe-book.png'});await close();
  await bag();await select(id);await page.locator('#bag-detail .use').click();await page.locator('#use-confirm').click();await page.locator('#use-dialog').waitFor({state:'hidden'});assert.equal(p.inventory.find(i=>i.id===id).quantity,1);
  check('3번 가방 레시피 아이템 사용·본인 목록 공개·이미 학습한 레시피 보존');
  await close();Object.assign(p,{mapId:STREET_ID,x:shop.x,y:shop.y+80});room.energyDrops=new Map([['ui-recipe-drop',{id:'ui-recipe-drop',kind:'recipe',itemId:id,mapId:p.mapId,x:p.x+20,y:p.y,total:1,shares:new Map([[p.id,1]]),expiresAt:now+60000}]]);publish();await page.waitForTimeout(250);
  await page.locator('#interact-prompt').filter({hasText:'조합법 줍기'}).waitFor();await page.screenshot({path:'.local/317-recipe-drop.png'});await page.locator('#world').focus();await page.keyboard.press('f');await page.locator('#toast').filter({hasText:'조합법을 주웠어요'}).waitFor();assert.equal(p.inventory.find(i=>i.id===id).quantity,2);
  check('레시피 바닥 그림·F 습득·가방 지급');assert.deepEqual(errors,[]);
  await writeFile('.local/315-317-browser-result.json',JSON.stringify({checks,errors},null,2));
}finally{teacher.disconnect();await browser.close();await game.close();assert.equal(dirname(resolve(dir)),root);await rm(dir,{recursive:true,force:true});}
