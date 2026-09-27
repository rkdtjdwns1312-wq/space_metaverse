import assert from 'node:assert/strict';
import {mkdir,readFile} from 'node:fs/promises';
import {chromium} from 'playwright';
import {io} from 'socket.io-client';
import {createClassroomServer} from '../server/app.js';
import {MAP,PLAZA_ID,STATIC_MAPS} from '../shared/config.js';

// Request 251 artwork checks use an in-memory, throwaway classroom and synthetic student only.
const key='request-251-plaza-art-test-key';
const game=createClassroomServer({teacherKey:key,studentHours:false});
const {port}=await game.listen(),url=`http://127.0.0.1:${port}`;
const browser=await chromium.launch({headless:true,args:['--no-proxy-server'],...(process.platform==='win32'?{channel:'msedge'}:{})});
const socket=io(url,{transports:['websocket'],reconnection:false}),errors=[],checks=[];
await mkdir('.local',{recursive:true});
const check=message=>{checks.push(message);console.log(`Plaza art ${checks.length}: ${message}`);};

try{
  await new Promise((resolve,reject)=>{socket.once('connect',resolve);socket.once('connect_error',reject);});
  const created=await socket.timeout(5000).emitWithAck('room:create',{teacherKey:key,title:'광장 그림 검증',allowedNames:['검증 학생']});
  assert.ok(created.ok,created.message||'temporary classroom creation failed');
  const context=await browser.newContext({viewport:{width:1440,height:960},hasTouch:true});
  context.setDefaultTimeout(10000);
  const page=await context.newPage();
  page.on('pageerror',error=>errors.push(error.message));
  await page.goto(url);
  await page.locator('#join-code').fill(created.room.code);
  await page.locator('#nickname').fill('검증 학생');
  await page.locator('#student-pin').fill('1234');
  await page.locator('#student-form .submit').click();
  await page.locator('#lobby').waitFor({state:'hidden'});

  const room=game.store.rooms.get(created.room.code);
  const player=[...room.players.values()].find(candidate=>candidate.role==='student');
  assert.ok(player,'synthetic student joined the in-memory classroom');
  const publish=()=>game.io.to(player.socketId).emit('room:state',game.store.snapshot(room,player));
  assert.equal(player.mapId,PLAZA_ID,'the joined player starts in the actual plaza');

  const assetChecks=await page.evaluate(async()=>{
    const paths=['/assets/maps/plaza-sanctuary.png','/assets/maps/plaza-paving.png','/assets/maps/plaza-pillar.png'];
    const images=await Promise.all(paths.map(src=>new Promise(resolve=>{
      const image=new Image();image.onload=()=>resolve({src,loaded:true,width:image.naturalWidth,height:image.naturalHeight,image});
      image.onerror=()=>resolve({src,loaded:false,width:0,height:0});image.src=src;
    })));
    let pillarAlpha=null;
    const pillar=images[2];
    if(pillar.loaded){
      const canvas=document.createElement('canvas');canvas.width=pillar.width;canvas.height=pillar.height;
      const context=canvas.getContext('2d',{willReadFrequently:true});context.drawImage(pillar.image,0,0);
      const pixels=context.getImageData(0,0,pillar.width,pillar.height).data;
      let transparent=0;for(let index=3;index<pixels.length;index+=4)if(pixels[index]===0)transparent++;
      pillarAlpha={transparentPixels:transparent,totalPixels:pillar.width*pillar.height};
    }
    return {images:images.map(({image,...result})=>result),pillarAlpha};
  });
  for(const image of assetChecks.images)assert.ok(image.loaded,`${image.src} loads in the browser`);
  const background=assetChecks.images[0],paving=assetChecks.images[1],pillar=assetChecks.images[2];
  assert.ok(background.width>=1024&&background.height>=1024,`plaza sanctuary background is at least 1024px: ${background.width}x${background.height}`);
  assert.ok(paving.width>0&&paving.height>0,'plaza paving texture has nonzero dimensions');
  assert.ok(assetChecks.pillarAlpha?.transparentPixels>0,'pillar artwork contains fully transparent pixels');
  check(`우주 배경·바닥 타일·기둥 PNG 로드, 배경 ${background.width}×${background.height}, 기둥 투명 픽셀 확인`);

  // The full-map renderer is part of the required artwork contract, so fail if it is missing.
  const artModule=await readFile(new URL('../client/plaza-art.js',import.meta.url),'utf8');
  assert.match(artModule,/export\s+(?:async\s+)?function\s+drawPlazaGround\b|export\s*\{[^}]*\bdrawPlazaGround\b/s,
    'client/plaza-art.js must export drawPlazaGround');
  const overview=await page.evaluate(async({width,height})=>{
    const config=await import('/shared/config.js');
    const art=await import('/plaza-art.js');
    if(typeof art.drawPlazaGround!=='function')throw new Error('drawPlazaGround export is not callable');
    const canvas=document.createElement('canvas');canvas.width=width;canvas.height=height;
    const context=canvas.getContext('2d');
    art.drawPlazaGround(context,config.MAP,0);
    return {width:canvas.width,height:canvas.height,data:canvas.toDataURL()};
  },{width:MAP.width,height:MAP.height});
  assert.ok(overview.data.startsWith('data:image/png;base64,'),'the full-map ground renderer produces a PNG');
  await page.evaluate(data=>{
    const image=new Image();image.src=data;
    return new Promise((resolve,reject)=>{image.onload=()=>{document.body.append(image);image.id='plaza-overview-review';image.style='position:fixed;inset:0;width:100vw;height:100vh;object-fit:contain;background:#fff;z-index:99999';resolve();};image.onerror=reject;});
  },overview.data);
  await page.screenshot({path:'.local/251-plaza-overview.png'});
  await page.locator('#plaza-overview-review').evaluate(image=>image.remove());
  check('drawPlazaGround 전체 지도 미리보기 캡처');

  await page.waitForFunction(()=>document.getElementById('minimap-title')?.textContent==='별의 기원');
  await page.waitForTimeout(250);
  await page.screenshot({path:'.local/251-plaza-desktop.png'});
  check('실제 입장한 플레이어가 있는 광장 데스크톱 화면 저장');

  for(const id of ['pillar-notice','pillar-effects','pillar-timetable','pillar-weekly']){
    const pillar=MAP.objects.find(object=>object.id===id);
    assert.ok(pillar,`${id} exists in the unchanged plaza map config`);
    Object.assign(player,{mapId:PLAZA_ID,x:pillar.x+(pillar.radius||0)+35,y:pillar.y});publish();
    await page.locator('#interact-prompt').filter({hasText:pillar.name}).waitFor({state:'visible'});
    await page.locator('#world').focus();await page.keyboard.press('f');
    await page.locator('#temple-dialog').waitFor({state:'visible'});
    await page.locator('#temple-title').filter({hasText:pillar.name}).waitFor();
    if(pillar.service==='notice')await page.locator('#temple-content').filter({hasText:/등록하지 않았어요|알림 내용/}).waitFor();
    else if(pillar.service==='timetable')await page.locator('#temple-content').filter({hasText:/월요일|시간표|등록하지 않았어요/}).waitFor();
    else if(pillar.service==='effects')await page.locator('#temple-content').filter({hasText:'지금 사용 중인 아이템이 없어요.'}).waitFor();
    else if(pillar.service==='weekly'){
      const weeklyRow=page.locator('#temple-content li').filter({hasText:'검증 학생'});
      await weeklyRow.waitFor({state:'visible'});
      assert.match(await weeklyRow.textContent(),/검증 학생\s*·\s*★\s*0개/,'weekly rewards show the synthetic student with a zero total');
    }
    await page.locator('#temple-close').click();
    await page.locator('#temple-dialog').waitFor({state:'hidden'});
    check(`F 상호작용이 올바른 ${pillar.service} 서비스로 연결: ${pillar.name}`);
  }

  const star=MAP.objects.find(object=>object.kind==='life-star');
  assert.ok(star,'the existing life star remains in the plaza map config');
  Object.assign(player,{mapId:PLAZA_ID,x:star.x+(star.radius||0)+35,y:star.y});publish();
  await page.locator('#interact-prompt').filter({hasText:star.name}).waitFor({state:'visible'});
  await page.locator('#world').focus();await page.keyboard.press('f');
  await page.locator('#toast').filter({hasText:/회복|가득/}).waitFor();
  assert.equal(player.mapId,PLAZA_ID,'life-star interaction keeps the player in the plaza');
  check('생명의 별 실제 F 상호작용과 광장 위치 유지');

  const gate=MAP.objects.find(object=>object.kind==='gate'&&object.target!==PLAZA_ID&&STATIC_MAPS[object.target]);
  assert.ok(gate,'the plaza has an existing outbound gate');
  assert.ok(gate.arrival&&Number.isFinite(gate.arrival.x)&&Number.isFinite(gate.arrival.y),'outbound plaza gate defines target arrival coordinates');
  const targetMap=STATIC_MAPS[gate.target];
  const returnGate=targetMap.objects.find(object=>object.kind==='gate'&&object.target===PLAZA_ID);
  assert.ok(returnGate,`destination ${gate.target} has an actual return gate to the plaza`);
  assert.ok(returnGate.arrival&&Number.isFinite(returnGate.arrival.x)&&Number.isFinite(returnGate.arrival.y),'return gate defines plaza arrival coordinates');
  Object.assign(player,{mapId:PLAZA_ID,x:gate.x,y:gate.y});publish();
  await page.locator('#interact-prompt').filter({hasText:gate.name}).waitFor({state:'visible'});
  await page.locator('#touch-interact').tap();
  const destinationName=targetMap.name;
  await page.waitForFunction(name=>document.getElementById('minimap-title')?.textContent===name,destinationName);
  assert.equal(player.mapId,gate.target,'the actual gate moves the player to its destination');
  assert.ok(Math.hypot(player.x-gate.arrival.x,player.y-gate.arrival.y)<=(gate.radius||0)+100,
    'actual outbound travel uses the plaza gate arrival coordinates');
  await page.waitForFunction(({x,y})=>Math.hypot(Number(document.getElementById('world').dataset.selfRenderX)-x,Number(document.getElementById('world').dataset.selfRenderY)-y)<100,
    {x:gate.arrival.x,y:gate.arrival.y});
  Object.assign(player,{mapId:gate.target,x:returnGate.x,y:returnGate.y});publish();
  await page.locator('#interact-prompt').filter({hasText:returnGate.name}).waitFor({state:'visible'});
  await page.locator('#world').focus();await page.keyboard.press('f');
  await page.waitForFunction(()=>document.getElementById('minimap-title')?.textContent==='별의 기원');
  assert.equal(player.mapId,PLAZA_ID,'the actual return gate brings the player back to the plaza');
  assert.ok(Math.hypot(player.x-returnGate.arrival.x,player.y-returnGate.arrival.y)<=(returnGate.radius||0)+100,
    'actual return travel uses the destination gate arrival coordinates');
  const spawn=MAP.spawn||{x:MAP.width/2,y:MAP.height/2};
  Object.assign(player,{mapId:PLAZA_ID,x:spawn.x,y:spawn.y});publish();
  await page.waitForFunction(({x,y})=>Math.hypot(Number(document.getElementById('world').dataset.selfRenderX)-x,Number(document.getElementById('world').dataset.selfRenderY)-y)<100,
    {x:spawn.x,y:spawn.y});
  await page.waitForTimeout(250);await page.screenshot({path:'.local/251-plaza-desktop.png'});
  check('실제 광장 문 왕복 뒤 MAP.spawn 중앙에서 데스크톱 화면 저장');

  await page.setViewportSize({width:390,height:844});
  publish();
  await page.waitForFunction(()=>document.getElementById('minimap-title')?.textContent==='별의 기원');
  await page.waitForTimeout(250);await page.screenshot({path:'.local/251-plaza-mobile.png'});
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'390px plaza view has no horizontal page overflow');
  check('390px 실제 플레이어 광장 화면 저장, 가로 넘침 없음');

  assert.deepEqual(errors,[],'browser page has no uncaught JavaScript errors');
  assert.equal(checks.filter(message=>message.startsWith('F 상호작용')).length,4,'all four pillar services were exercised');
  console.log(`verify-plaza-art: ${checks.length}개 확인, pageerrors=0`);
}catch(error){
  for(const context of browser.contexts())for(const page of context.pages())await page.screenshot({path:'.local/251-plaza-art-failure.png'}).catch(()=>{});
  throw error;
}finally{
  socket.disconnect();await browser.close();await game.close();
}
