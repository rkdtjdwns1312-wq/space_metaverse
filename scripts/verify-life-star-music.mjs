import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
import {chromium} from 'playwright';
import {createClassroomServer} from '../server/app.js';
import {io} from 'socket.io-client';
import {MAP} from '../shared/config.js';
import {ensureVitals} from '../server/vitals.js';
const game=createClassroomServer({teacherKey:'life-star-music-test',studentHours:false});
const {port}=await game.listen();let browser;
try{
  browser=await chromium.launch({headless:true,...(process.platform==='win32'?{channel:'msedge'}:{})});
  const page=await browser.newPage();const errors=[];page.on('pageerror',error=>errors.push(error.message));
  await page.route('**/__life_star_music_test',route=>route.fulfill({contentType:'text/html',body:`<!doctype html><html lang="ko"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/style.css"><link rel="stylesheet" href="/fantasy-ui.css"><link rel="stylesheet" href="/dialog-layout.css"><link rel="stylesheet" href="/life-star-ui.css"><body><button id="open">생명의별</button><script type="module">
    import {createAudio} from '/audio.js';import {createLifeStarUI} from '/life-star-ui.js';import '/dialog-close-bootstrap.js';
    const players={};window.calls=[];const audio=createAudio({storage:null,mediaFactory:(id)=>players[id]={paused:true,currentTime:0,async play(){this.paused=false;},pause(){this.paused=true;},addEventListener(){}}});
    window.audio=audio;window.players=players;await audio.playBgm('space-plaza');
    window.ui=createLifeStarUI({audio,request:async(event,payload)=>{calls.push({event,payload});return {message:'회복 중'};},stop(){},toast(){},onClose:()=>document.getElementById('open').focus()});
    document.getElementById('open').onclick=()=>ui.open('space-plaza');window.ready=true;
  </script>`}));
  await page.goto(`http://127.0.0.1:${port}/__life_star_music_test`);await page.waitForFunction(()=>window.ready);
  await mkdir('.local/life-star-music',{recursive:true});
  for(const size of [{width:1280,height:800},{width:390,height:844},{width:844,height:390}]){
    await page.setViewportSize(size);await page.locator('#open').click();
    const options=page.locator('.life-star-options button');assert.deepEqual(await options.allTextContents(),['회복하기','노래듣기']);
    const a=await options.nth(0).boundingBox(),b=await options.nth(1).boundingBox();assert.ok(b.y>=a.y+a.height);
    await page.locator('[data-music]').click();await page.locator('[data-track="star-origin-1"]').click();
    assert.match(await page.locator('[role=status]').textContent(),/별의 시작점 · 재생 중/);
    await page.evaluate(()=>audio.playBgm('space-plaza'));
    assert.deepEqual(await page.evaluate(()=>Object.entries(players).filter(([,p])=>!p.paused).map(([id])=>id)),['star-origin-1']);
    await page.locator('[data-repeat]').click();await page.locator('[data-stop]').click();
    assert.equal(await page.evaluate(()=>Object.values(players).every(p=>p.paused)),true);
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
    const close=await page.locator('#life-star-dialog [data-close]').boundingBox();assert.ok(close.x>=0&&close.y>=0&&close.x+close.width<=size.width&&close.y+close.height<=size.height);
    await page.screenshot({path:`.local/life-star-music/${size.width}x${size.height}.png`});
    await page.keyboard.press('Escape');await page.locator('#life-star-dialog').waitFor({state:'hidden'});
    await page.waitForFunction(()=>players['space-plaza'].paused===false);
  }
  await page.locator('#open').click();await page.locator('[data-recover]').click();await page.locator('#life-star-dialog').waitFor({state:'hidden'});
  assert.deepEqual(await page.evaluate(()=>calls),[{event:'life-star:recover',payload:{}}]);
  await page.locator('#open').click();await page.locator('[data-music]').click();await page.locator('[data-track="star-origin-1"]').click();
  await page.evaluate(()=>{ui.updateMap('milky-valley');audio.playBgm('milky-valley');});await page.locator('#life-star-dialog').waitFor({state:'hidden'});
  assert.deepEqual(await page.evaluate(()=>Object.entries(players).filter(([,p])=>!p.paused).map(([id])=>id)),['milky-valley']);
  assert.deepEqual(errors,[]);console.log('PASS life-star options/recovery, music play/stop/repeat/restore/navigation, desktop/mobile/landscape layout and Escape');
  const socket=io(`http://127.0.0.1:${port}`,{transports:['websocket'],reconnection:false});
  try{
    await new Promise((resolve,reject)=>{socket.once('connect',resolve);socket.once('connect_error',reject);});
    const created=await socket.timeout(5000).emitWithAck('room:create',{teacherKey:'life-star-music-test',title:'음악 검사 교실',allowedNames:['음악 검사']});assert.ok(created.ok);
    await page.setViewportSize({width:1280,height:800});await page.goto(`http://127.0.0.1:${port}`);await page.locator('#student-tab').click();
    await page.locator('#join-code').fill(created.room.code);await page.locator('#nickname').fill('음악 검사');await page.locator('#student-pin').fill('1234');await page.locator('#student-form .submit').click();await page.locator('#lobby').waitFor({state:'hidden'});
    if(await page.locator('#tutorial-later').isVisible())await page.locator('#tutorial-later').click();
    const room=game.store.rooms.get(created.room.code),player=[...room.players.values()].find(p=>p.role==='student'),star=MAP.objects.find(o=>o.kind==='life-star');
    Object.assign(player,{x:star.x+60,y:star.y});Object.assign(ensureVitals(player),{hp:1,mp:0});game.io.to(player.socketId).emit('room:state',game.store.snapshot(room,player));
    await page.locator('#interact-object').filter({hasText:'생명의별'}).waitFor();await page.locator('#world').focus();await page.keyboard.press('f');
    await page.locator('#life-star-dialog').waitFor({state:'visible'});await page.locator('[data-recover]').click();await page.locator('#life-star-dialog').waitFor({state:'hidden'});
    assert.ok(player.battleVitals.lifeRecovery,'actual app requests server life-star recovery');
    await page.locator('#world').focus();await page.keyboard.press('f');await page.locator('[data-music]').click();await page.locator('[data-track="star-origin-1"]').click();
    await page.locator('[role=status]').filter({hasText:'별의 시작점 · 재생 중'}).waitFor();await page.keyboard.press('Escape');await page.locator('#life-star-dialog').waitFor({state:'hidden'});
    assert.deepEqual(errors,[]);console.log('PASS actual app student login → F → recovery server request, F → music playback → Escape');
  }finally{socket.disconnect();}
}finally{await browser?.close();await game.close();}
