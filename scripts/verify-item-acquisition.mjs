import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
import {chromium} from 'playwright';
import {io} from 'socket.io-client';
import {createClassroomServer} from '../server/app.js';
import {STREET} from '../shared/config.js';
const inspect=process.argv.includes('--inspect'),key='station-dialog-test',game=createClassroomServer({teacherKey:key,studentHours:false});
const {port}=await game.listen(),url=`http://127.0.0.1:${port}`;let browser,socket;
try{
 browser=await chromium.launch({headless:true,...(process.platform==='win32'?{channel:'msedge'}:{})});socket=io(url,{transports:['websocket'],reconnection:false});await new Promise((resolve,reject)=>{socket.once('connect',resolve);socket.once('connect_error',reject);});
 const created=await socket.timeout(5000).emitWithAck('room:create',{teacherKey:key,title:'발전소 화면 검사',allowedNames:['화면 학생']});assert.ok(created.ok);
 const page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto(url);await page.locator('#student-tab').click();await page.locator('#join-code').fill(created.room.code);await page.locator('#nickname').fill('화면 학생');await page.locator('#student-pin').fill('1234');await page.locator('#student-form .submit').click();await page.locator('#lobby').waitFor({state:'hidden'});if(await page.locator('#tutorial-later').isVisible())await page.locator('#tutorial-later').click();
 const room=game.store.rooms.get(created.room.code),student=[...room.players.values()].find(p=>p.role==='student');

 await mkdir('.local/item-audit',{recursive:true});
 const object=STREET.objects.find(o=>o.kind==='energy-shop');assert.ok(object);
 Object.assign(student,{mapId:STREET.id,x:object.x,y:object.y+100,cosmicEnergy:100,input:{x:0,y:0,at:0}});game.io.to(student.socketId).emit('room:state',game.store.snapshot(room,student));
 await page.waitForFunction(id=>document.getElementById('interact-prompt').dataset.objectId===id,object.id);await page.locator('#world').focus();await page.keyboard.press('f');
 const dialog=page.locator('#energy-shop-dialog');await dialog.waitFor({state:'visible'});const row=dialog.locator('[data-item-id="asteroid-badge"]');await row.waitFor();assert.match(await row.textContent(),/소행성 배지/);assert.match(await row.textContent(),/우주에너지 100/);
 await row.scrollIntoViewIfNeeded();await row.locator('img').evaluate(img=>img.decode());assert.ok(await row.locator('img').evaluate(img=>img.naturalWidth>0));await page.screenshot({path:'.local/item-audit/asteroid-badge-before.png'});
 await row.getByRole('button',{name:'사기',exact:true}).click();await page.waitForFunction(()=>document.getElementById('toast').textContent.includes('구매'));
 assert.equal(student.cosmicEnergy,0);assert.equal(student.inventory.find(i=>i.id==='asteroid-badge')?.quantity,1);await page.screenshot({path:'.local/item-audit/asteroid-badge-after.png'});assert.deepEqual(errors,[]);console.log('PASS real student Lv1 shop badge art, price100, purchase and inventory');
}finally{socket?.disconnect();await browser?.close();await game.close();}
