import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {createClassroomServer} from '../server/app.js';
import {fillNewClass} from './class-setup.mjs';
import {STREET,STREET_ID} from '../shared/config.js';
import {weekStartKst} from '../server/weekly-ranking.js';
const key='stars-browser-test-private',game=createClassroomServer({teacherKey:key,studentHours:false}),address=await game.listen();
const browser=await chromium.launch({headless:true,...(process.platform==='win32'?{channel:'msedge'}:{})}),checks=[],errors=[];
const check=text=>{checks.push(text);console.log(text);};await mkdir('.local',{recursive:true});
try{
  const page=await browser.newPage({viewport:{width:1440,height:960}});page.on('pageerror',e=>errors.push(e.message));
  await page.goto('http://127.0.0.1:'+address.port);await page.locator('#teacher-tab').click();await page.locator('#teacher-key').fill(key);await fillNewClass(page,['1']);await page.locator('#teacher-form .submit').click();await page.locator('#lobby').waitFor({state:'hidden'});
  const room=[...game.store.rooms.values()][0],p=[...room.players.values()][0],machine=STREET.objects.find(o=>o.gameId==='stars');
  Object.assign(p,{mapId:STREET_ID,x:machine.x,y:machine.y+70});game.io.to(p.socketId).emit('room:state',game.store.snapshot(room,p));
  await page.locator('#interact-prompt').filter({hasText:machine.name}).waitFor();await page.locator('#touch-interact').click();
  await page.locator('#star-start').waitFor();assert.equal(await page.locator('#star-grid button').count(),16);
  await page.locator('#star-ranking-toggle').click();await page.locator('#star-ranking').filter({hasText:'아직 기록이 없어요'}).waitFor();check('4×4 게임판·시작 전 랭킹 보기·빈 목록');
  await page.locator('#star-start').click();
  for(let i=0;i<10;i++){await page.locator('#star-grid').getByRole('button',{name:'⭐',exact:true}).click();await page.locator('#star-timer').filter({hasText:(i+1)+' / 10'}).waitFor();}
  await page.locator('#star-timer').filter({hasText:'10 / 10'}).waitFor();await page.locator('#star-ranking').filter({hasText:'1위'}).waitFor();assert.equal(room.starRanking.length,1);check('열 번째 별에서 스탑워치 종료·서버 기록과 순위 표시');
  // 다른 친구의 기록 수신을 재현하고 열린 창이 갱신되는지 확인합니다.
  const entry={id:'new-record',playerId:'friend',nickname:'친구',elapsedMs:1,at:Date.now()};room.starRanking=[entry,...room.starRanking];
  game.io.to(room.code).emit('stars:ranking',{ranking:room.starRanking.map((r,i)=>({...r,rank:i+1}))});
  await page.locator('#star-ranking li').first().filter({hasText:'1위 · 친구'}).waitFor();check('열린 랭킹 창에 새 기록 실시간 반영');
  room.starRanking=room.starRanking.map(r=>({...r,at:weekStartKst()-1}));
  await page.locator('#star-ranking').filter({hasText:'아직 기록이 없어요'}).waitFor();assert.equal(room.starRanking.length,0);check('지난주 기록 자동 삭제·열린 순위 창 초기화');
  await page.setViewportSize({width:390,height:844});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  assert.equal(await page.locator('#star-grid').evaluate(el=>getComputedStyle(el).gridTemplateColumns.split(' ').length),4);
  await page.screenshot({path:'.local/stars-mobile.png'});await page.locator('#star-start').click();await page.locator('#arcade-close').click();
  await page.waitForFunction(()=>!document.getElementById('arcade-dialog').open);await new Promise(r=>setTimeout(r,100));assert.equal(room.starRuns.size,0);assert.equal(await page.locator('#arcade-board button').count(),0);check('390px 4열 유지·닫기 시 게임·입력·타이머 정리');
  const dodgeMachine=STREET.objects.find(o=>o.gameId==='dodge');Object.assign(p,{x:dodgeMachine.x,y:dodgeMachine.y+70});game.io.to(p.socketId).emit('room:state',game.store.snapshot(room,p));
  await page.locator('#interact-prompt').filter({hasText:dodgeMachine.name}).waitFor();await page.locator('#touch-interact').click();
  await page.locator('#dodge-start').click();await page.locator('#dodge-status').filter({hasText:'별을 피하세요!'}).waitFor();await page.locator('#dodge-canvas').focus();
  await page.keyboard.down('ArrowRight');await page.waitForTimeout(200);await page.keyboard.up('ArrowRight');
  assert.ok(room.dodgeRuns.get(p.id).playerBody.x>310);check('실제 다섯째 오락기→방향키 입력→서버 캐릭터 이동');
  const run=room.dodgeRuns.get(p.id);run.stars.push({id:'fixture-collision',x:run.playerBody.x,y:run.playerBody.y,vx:0,vy:0,radius:10});
  await page.locator('#dodge-status').filter({hasText:'별에 닿았어요'}).waitFor();assert.equal(room.dodgeRanking.length,1);
  await page.locator('#dodge-ranking-toggle').click();await page.locator('#dodge-ranking').filter({hasText:'1위'}).waitFor();check('서버 충돌 판정→생존기록 저장→랭킹 보기');
  await page.screenshot({path:'.local/dodge-integration-mobile.png'});
  room.dodgeRanking=room.dodgeRanking.map(r=>({...r,at:weekStartKst()-1}));await page.locator('#dodge-ranking').filter({hasText:'아직 이번 주 기록이 없어요'}).waitFor();
  await page.locator('#dodge-start').click();await page.locator('#arcade-close').click();await page.waitForTimeout(150);assert.equal(room.dodgeRuns.size,0);check('별 피하기 주간 초기화·게임 중 닫기 서버 정리');
  assert.deepEqual(errors,[]);
}finally{await writeFile('.local/stars-result.json',JSON.stringify({checks,errors},null,2));await browser.close();await game.close();}
console.log(JSON.stringify({checks:checks.length,errors}));
