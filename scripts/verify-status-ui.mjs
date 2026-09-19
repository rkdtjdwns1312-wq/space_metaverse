// 임시 메모리 서버에서 실제 아이템/능력 사용과 내 정보 상태 배지를 확인합니다.
import {chromium} from 'playwright';
import {io} from 'socket.io-client';
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {createClassroomServer} from '../server/app.js';
const key='status-ui-test-only-key',game=createClassroomServer({teacherKey:key,studentHours:false}),{port}=await game.listen();
const url='http://127.0.0.1:'+port,sockets=[],errors=[],checks=[];
const browser=await chromium.launch({headless:true,...(process.platform==='win32'?{channel:'msedge'}:{})});
const call=(s,event,data={})=>s.timeout(5000).emitWithAck(event,data);
const connect=async()=>{const s=io(url,{transports:['websocket'],reconnection:false});sockets.push(s);await new Promise((r,j)=>{s.once('connect',r);s.once('connect_error',j);});return s;};
const check=t=>{checks.push(t);console.log('Status '+checks.length+': '+t);};
await mkdir('.local',{recursive:true});
try{
 const teacher=await connect(),created=await call(teacher,'room:create',{teacherKey:key,title:'상태 시험',allowedNames:['별이','달이']});assert.ok(created.ok);
 const sender=await connect(),joined=await call(sender,'room:join',{code:created.room.code,nickname:'별이'});assert.ok(joined.ok);
 const room=game.store.rooms.get(created.room.code),actor=room.players.get(joined.selfId);
 const page=await browser.newPage({viewport:{width:1200,height:960}});page.setDefaultTimeout(10000);page.on('pageerror',e=>errors.push(e.message));
 await page.goto(url);await page.locator('#join-code').fill(room.code);await page.locator('#nickname').fill('달이');await page.locator('#student-pin').fill('1234');await page.locator('#student-form .submit').click();await page.locator('#lobby').waitFor({state:'hidden'});
 const target=[...room.players.values()].find(p=>p.nickname==='달이');
 const publish=()=>game.io.to(target.socketId).emit('room:state',game.store.snapshot(room,target));
 const badge=id=>page.locator('#self-statuses [data-status-id="'+id+'"]');
 await page.locator('#dock-avatar').click();await page.locator('#self-status-empty').waitFor({state:'visible'});assert.equal(await badge('poison').count(),0);assert.equal(await badge('pair').count(),0);check('빈 상태창·미구현 상태 배지 없음');
 actor.inventory=[{id:'little-sun-card',quantity:1}];
 assert.ok((await call(sender,'item:use',{itemId:'little-sun-card',targetId:target.id})).ok);
 await badge('uv').waitFor();assert.match(await badge('uv').innerText(),/자외선 상태/);assert.ok(!await badge('uv').getAttribute('title').then(t=>t.includes('별이')));check('실제 꼬마 해 사용 → 열린 내 정보에 자외선 상태');
 target.inventory=[{id:'little-moon-card',quantity:1}];publish();await page.keyboard.press('Escape');await page.locator('#dock-inventory').click();
 await page.locator('#bag-list [data-item-id="little-moon-card"] button').click();await page.locator('#bag-detail .use').click();await page.locator('#use-confirm').click();await page.locator('#use-dialog').waitFor({state:'hidden'});
 await page.keyboard.press('Escape');await page.locator('#dock-avatar').click();await badge('moon').waitFor();assert.equal(await badge('uv').count(),0);check('실제 꼬마 달 사용 → 자외선 해제·달빛 보호 표시');
 actor.avatar={...actor.avatar,level:2,form:'constellation',constellationId:'aries'};
 assert.ok((await call(sender,'ability:use',{targetId:target.id})).ok);await badge('sleep').waitFor();check('양자리 실제 능력 → 수면 상태 표시');
 target.cardMarkers=[];target.abilityState.blocks.forEach(b=>b.until=Date.now()+1600);publish();
 await badge('sleep').waitFor({state:'hidden'});await page.locator('#self-status-empty').waitFor({state:'visible'});check('효과 해제·기간 만료 → 배지와 기존 효과 목록 제거');
 // 후속 능력이 연결될 때의 명시적 상태 뷰 계약만 검증합니다. 실제 능력은 만들지 않습니다.
 target.effects=[{itemId:'test-poison',statusId:'poison',label:'시험 중독',icon:'🧪',style:'card',until:Date.now()+60000},{itemId:'test-pair',statusId:'pair',label:'시험 짝',icon:'🤝',style:'card',until:Date.now()+60000}];publish();
 await badge('poison').waitFor();await badge('pair').waitFor();
 await page.setViewportSize({width:390,height:844});await page.locator('.card-status').scrollIntoViewIfNeeded();
 assert.ok(await page.locator('#avatar-dialog').evaluate(e=>e.scrollWidth<=e.clientWidth+2));
 const size=await badge('poison').boundingBox();assert.ok(size.width<=80&&size.height<=90);await page.screenshot({path:'.local/status-mobile.png'});check('향후 중독·짝 명시 연결과 390px 작은 네모 배지');
 target.effects=[];publish();await page.locator('#self-status-empty').waitFor({state:'visible'});
 assert.equal(await page.locator('#avatar-card').evaluate(e=>e.lastElementChild.id),'experience-panel');assert.deepEqual(errors,[]);
 check('상태 제거·경험치 맨 아래 유지·브라우저 오류 없음');
 await writeFile('.local/status-result.json',JSON.stringify({checks,errors},null,2));
}catch(e){for(const context of browser.contexts())for(const page of context.pages())await page.screenshot({path:'.local/status-failure.png'}).catch(()=>{});throw e;}
finally{await browser.close();for(const s of sockets)s.disconnect();await game.close();}
