import assert from 'node:assert/strict';
import {mkdtemp,mkdir,rm,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve,dirname} from 'node:path';
import {chromium} from 'playwright';
import {io} from 'socket.io-client';
import {createClassroomServer} from '../server/app.js';
import {fillNewClass} from '../scripts/class-setup.mjs';
const dir=await mkdtemp(join(tmpdir(),'teacher-card318-')),key='teacher-card318-test';
const game=createClassroomServer({teacherKey:key,dataDir:dir,studentHours:false}),address=await game.listen(),url='http://127.0.0.1:'+address.port;
const browser=await chromium.launch({headless:true,...(process.platform==='win32'?{channel:'msedge'}:{})}),checks=[],errors=[],sockets=[];
const check=s=>{checks.push(s);console.log(s);};
try{
  await mkdir('.local',{recursive:true});
  const page=await browser.newPage({viewport:{width:1280,height:960}});page.setDefaultTimeout(15000);page.on('pageerror',e=>errors.push(e.message));
  await page.goto(url,{waitUntil:'domcontentloaded'});await page.locator('#teacher-tab').click();await page.locator('#teacher-key').fill(key);await fillNewClass(page,['조회검사','권한검사']);await page.locator('#teacher-form .submit').click();await page.locator('#lobby').waitFor({state:'hidden'});
  const code=[...game.store.rooms.keys()][0],room=()=>game.store.rooms.get(code),before=JSON.stringify([...room().players.values()].map(p=>({id:p.id,inventory:p.inventory,starShards:p.starShards,rabbitDraw:p.rabbitDraw})));
  await page.locator('#dock-inventory').click();await page.locator('#teacher-card-catalog-buttons').waitFor();
  const boxes=await page.locator('#inventory-dialog>.dialog-actions').evaluate(e=>{const a=e.querySelector('#teacher-card-catalog-buttons').getBoundingClientRect(),b=e.querySelector('[data-close]').getBoundingClientRect();return a.left<b.left&&a.right<=b.left;});assert.ok(boxes);check('교사 가방 footer 왼쪽 조회 버튼·오른쪽 닫기');
  await page.locator('[data-catalog="gold"]').click();await page.locator('#teacher-card-catalog-summary').filter({hasText:'30종'}).waitFor();assert.equal(await page.locator('.teacher-catalog-card').count(),30);
  assert.ok((await page.locator('.teacher-catalog-effect').allTextContents()).every(Boolean));await page.screenshot({path:'.local/request318-gold-pc.png'});check('금별 30종 전체 효과·현실 확인 내용 표시');
  await page.locator('#teacher-card-catalog-dialog button').click();await page.locator('[data-catalog="silver"]').click();await page.locator('#teacher-card-catalog-summary').filter({hasText:'54장'}).waitFor();assert.equal(await page.locator('.teacher-catalog-card').count(),19);
  const counts=await page.locator('.teacher-catalog-count').allTextContents();assert.equal(counts.reduce((sum,s)=>sum+parseInt(s),0),54);check('은별 19종·총54장 구성과 보상 표시');
  for(const width of [390,320]){
    await page.setViewportSize({width,height:844});assert.ok(await page.locator('#teacher-card-catalog-dialog').evaluate(e=>e.scrollWidth<=e.clientWidth+1&&e.getBoundingClientRect().right<=innerWidth));
    assert.ok(await page.locator('#teacher-card-catalog-list').evaluate(e=>e.scrollHeight>e.clientHeight&&e.scrollWidth<=e.clientWidth+1));
    await page.screenshot({path:`.local/request318-silver-${width}.png`});
  }
  check('390·320px 목록 스크롤·설명 가로 넘침 없음');
  const connect=async()=>{const s=io(url,{transports:['websocket'],reconnection:false});sockets.push(s);await new Promise(r=>s.once('connect',r));return s;};
  const call=(s,event,data={})=>s.timeout(3000).emitWithAck(event,data),sock=await connect();
  assert.equal((await call(sock,'teacher:cards:catalog')).ok,false);assert.ok((await call(sock,'room:join',{code,nickname:'권한검사',pin:'1234'})).ok);
  assert.equal((await call(sock,'teacher:cards:catalog',{role:'teacher'})).ok,false);check('미인증·학생·role 위조 조회 서버 거부');
  const student=await browser.newPage({viewport:{width:390,height:844}});student.on('pageerror',e=>errors.push(e.message));await student.goto(url+'/?class='+code,{waitUntil:'domcontentloaded'});await student.locator('#nickname').fill('조회검사');await student.locator('#student-pin').fill('1234');await student.getByRole('button',{name:'우주 교실 입장하기'}).click();await student.locator('#lobby').waitFor({state:'hidden'});await student.locator('#password-offer-no').click();await student.locator('#dock-inventory').click();assert.ok(await student.locator('#teacher-card-catalog-buttons').isHidden());check('실제 학생 가방에서 조회 버튼 숨김');
  assert.equal(JSON.stringify([...room().players.values()].map(p=>({id:p.id,inventory:p.inventory,starShards:p.starShards,rabbitDraw:p.rabbitDraw}))),before);check('조회 전후 카드·잔액·뽑기 상태 불변');assert.deepEqual(errors,[]);
}finally{await writeFile('.local/request318-ui-result.json',JSON.stringify({checks,errors},null,2));sockets.forEach(s=>s.disconnect());await browser.close();await game.close();assert.equal(dirname(resolve(dir)),resolve(tmpdir()));assert.ok(dir.includes('teacher-card318-'));await rm(dir,{recursive:true,force:true});}
