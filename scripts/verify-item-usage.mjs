import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {mkdtemp,rm,mkdir} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createClassroomServer} from '../server/app.js';
import {templeItemRows} from '../server/temple-items.js';
import {fillNewClass} from './class-setup.mjs';
import {MAP,PLAZA_ID} from '../shared/config.js';

const key='item-usage-verify-private-key',dir=await mkdtemp(join(tmpdir(),'space-item-usage-'));
const game=createClassroomServer({teacherKey:key,dataDir:dir,studentHours:false}),address=await game.listen();
const url='http://127.0.0.1:'+address.port,browser=await chromium.launch({headless:true,...(process.platform==='win32'?{channel:'msedge'}:{})});
const errors=[];await mkdir('.local',{recursive:true});
const pillar=MAP.objects.find(o=>o.id==='pillar-effects'),now=Date.now();
try{
  const teacher=await browser.newPage({viewport:{width:1440,height:960}}),student=await browser.newPage({viewport:{width:1440,height:960}});
  for(const page of [teacher,student]){page.setDefaultTimeout(8000);page.on('pageerror',e=>errors.push(e.message));}
  await teacher.goto(url,{waitUntil:'domcontentloaded',timeout:20000});await teacher.locator('#teacher-tab').click();await teacher.locator('#teacher-key').fill(key);await fillNewClass(teacher,['별이']);await teacher.locator('#teacher-form .submit').click();await teacher.locator('#lobby').waitFor({state:'hidden'});
  const room=[...game.store.rooms.values()][0],tp=[...room.players.values()].find(p=>p.role==='teacher');
  await student.goto(url+'/?class='+room.code,{waitUntil:'domcontentloaded',timeout:20000});await student.waitForFunction(()=>document.getElementById('join-code').hidden);await student.locator('#nickname').fill('별이');await student.locator('#student-pin').fill('1234');await student.locator('#student-form .submit').click();await student.locator('#lobby').waitFor({state:'hidden'});
  const sp=[...room.players.values()].find(p=>p.role==='student');
  sp.effects=[
    {itemId:'star-sticker',icon:'⭐',style:'sparkle',label:'반짝반짝',until:now+90_000,remainingUses:3,fromId:tp.id,fromNickname:'선생님',secret:false},
    {itemId:'space-snack',icon:'🍬',style:'happy',label:'냠냠 행복',until:now+120_000,remainingUses:2,fromId:tp.id,fromNickname:'비밀선생님',secret:true},
  ];
  sp.cardMarkers=[{id:'verify-manual',itemId:'space-food-card',icon:'🍱',style:'card',label:'급식 위치 선정',until:null,fromId:tp.id,fromNickname:'선생님'}];
  const move=async(player,page)=>{Object.assign(player,{mapId:PLAZA_ID,x:pillar.x,y:pillar.y,input:{x:0,y:0,at:0}});game.io.to(player.socketId).emit('room:state',game.store.snapshot(room,player));await page.locator('#interact-prompt').filter({hasText:pillar.name}).waitFor({state:'visible'});await page.locator('#touch-interact').click();await page.locator('#temple-dialog').waitFor({state:'visible'});};
  await move(tp,teacher);await teacher.locator('.effects-grid-header span').first().waitFor({state:'visible'});
  assert.deepEqual(await teacher.locator('.effects-grid-header span').allTextContents(),['아이템명','사용자','사용 대상','횟수/기간']);
  assert.equal(await teacher.locator('[data-effect-row]').count(),3);const counted=teacher.locator('[data-effect-row]').filter({hasText:'반짝 별 스티커'}).locator('.effects-remaining');assert.match(await counted.textContent(),/남은 3회/);assert.match(await counted.textContent(),/남음/);
  assert.equal(await teacher.locator('[data-effect-row]').filter({hasText:'우주 간식'}).locator('span').nth(1).textContent(),'비밀선생님');
  await teacher.setViewportSize({width:390,height:844});await teacher.screenshot({path:'.local/item-usage-390.png'});assert.ok(await teacher.locator('.effects-grid-wrap').evaluate(el=>el.scrollWidth>el.clientWidth));
  const studentRows=templeItemRows(room,sp,Date.now());assert.ok(studentRows.length>=2);assert.equal(studentRows.find(r=>r.itemId==='space-snack').fromNickname,undefined);assert.equal(studentRows.find(r=>r.itemId==='star-sticker').fromNickname,'선생님');
  await teacher.locator('#temple-close').click();await move(tp,teacher);const complete=teacher.getByRole('button',{name:'처리 완료'}).last();await complete.click();await teacher.waitForFunction(()=>![...document.querySelectorAll('[data-effect-row]')].some(row=>row.textContent.includes('우주 식량')));assert.equal(sp.cardMarkers.some(e=>e.id==='verify-manual'),false);
  sp.cardMarkers.push({id:'verify-count',itemId:'spaceman-card',until:now+86400000,fromId:sp.id,fromNickname:sp.nickname,remainingUses:3});
  await teacher.locator('#temple-close').click();await move(tp,teacher);
  await teacher.getByRole('button',{name:'1회 사용 처리'}).click();
  await teacher.locator('[data-effect-row]').filter({hasText:'우주인'}).filter({hasText:'남은 2회'}).waitFor();
  assert.equal(sp.cardMarkers.find(e=>e.id==='verify-count').remainingUses,2);
  assert.deepEqual(errors,[]);console.log('verify-item-usage: PASS');
}finally{await browser.close();await game.close();await rm(dir,{recursive:true,force:true});}
