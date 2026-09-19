import {chromium} from 'playwright';
import {io} from 'socket.io-client';
import assert from 'node:assert/strict';
import {mkdir,writeFile,readFile} from 'node:fs/promises';
import {createClassroomServer} from '../server/app.js';
import {CONSTELLATIONS,constellationOf} from '../shared/constellations.js';
import {VALLEY,VALLEY_ID} from '../shared/config.js';
// 실제 학급 파일을 열지 않는 별도 메모리 서버에서 진화 UI와 이미지 매칭을 확인합니다.
const key='celestial-test-key',game=createClassroomServer({teacherKey:key,studentHours:false}),{port}=await game.listen(),url='http://127.0.0.1:'+port;
const browser=await chromium.launch({headless:true,...(process.platform==='win32'?{channel:'msedge'}:{})}),socket=io(url,{transports:['websocket'],reconnection:false});
const checks=[],errors=[],check=t=>{checks.push(t);console.log('Celestial '+checks.length+': '+t);};
await mkdir('.local',{recursive:true});
try{
 await new Promise((r,j)=>{socket.once('connect',r);socket.once('connect_error',j);});
 const created=await socket.timeout(5000).emitWithAck('room:create',{teacherKey:key,title:'별빛 그림 시험',allowedNames:['테스트별']});assert.ok(created.ok);
 const page=await browser.newPage({viewport:{width:1440,height:960}});page.setDefaultTimeout(12000);page.on('pageerror',e=>errors.push(e.message));
 await page.goto(url);await page.locator('#join-code').fill(created.room.code);await page.locator('#nickname').fill('테스트별');await page.locator('#student-pin').fill('1234');await page.locator('#student-form .submit').click();await page.locator('#lobby').waitFor({state:'hidden'});
 const room=game.store.rooms.get(created.room.code),p=[...room.players.values()].find(p=>p.nickname==='테스트별'),publish=()=>game.io.to(p.socketId).emit('room:state',game.store.snapshot(room,p));
 await page.waitForFunction(()=>document.getElementById('world').dataset.selfLabelDetail==='LV1 소행성');
 assert.equal(await page.locator('#world').getAttribute('data-self-label-name'),'테스트별');check('첫 줄 아이디·둘째 줄 LV1 소행성');
 const star=VALLEY.objects.find(o=>o.kind==='evolution');
 for(const c of CONSTELLATIONS){
   Object.assign(p,{mapId:VALLEY_ID,x:star.x+star.radius+22,y:star.y});Object.assign(p.avatar,{level:4,xp:30,constellationId:c.id,form:'constellation'});publish();
   for(const level of [5]){
     await page.locator('#world').focus();await page.locator('#interact-prompt').filter({hasText:'진화의 별'}).waitFor();await page.keyboard.press('e');await page.locator('#evolution-evolve').click();await page.locator('#evolution-yes').click();
     await page.waitForFunction(level=>document.getElementById('evolution-summary').textContent.includes(level===5?'초월체':'LV'+level),level);
     assert.equal(p.avatar.level,level);assert.equal(p.avatar.xp,0);assert.equal(p.avatar.constellationId,c.id);
     await page.locator('#evolution-header-close').click();await page.locator('#dock-avatar').click();
     const expected=constellationOf(c.id,level);
     await page.waitForFunction(path=>document.getElementById('self-ability-art').getAttribute('src')===path&&document.getElementById('self-ability-art').complete&&document.getElementById('self-ability-art').naturalWidth>0,expected.art);
     await page.waitForFunction(detail=>document.getElementById('world').dataset.selfLabelDetail===detail,`LV${level} ${c.name}`+(level===5?' · 초월체':''));
     assert.equal(await page.locator('#world').getAttribute('data-self-sprite'),expected.art);
     assert.equal(await page.locator('#self-form-name').textContent(),c.name);
     assert.ok(await page.locator('#avatar-card').evaluate(e=>e.classList.contains('celestial-card')));
     if(c.id==='pisces'&&level===5)await page.screenshot({path:'.local/celestial-profile.png'});
     await page.keyboard.press('Escape');
   }
 }
 check('16종 모두 실제 진화 UI LV4→LV5 최종 초월체·XP0·계보 보존');
 check('16개 단계의 맵/내정보 이미지·별자리 이름·LV 두 줄 매칭');
 await page.screenshot({path:'.local/celestial-world.png'});
 // PNG 실제 알파 채널과 로드 실패를 브라우저에서 확인합니다.
 const alpha=await page.evaluate(async ids=>Promise.all(ids.map(async id=>{
   const image=new Image();image.src='/assets/avatars/celestial/'+id+'.png';await image.decode();
   const canvas=document.createElement('canvas');canvas.width=image.width;canvas.height=image.height;const ctx=canvas.getContext('2d');ctx.drawImage(image,0,0);
   const bytes=ctx.getImageData(0,0,canvas.width,canvas.height).data;let clear=0,visible=0;for(let i=3;i<bytes.length;i+=4){if(bytes[i]===0)clear++;if(bytes[i]>32)visible++;}
   return {id,width:image.width,height:image.height,clear,visible};
 })),CONSTELLATIONS.map(c=>c.id));
 for(const a of alpha){assert.ok(a.clear>1000&&a.visible>1000,a.id);assert.equal(a.width,a.height);}check('16종 투명 PNG 정상 로드·투명 배경과 실제 그림 픽셀 확인');
 await page.locator('#dock-avatar').click();await page.emulateMedia({reducedMotion:'reduce'});
 assert.equal(await page.locator('.card-art').evaluate(e=>getComputedStyle(e,'::after').animationName),'none');
 await page.setViewportSize({width:390,height:844});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await page.screenshot({path:'.local/celestial-mobile.png'});check('동작 줄이기 설정·390px 내정보 표시');
 await page.keyboard.press('Escape');
 for(const level of [2,3,4]){p.avatar.level=level;publish();await page.waitForFunction(detail=>document.getElementById('world').dataset.selfLabelDetail===detail,`LV${level} 물고기자리`);assert.equal(await page.locator('#world').getAttribute('data-self-sprite'),constellationOf('pisces',level).sprite);}
 check('LV2/3/4 기존 원화 유지·두 줄 이름표');
 // 원화를 조작하지 않고 HTML 갤러리로 16종을 한눈에 검수합니다.
 const gallery=await browser.newPage({viewport:{width:1200,height:1320}});
 const galleryHtml=`<!doctype html><meta charset="utf-8"><style>body{margin:0;background:#18162c;color:#fff;font:18px sans-serif}h1,p{text-align:center}main{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;padding:20px}figure{margin:0;padding:8px;border:1px solid #65517f;border-radius:18px;background:radial-gradient(ellipse,#393052,#19162e)}img{width:100%;height:230px;object-fit:contain}figcaption{text-align:center}</style><h1>별빛 아바타 · 16개의 별자리</h1><p>LV5 · 초월체 / 맵과 내 정보 공용 원화</p><main>${CONSTELLATIONS.map(c=>`<figure><img src="${url+constellationOf(c.id,5).art}"/><figcaption>${c.name}</figcaption></figure>`).join('')}</main>`;
 await gallery.route(url+'/__art-review',route=>route.fulfill({contentType:'text/html',body:galleryHtml}));await gallery.goto(url+'/__art-review');
 await gallery.locator('img').evaluateAll(images=>Promise.all(images.map(i=>i.decode())));await gallery.screenshot({path:'.local/celestial-gallery.jpg',type:'jpeg',quality:85,fullPage:true});
 assert.deepEqual(errors,[]);await writeFile('.local/celestial-result.json',JSON.stringify({checks,alpha,errors},null,2));
}finally{socket.disconnect();await browser.close();await game.close();}
