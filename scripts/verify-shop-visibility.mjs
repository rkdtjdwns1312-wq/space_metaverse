import assert from 'node:assert/strict';
import {mkdirSync} from 'node:fs';
import {chromium} from 'playwright';
import {io} from 'socket.io-client';
import {createClassroomServer} from '../server/app.js';
import {fillNewClass} from './class-setup.mjs';
import {SHOP,STREET} from '../shared/config.js';

const key='isolated-shop-visibility',game=createClassroomServer({teacherKey:key,studentHours:false,craftingRecipes:[{output:{id:'android-card',quantity:1},ingredients:[{id:'space-food-card',quantity:2},{id:'asteroid-card',quantity:1}]}]});
const {port}=await game.listen(),url=`http://127.0.0.1:${port}`,errors=[];
const browser=await chromium.launch({headless:true,...(process.platform==='win32'?{channel:'msedge'}:{}),args:['--no-proxy-server']});
let probe;
try{
  mkdirSync('.local/shop-visibility',{recursive:true});
  const teacher=await browser.newPage({viewport:{width:1280,height:900}});
  teacher.on('pageerror',e=>errors.push(e.message));
  await teacher.goto(url);await teacher.locator('#teacher-tab').click();await teacher.locator('#teacher-key').fill(key);
  await fillNewClass(teacher,['상점검사']);await teacher.locator('#teacher-form .submit').click();await teacher.locator('#lobby').waitFor({state:'hidden'});
  const code=await teacher.locator('#room-code').textContent(),room=game.store.rooms.get(code);
  const student=await browser.newPage({viewport:{width:1280,height:900}});student.on('pageerror',e=>errors.push(e.message));
  await student.goto(url+'/?class='+code);await student.locator('#student-tab').click();await student.locator('#join-code').fill(code);await student.locator('#nickname').fill('상점검사');await student.locator('#student-pin').fill('1234');await student.locator('#student-form .submit').click();await student.locator('#lobby').waitFor({state:'hidden'});
  const sp=[...room.players.values()].find(p=>p.role==='student'),tp=[...room.players.values()].find(p=>p.role==='teacher');
  const publish=p=>game.io.to(p.socketId).emit('room:state',game.store.snapshot(room,p));
  const open=async(page,p)=>{
    for(let n=0;n<12&&await page.locator('dialog[open]').count();n++)await page.keyboard.press('Escape');
    const shop=STREET.objects.find(o=>o.kind==='shop');Object.assign(p,{mapId:STREET.id,x:shop.x,y:shop.y+80});publish(p);
    await page.waitForTimeout(300);await page.locator('#world').focus();await page.keyboard.press('f');await page.locator('#shop-dialog').waitFor({state:'visible'});
  };
  await open(student,sp);
  assert.equal(await student.locator('[data-shop-level="2"]').isDisabled(),true,'LV1 학생은 레벨 제한 유지');
  assert.equal(await student.locator('#shop-buy-list .buy').count(),8,'LV1 판매 카드 유지');
  sp.avatar.level=4;publish(sp);await student.locator('[data-shop-level="4"]:enabled').waitFor();
  await open(teacher,tp);
  const missingBefore=SHOP.items.filter(i=>!i.shopHidden&&[2,3,4].includes(i.level)&&i.forSale===false&&!i.pricePending).map(i=>i.name);
  console.log('Previously omitted:',missingBefore.join(', '));
  for(const level of [1,2,3,4]){
    for(const page of [teacher,student])await page.locator(`[data-shop-level="${level}"]`).click();
    const ids=page=>page.locator('#shop-buy-list > li').evaluateAll(rows=>rows.map(row=>row.dataset.itemId));
    assert.deepEqual(await ids(student),await ids(teacher),`LV${level} 교사·학생 목록 일치`);
    assert(!(await ids(student)).some(id=>['rainbow-tail','mini-satellite','starlight-cape','meteor-board'].includes(id)));
    if(level>1){assert.equal(await student.locator('#shop-buy-list .buy,#shop-buy-list .qty,#shop-buy-list .price').count(),0);assert.ok(await teacher.locator('#shop-buy-list .buy').count()>0);}
  }
  await student.locator('[data-shop-level="2"]').click();
  const android=student.locator('#shop-buy-list [data-item-id="android-card"]');
  assert.match(await android.textContent(),/별빛 조합기로/);await android.locator('.item-info').click();await student.locator('#item-info-dialog').waitFor({state:'visible'});
  const detailText=await student.locator('#item-info-text').textContent();assert.match(detailText,/금요일/);assert.match(detailText,/\n\n조합 힌트 : Lv1 아이템 2개 \+ Lv2 아이템 1개$/);assert(!detailText.includes('우주 식량'));
  for(const width of [1280,390]){await student.setViewportSize({width,height:900});await student.screenshot({path:`.local/shop-visibility/student-${width}.png`});assert.equal(await student.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);}
  await student.locator('[data-close="item-info-dialog"]').click();
  // Attempting the now-visible craft-only card must still fail at the server boundary.
  await student.close();await new Promise(resolve=>setTimeout(resolve,300));
  probe=io(url,{transports:['websocket'],reconnection:false});await new Promise((r,j)=>{probe.once('connect',r);probe.once('connect_error',j);});
  const joined=await probe.timeout(5000).emitWithAck('room:join',{code,nickname:'상점검사',pin:'1234'});assert.ok(joined.ok,joined.error);
  const actor=room.players.get(joined.selfId),shop=STREET.objects.find(o=>o.kind==='shop');Object.assign(actor,{mapId:STREET.id,x:shop.x,y:shop.y+80,starShards:100});actor.avatar.level=4;
  const before=JSON.stringify(actor.inventory),reply=await probe.timeout(5000).emitWithAck('shop:buy',{itemId:'android-card',quantity:1});
  assert.equal(reply.ok,false);assert.match(reply.error,/조합/);assert.equal(actor.starShards,100);assert.equal(JSON.stringify(actor.inventory),before);
  assert.deepEqual(errors,[]);console.log('PASS teacher/student LV1–4 catalog parity, mixed-level hint with blank line and no names, level locks, craft-only purchase rejection, desktop/mobile; JS errors 0');
}finally{probe?.disconnect();await browser.close();await game.close();}
