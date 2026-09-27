// 실제 학급 파일을 열지 않는 낙원 지형/키보드/터치·렌더링 검사.
import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {createClassroomServer} from '../server/app.js';
import {fillNewClass} from './class-setup.mjs';
import {GARDEN,PARADISE_MAPS,MOON_PARADISE_MAPS,STAR_PARADISE,RULES} from '../shared/config.js';
import {onParadiseFloor} from '../shared/paradise-floor.js';
const key='paradise-floor-test-only-key',game=createClassroomServer({teacherKey:key,studentHours:false});
const address=await game.listen(),url='http://127.0.0.1:'+address.port;
const browser=await chromium.launch({headless:true,args:['--no-proxy-server'],...(process.platform==='win32'?{channel:'msedge'}:{})});
const checks=[],errors=[];await mkdir('.local',{recursive:true});
try{
 const page=await browser.newPage({viewport:{width:1440,height:960},hasTouch:true});page.setDefaultTimeout(10000);page.on('pageerror',e=>errors.push(e.message));
 await page.goto(url);await page.locator('#teacher-tab').click();await page.locator('#teacher-key').fill(key);await fillNewClass(page,['1']);await page.locator('#teacher-form .submit').click();await page.locator('#lobby').waitFor({state:'hidden'});
 const room=[...game.store.rooms.values()][0],p=[...room.players.values()][0];
 const publish=()=>game.io.to(p.socketId).emit('room:state',game.store.snapshot(room,p));
 Object.assign(p,{mapId:GARDEN.id,x:1590,y:570});publish();await page.locator('#minimap-title').filter({hasText:GARDEN.name}).waitFor();
 await page.locator('#world').focus();await page.keyboard.down('s');await page.waitForTimeout(650);
 const wall={x:p.x,y:p.y};await page.waitForTimeout(300);assert.deepEqual({x:p.x,y:p.y},wall);await page.keyboard.up('s');
 assert.ok(onParadiseFloor(GARDEN,p.x,p.y,RULES.radius));assert.ok(p.y<660-RULES.radius);
 await page.waitForTimeout(200);const rendered=await page.locator('#world').evaluate(c=>({x:Number(c.dataset.selfRenderX),y:Number(c.dataset.selfRenderY)}));
 assert.ok(onParadiseFloor(GARDEN,rendered.x,rendered.y,RULES.radius));checks.push('실제 키보드로 다리 옆 난간 정지·화면도 경계 내부');
 // 같은 다리에서 중심 방향으로 이동하면 막히지 않고 중앙 공간으로 이어집니다.
 Object.assign(p,{x:1590,y:570});publish();await page.keyboard.down('a');await page.waitForTimeout(1100);await page.keyboard.up('a');
 assert.ok(p.x<1100&&p.x>650);assert.ok(onParadiseFloor(GARDEN,p.x,p.y,RULES.radius));checks.push('다리에서 중앙으로 키보드 이동·접합부 통과');
 await page.screenshot({path:'.local/245-paradise-game.png'});
 // 실제 게임이 사용하는 배경 렌더러를 그대로 모아 8맵의 테마와 외곽을 확인합니다.
 const gallery=await browser.newPage({viewport:{width:1440,height:1904}});gallery.on('pageerror',e=>errors.push(e.message));await gallery.goto(url+'/health');
 await gallery.evaluate(async()=>{
   const config=await import('/shared/config.js'),draw=await import('/scenery.js');
   document.body.replaceChildren();document.body.style.cssText='margin:0;display:grid;grid-template-columns:1fr 1fr;background:#fff;color:#50486f;font:20px Jua';
   for(const map of [config.GARDEN,...config.PARADISE_MAPS,...config.MOON_PARADISE_MAPS,config.STAR_PARADISE]){
     const block=document.createElement('div'),label=document.createElement('div'),canvas=document.createElement('canvas');label.textContent=map.name;label.style.textAlign='center';canvas.width=720;canvas.height=456;canvas.style.display='block';
     const ctx=canvas.getContext('2d');ctx.scale(.4,.4);
     (map.id===config.GARDEN.id?draw.drawCrossroads:map.id===config.STAR_PARADISE.id?draw.drawStarParadise:draw.drawParadise)(ctx,map);
     for(const o of map.objects){ctx.fillStyle='#6f5991';ctx.font='22px Jua';ctx.textAlign='center';ctx.fillText(o.name.replace(/[←→↑↓]/g,''),o.x,o.y);}
     block.append(label,canvas);document.body.append(block);
   }
 });
 await gallery.screenshot({path:'.local/245-paradise-gallery.png',fullPage:true});checks.push('실제 배경 렌더러8맵·확대된 원형 바닥·방향별 직선 다리');
 for(const map of [GARDEN,...PARADISE_MAPS,...MOON_PARADISE_MAPS,STAR_PARADISE]){
   Object.assign(p,{mapId:map.id,x:map.width/2,y:map.height/2});publish();
   await page.waitForFunction(id=>document.getElementById('minimap').dataset.mapId===id,map.id);
   assert.equal(await page.locator('#minimap').getAttribute('data-has-player'),'true');
 }
 checks.push('확대된8맵 미니맵과 현재 위치 동기화');assert.deepEqual(errors,[]);
 await writeFile('.local/245-paradise-result.json',JSON.stringify({checks,errors},null,2));console.log(checks.join('\n'));
}finally{await browser.close();await game.close();}

