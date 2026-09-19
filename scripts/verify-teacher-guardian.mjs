import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {createClassroomServer} from '../server/app.js';
import {fillNewClass} from './class-setup.mjs';
import {STATIC_MAPS,PLAZA_ID,ORIGIN_MAPS} from '../shared/config.js';
import {monstersOf} from '../server/monsters.js';
const key='teacher-guardian-browser-secret',game=createClassroomServer({teacherKey:key,studentHours:false});
const {port}=await game.listen(),url='http://127.0.0.1:'+port;
const browser=await chromium.launch({headless:true,...(process.platform==='win32'?{channel:'msedge'}:{})});
const checks=[],errors=[];const check=text=>{checks.push(text);console.log(text);};
await mkdir('.local',{recursive:true});
try{
 const page=await browser.newPage({viewport:{width:1440,height:960},hasTouch:true});page.on('pageerror',e=>errors.push(e.message));page.setDefaultTimeout(10000);
 await page.goto(url);await page.locator('#teacher-tab').click();await page.locator('#teacher-key').fill(key);await fillNewClass(page,['1']);await page.locator('#teacher-form .submit').click();await page.locator('#lobby').waitFor({state:'hidden'});
 const room=[...game.store.rooms.values()][0],p=[...room.players.values()].find(p=>p.role==='teacher');const publish=()=>game.io.to(p.socketId).emit('room:state',game.store.snapshot(room,p));
 await page.waitForFunction(()=>document.getElementById('world').dataset.selfLabelDetail==='LV6 별의수호자');assert.equal(await page.locator('#world').getAttribute('data-self-label-name'),'선생님');
 await page.locator('.vitals-hp .vitals-label').filter({hasText:'HP 99999/99999'}).waitFor();assert.equal(p.avatar.level,6);
 const image=await page.evaluate(async()=>{const img=new Image();img.src='/assets/avatars/teacher/star-sovereign.png';await img.decode();const c=document.createElement('canvas');c.width=img.width;c.height=img.height;const ctx=c.getContext('2d');ctx.drawImage(img,0,0);const a=ctx.getImageData(0,0,c.width,c.height).data;let transparent=0,opaque=0;for(let i=3;i<a.length;i+=4){if(a[i]===0)transparent++;if(a[i]>=200)opaque++;}return {transparent,opaque,width:img.width};});assert.ok(image.transparent>10000&&image.opaque>10000,JSON.stringify(image));check('교사LV6·99999HP·이름두줄·실제투명이미지로드');
 await page.locator('#dock-avatar').click();await page.locator('#self-level').filter({hasText:'LV6'}).waitFor();assert.equal(await page.locator('#self-form-name').textContent(),'별의수호자');assert.equal(await page.locator('#self-attack-power').textContent(),'공격력 · 99999');await page.screenshot({path:'.local/teacher-guardian-card.png'});await page.keyboard.press('Escape');check('내정보교사명칭·공격력99999·아바타그림');
 // 목적지에 진입 제한이 있는 문도 교사에게는 허용합니다.
 let count=0;
 for(const map of Object.values(STATIC_MAPS))for(const gate of map.objects.filter(o=>o.kind==='gate'&&STATIC_MAPS[o.target]?.minLevel)){
  Object.assign(p,{mapId:map.id,x:gate.x,y:gate.y});publish();await page.locator('#interact-prompt').filter({hasText:gate.name}).waitFor();await page.locator('#world').focus();await page.keyboard.press('f');await page.waitForFunction(name=>document.getElementById('minimap-title').textContent===name,STATIC_MAPS[gate.target].name);assert.equal(p.mapId,gate.target);count++;
 }
 check(count+'개레벨제한문교사F입장');
 for(const target of [...ORIGIN_MAPS,...ORIGIN_MAPS.slice(0,-1).reverse()]){
  const from=Object.values(STATIC_MAPS).find(map=>map.objects.some(o=>o.target===target.id));const gate=from.objects.find(o=>o.target===target.id);
  Object.assign(p,{mapId:from.id,x:gate.x,y:gate.y});publish();await page.locator('#interact-prompt').filter({hasText:gate.name}).waitFor();await page.locator('#world').focus();await page.keyboard.press('f');await page.locator('#minimap-title').filter({hasText:target.name}).waitFor();assert.equal(p.mapId,target.id);assert.ok(Math.abs(p.x-gate.arrival.x)<1&&Math.abs(p.y-gate.arrival.y)<1);
 }
 check('확장사냥맵1/2/3목적지기준문좌표·미니맵명칭');
 const m=monstersOf(room).get('star-keeper');Object.assign(m,{dx:0,dy:0,nextDirectionAt:Date.now()+60000});Object.assign(p,{mapId:m.mapId,x:m.x-m.radius-30,y:m.y,facing:{x:1,y:0}});publish();await page.locator('#minimap-title').filter({hasText:'별의 시작점 3'}).waitFor();await page.locator('#world').focus();await page.keyboard.press('q');await page.waitForFunction(()=>document.getElementById('world').dataset.monsterCount==='4');assert.equal(m.hp,0);check('교사Q공격실제100HP몬스터처치');
 Object.assign(p,{mapId:PLAZA_ID,x:1080,y:650});publish();await page.locator('#minimap-title').filter({hasText:'별의 기원'}).waitFor();await page.waitForTimeout(200);await page.screenshot({path:'.local/teacher-guardian-world.png'});
 await page.reload();await page.locator('#lobby').waitFor({state:'hidden'});await page.locator('.vitals-hp .vitals-label').filter({hasText:'HP 99999/99999'}).waitFor();await page.waitForFunction(()=>document.getElementById('world').dataset.selfLabelDetail==='LV6 별의수호자');check('교사새로고침재접속전용레벨·HP유지');
 assert.deepEqual(errors,[]);await writeFile('.local/teacher-guardian-result.json',JSON.stringify({checks,errors,image},null,2));
}finally{await browser.close();await game.close();}
