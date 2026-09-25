// 실제 교실과 분리된 서버에서 UI·전투·배치를 확인합니다.
import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {createClassroomServer} from '../server/app.js';
import {monstersOf} from '../server/monsters.js';
import {STREET,STREET_ID} from '../shared/config.js';
import {fillNewClass} from './class-setup.mjs';

const key='energy-world-browser-key',game=createClassroomServer({teacherKey:key,studentHours:false});
const {port}=await game.listen(),url='http://127.0.0.1:'+port;
const browser=await chromium.launch({headless:true,...(process.platform==='win32'?{channel:'msedge'}:{})});
const page=await browser.newPage({viewport:{width:1440,height:960}}),errors=[],checks=[];
page.on('pageerror',e=>errors.push(e.message));page.setDefaultTimeout(10000);
const check=text=>{checks.push(text);console.log('Energy world '+checks.length+': '+text);};
await mkdir('.local',{recursive:true});
try{
  await page.goto(url);await page.locator('#teacher-tab').click();await page.locator('#teacher-key').fill(key);
  await fillNewClass(page,['1']);await page.locator('#teacher-form .submit').click();await page.locator('#lobby').waitFor({state:'hidden'});
  const room=[...game.store.rooms.values()][0],teacher=[...room.players.values()].find(p=>p.role==='teacher');
  const publish=p=>game.io.to(p.socketId).emit('room:state',game.store.snapshot(room,p));
  const shops=STREET.objects.filter(o=>o.kind==='shop'||o.kind==='energy-shop'),machines=STREET.objects.filter(o=>o.kind==='arcade');
  assert.equal(shops.length,2);assert.equal(machines.length,5);assert.ok(shops[0].x<shops[1].x);
  assert.ok(shops.every(s=>s.y<STREET.height/2));assert.ok(machines.every(m=>m.y>STREET.height/2&&STREET.height-m.y-58>=180));
  Object.assign(teacher,{mapId:STREET_ID,x:600,y:380});publish(teacher);
  await page.locator('#map-overview').click();await page.locator('#map-area-view').click();
  await page.waitForTimeout(250);await page.screenshot({path:'.local/205-shops-arcades.png'});
  check('위쪽 상점2개·아래쪽 게임기5개·게임기 밑 최소180 여백');
  const shop=shops.find(o=>o.kind==='energy-shop');Object.assign(teacher,{x:shop.x,y:shop.y+shop.radius+10});publish(teacher);
  await page.locator('#interact-prompt').filter({hasText:'우주에너지 상점'}).waitFor();await page.locator('#world').focus();await page.keyboard.press('f');
  await page.locator('#energy-shop-dialog').waitFor({state:'visible'});assert.match(await page.locator('#energy-shop-dialog').innerText(),/준비/);
  assert.equal(await page.locator('#energy-shop-wallet .currency-chip').count(),2);
  await page.screenshot({path:'.local/204-energy-shop.png'});await page.locator('#energy-shop-close').click();check('실제 F로 우주에너지 상점 열기·잔액·준비중·닫기');
  const student=await browser.newPage({viewport:{width:1440,height:960}});student.on('pageerror',e=>errors.push(e.message));
  await student.goto(url);await student.locator('#join-code').fill(room.code);await student.locator('#nickname').fill('1');await student.locator('#student-pin').fill('1234');
  await student.locator('#student-form .submit').click();await student.locator('#lobby').waitFor({state:'hidden'});
  const p=[...room.players.values()].find(p=>p.role==='student'),lion=monstersOf(room).get('lion');
  p.avatar.level=5;p.avatar.constellationId='aquarius';Object.assign(lion,{x:600,y:450,hp:1,nextDirectionAt:Infinity,dx:0,dy:0});
  Object.assign(p,{mapId:lion.mapId,x:538,y:450,facing:{x:1,y:0}});publish(p);
  await student.waitForFunction(()=>document.getElementById('world').dataset.monsterCount==='5');
  await student.locator('#world').focus();await student.keyboard.press('q');
  await student.locator('#interact-prompt').filter({hasText:/우주에너지.*줍기/}).waitFor();
  const drop=[...room.energyDrops.values()][0];assert.ok(drop.total>=6&&drop.total<=10);assert.equal(p.cosmicEnergy,0);
  await student.screenshot({path:'.local/203-energy-drop.png'});await student.keyboard.press('f');
  await student.locator('#toast').filter({hasText:/우주에너지.*주웠어요/}).waitFor();assert.equal(p.cosmicEnergy,drop.total);
  await student.locator('#dock-inventory').click();assert.equal(await student.locator('#self-energy').innerText(),String(drop.total));await student.keyboard.press('Escape');
  check('Q 실제 처치·자동습득 없음·본인 드랍 F 습득·인벤토리 잔액');
  // 같은 수령 경로를 터치 버튼에서도 사용합니다.
  const second={...drop,id:'touch-drop',shares:new Map([[p.id,6]]),expiresAt:Date.now()+60000};room.energyDrops.set(second.id,second);publish(p);
  await student.locator('#interact-prompt').filter({hasText:/우주에너지.*줍기/}).waitFor();await student.locator('#touch-interact').click();
  await student.waitForFunction(()=>document.getElementById('world').dataset.energyDropCount==='0');assert.equal(p.cosmicEnergy,drop.total+6);check('터치 조사하기도 동일한 습득·중복 없는 잔액');
  const crab=monstersOf(room).get('star-crab'),water=monstersOf(room).get('water-star');
  for(const [m,x] of [[crab,600],[water,820]])Object.assign(m,{x,y:400,nextDirectionAt:Infinity,dx:0,dy:0});
  Object.assign(p,{mapId:crab.mapId,x:550,y:400});publish(p);
  await student.waitForFunction(()=>document.getElementById('minimap-title').textContent.includes('시작점 1'));
  await student.evaluate(async()=>{for(const name of ['star-crab','water-star']){const img=new Image();img.src='/assets/monsters/'+name+'.png';await img.decode();const c=document.createElement('canvas');c.width=c.height=1;const ctx=c.getContext('2d');ctx.drawImage(img,0,0);if(ctx.getImageData(0,0,1,1).data[3]!==0)throw Error('Sprite background must be transparent');}});
  assert.equal((await student.locator('#world').getAttribute('data-monster-count')),'5');
  await student.screenshot({path:'.local/206-monsters-map.png'});check('첨부 기반 별게·물별이 PNG 투명 배경·첫 맵5마리');
  for(const m of [crab,water]){
    Object.assign(p,{x:m.x-50,y:m.y});p.battleVitals=null;m.attackers.set(p.id,1);m.nextAttackAt=0;publish(p);
    await student.waitForFunction(shape=>document.getElementById('world').dataset.lastMonsterEffect===shape,m.typeId);
    await student.waitForTimeout(160);await student.screenshot({path:'.local/206-'+m.typeId+'-attack.png'});m.attackers.clear();
  }
  check('별게 물결·물별이 물보라가 실제 서버 반격에 연결');
  // 렌더러의 양방향·공격 중간 프레임을 큰 판에서 함께 시각 검수합니다.
  await page.evaluate(async()=>{
    const {drawWaterMonster}=await import('/water-monster-art.js');
    for(const shape of ['star-crab','water-star']){const img=new Image();img.src='/assets/monsters/'+shape+'.png';await img.decode();}
    const canvas=document.createElement('canvas');canvas.id='sprite-review';canvas.width=1000;canvas.height=600;canvas.style.cssText='position:fixed;inset:0;z-index:99999';document.body.append(canvas);
    const ctx=canvas.getContext('2d');const draw=()=>{ctx.fillStyle='#202b54';ctx.fillRect(0,0,1000,600);for(const [i,shape] of ['star-crab','water-star'].entries())for(const [j,face] of [-1,1].entries()){
      const x=220+j*540,y=155+i*290;drawWaterMonster(ctx,{shape,x,y,radius:52,facingX:face,moving:true},300,{startedAt:0,durationMs:600,dx:face,dy:0,reach:80});ctx.fillStyle='#fff';ctx.font='20px sans-serif';ctx.textAlign='center';ctx.fillText(shape+' '+(face<0?'←':'→'),x,y+118);
    }};draw();await new Promise(r=>setTimeout(r,250));draw();
  });
  await page.locator('#sprite-review').screenshot({path:'.local/206-sprite-review.png'});check('좌우 반전 이동·공격 렌더 검수판');
  assert.deepEqual(errors,[]);await writeFile('.local/206-energy-world.json',JSON.stringify({checks,errors},null,2));
}catch(e){await page.screenshot({path:'.local/206-energy-world-failure.png'}).catch(()=>{});throw e;}
finally{await browser.close();await game.close();}
