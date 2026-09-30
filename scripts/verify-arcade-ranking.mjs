import assert from 'node:assert/strict';
import {mkdtemp,mkdir,rm,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {performance} from 'node:perf_hooks';
import {chromium} from 'playwright';
import {createClassroomServer} from '../server/app.js';
import {STREET,STREET_ID,MAP,PLAZA_ID} from '../shared/config.js';
import {weekStartKst} from '../server/weekly-ranking.js';
import {recordReward} from '../server/temple.js';
import {fillNewClass} from './class-setup.mjs';

// 실행마다 임시 저장 교실을 만들며 실제 교실 자료를 읽거나 바꾸지 않습니다.
const dir=await mkdtemp(join(tmpdir(),'arcade-ranking-ui-')),key='memory-browser-test-private';
const game=createClassroomServer({teacherKey:key,dataDir:dir,studentHours:false}),address=await game.listen();
const browser=await chromium.launch({headless:true,...(process.platform==='win32'?{channel:'msedge'}:{})});
const checks=[],errors=[];await mkdir('.local',{recursive:true});
const check=text=>{checks.push(text);console.log(`Arcade ${checks.length}: ${text}`);};
try{
  const page=await browser.newPage({viewport:{width:1280,height:960}});page.setDefaultTimeout(7000);page.on('pageerror',e=>errors.push(e.message));
  const url='http://127.0.0.1:'+address.port;
  await page.goto(url,{waitUntil:'domcontentloaded',timeout:30000});await page.locator('#teacher-tab').click();await page.locator('#teacher-key').fill(key);await fillNewClass(page,['검사학생']);await page.locator('#teacher-form .submit').click();await page.locator('#lobby').waitFor({state:'hidden'});
  const room=[...game.store.rooms.values()][0],teacher=[...room.players.values()].find(p=>p.role==='teacher');
  const open=async(page,p,id)=>{
    if(await page.locator('#arcade-dialog').isVisible())await page.locator('#arcade-close').click();
    const machine=STREET.objects.find(o=>o.gameId===id);Object.assign(p,{mapId:STREET_ID,x:machine.x,y:machine.y+65});game.io.to(p.socketId).emit('room:state',game.store.snapshot(room,p));
    await page.locator('#interact-prompt').filter({hasText:machine.name}).waitFor();await page.locator('#touch-interact').click();await page.locator('#arcade-dialog').waitFor();
  };
  const start=async name=>{await page.getByRole('button',{name,exact:true}).click();await page.locator('.memory-start').click();await page.locator('.memory-card').first().waitFor();};
  const solveLocal=async()=>{
    const symbols=await page.locator('.memory-card').evaluateAll(cards=>cards.map(c=>c.dataset.symbol)),groups=new Map();symbols.forEach((s,i)=>groups.set(s,[...(groups.get(s)||[]),i]));
    for(const [a,b] of groups.values()){await page.locator('.memory-card').nth(a).click();await page.locator('.memory-card').nth(b).click();}
  };
  const serverPairs=()=>{const groups=new Map();room.memoryRuns.get(teacher.id).cards.forEach((s,i)=>groups.set(s,[...(groups.get(s)||[]),i]));return [...groups.values()];};
  const solveHigh=async pairs=>{for(const [a,b] of pairs){await page.locator('.memory-card').nth(a).click();await page.waitForFunction(i=>document.querySelectorAll('.memory-card')[i].dataset.state==='open',a);await page.locator('.memory-card').nth(b).click();await page.waitForFunction(i=>document.querySelectorAll('.memory-card')[i].dataset.state==='matched',b);}};
  await open(page,teacher,'memory');await page.locator('#memory-ranking-reset').waitFor();
  assert.deepEqual(await page.locator('.memory-level').allTextContents(),['상','중','하']);assert.equal(await page.locator('.memory-start').isDisabled(),true);
  for(const width of [1280,390]){
    await page.setViewportSize({width,height:960});
    const layout=await page.evaluate(()=>{
      const levels=[...document.querySelectorAll('.memory-level')].map(e=>e.getBoundingClientRect()),start=document.querySelector('.memory-start').getBoundingClientRect();
      const footer=[...document.querySelectorAll('.arcade-footer button')].filter(e=>!e.hidden).map(e=>({text:e.textContent,x:e.getBoundingClientRect().x}));
      return {vertical:levels.every((r,i)=>r.x===levels[0].x&&(!i||r.y>levels[i-1].y)),startRight:start.x>=levels[0].right,footer,overflow:document.documentElement.scrollWidth>innerWidth};
    });
    assert.equal(layout.vertical,true);assert.equal(layout.startRight,true);assert.equal(layout.overflow,false);assert.deepEqual(layout.footer.map(b=>b.text),['초기화','랭킹 보기','닫기']);assert.ok(layout.footer.every((b,i)=>!i||b.x>layout.footer[i-1].x));
  }
  check('1280·390px 상/중/하 세로·시작 오른쪽·교사 하단 초기화/랭킹/닫기');
  for(const [name,rows,columns] of [['하',3,4],['중',4,6]]){
    await start(name);assert.equal(await page.locator('.memory-card').count(),rows*columns);await solveLocal();await page.locator('#arcade-score').filter({hasText:/^성공/}).waitFor();assert.equal(room.memoryRanking?.length||0,0);
  }
  check('하·중 격자와 성공 동작 유지, 랭킹 제외');
  await start('상');assert.equal(await page.locator('.memory-card').count(),36);assert.ok((await page.locator('.memory-card').evaluateAll(cards=>cards.map(c=>c.dataset.symbol))).every(s=>s===''));
  assert.equal(await page.locator('.memory-grid').evaluate(e=>getComputedStyle(e).gridTemplateColumns.split(' ').length),6);
  assert.equal(await page.locator('.memory-grid').evaluate(e=>e.scrollWidth<=e.clientWidth),true);
  const run=room.memoryRuns.get(teacher.id),wrong=run.cards.findIndex(s=>s!==run.cards[0]);
  await page.locator('.memory-card').nth(0).click();await page.waitForFunction(()=>document.querySelector('.memory-card').dataset.state==='open');await page.locator('.memory-card').nth(wrong).click();
  await page.waitForFunction(()=>[...document.querySelectorAll('.memory-card')].every(e=>e.dataset.state==='hidden'));check('상 6×6 숨긴 정답 비노출·서버 불일치 카드 되닫기');
  await solveHigh(serverPairs());await page.locator('#arcade-score').filter({hasText:/^성공 · 18쌍/}).waitFor();assert.equal(room.memoryRanking.length,1);assert.ok(room.memoryRanking[0].remainingMs<60000);
  await page.locator('#memory-ranking-toggle').click();await page.locator('#memory-ranking').filter({hasText:'남은 시간'}).waitFor();
  await page.screenshot({path:'.local/request302-memory-mobile.png'});check('실제 서버 상 성공·남은 시간 기록·모바일 랭킹 표시');
  await start('상');const finalPairs=serverPairs();await solveHigh(finalPairs.slice(0,-1));const [a,b]=finalPairs.at(-1);
  await page.locator('.memory-card').nth(a).click();await page.waitForFunction(i=>document.querySelectorAll('.memory-card')[i].dataset.state==='open',a);
  room.memoryRuns.get(teacher.id).startedAt=performance.now()-60001;
  await page.locator('.memory-card').nth(b).click();await page.locator('#arcade-score').filter({hasText:/^실패/}).waitFor();assert.equal(room.memoryRanking.length,1);check('상 마지막 짝 직전 서버 시간 초과는 실패·추가 랭킹 없음');
  await page.locator('#memory-ranking-reset').click();await page.getByRole('dialog',{name:'이번 주 랭킹 초기화'}).waitFor();await page.getByRole('button',{name:'취소',exact:true}).click();assert.equal(room.memoryRanking.length,1);
  await page.locator('#memory-ranking-reset').click();await page.keyboard.press('Escape');assert.equal(await page.locator('#arcade-dialog').isVisible(),true);assert.equal(room.memoryRanking.length,1);
  await page.locator('#memory-ranking-reset').click();await page.getByRole('button',{name:'초기화하기',exact:true}).click();await page.locator('#memory-ranking').filter({hasText:'아직 이번 주'}).waitFor();assert.deepEqual(game.store.records.get(room.code).memoryRanking,[]);check('게임 안 초기화 확인창·취소/Escape 보존·확인 후 지속 저장');
  room.memoryRanking=[{id:'last-week',playerId:teacher.id,nickname:'선생님',remainingMs:1000,at:weekStartKst()-1}];
  await new Promise((resolve,reject)=>{const end=Date.now()+3000;const timer=setInterval(()=>{if(!room.memoryRanking.length){clearInterval(timer);resolve();}else if(Date.now()>end){clearInterval(timer);reject(Error('weekly expiry timeout'));}},50);});
  assert.deepEqual(game.store.records.get(room.code).memoryRanking,[]);check('짝맞추기 지난주 기록 자동 만료·저장');
  for(const [id,prefix,field] of [['stars','star','starRanking'],['dodge','dodge','dodgeRanking']]){
    game.store.transact(()=>{room[field]=[{id:'fixture-'+id,playerId:teacher.id,nickname:'선생님',elapsedMs:1234,at:Date.now()}];});
    await open(page,teacher,id);await page.locator(`#${prefix}-ranking-reset`).waitFor();
    assert.deepEqual(await page.locator('.arcade-footer button:visible').allTextContents(),['초기화','랭킹 보기','닫기']);
    await page.locator(`#${prefix}-ranking-toggle`).click();await page.locator(`#${prefix}-ranking`).filter({hasText:'1위'}).waitFor();
    await page.locator(`#${prefix}-ranking-reset`).click();await page.getByRole('button',{name:'초기화하기',exact:true}).click();await page.waitForFunction(()=>!document.querySelector('.ranking-reset-confirm').open);
    assert.deepEqual(game.store.records.get(room.code)[field],[]);await page.screenshot({path:`.local/request302-${id}-mobile.png`});
  }
  check('반짝별 찾기·별 피하기 공통 하단 버튼·각 게임 초기화 저장');
  const studentPage=await browser.newPage({viewport:{width:390,height:844}});studentPage.setDefaultTimeout(7000);studentPage.on('pageerror',e=>errors.push(e.message));await studentPage.goto(url+'/?class='+room.code,{waitUntil:'domcontentloaded',timeout:30000});
  await studentPage.locator('#nickname').fill('검사학생');await studentPage.locator('#student-pin').fill('1234');await studentPage.getByRole('button',{name:'우주 교실 입장하기'}).click();await studentPage.locator('#lobby').waitFor({state:'hidden'});await studentPage.locator('#password-offer-no').click();
  const student=[...room.players.values()].find(p=>p.role==='student');
  for(const [id,prefix] of [['memory','memory'],['stars','star'],['dodge','dodge']]){
    await open(studentPage,student,id);await studentPage.locator(`#${prefix}-ranking-toggle`).click();await studentPage.locator(`#${prefix}-ranking-panel`).waitFor();
    assert.equal(await studentPage.locator(`#${prefix}-ranking-reset`).isHidden(),true);assert.deepEqual(await studentPage.locator('.arcade-footer button:visible').allTextContents(),['랭킹 닫기','닫기']);
  }
  check('실제 학생 계정은 세 게임 모두 랭킹만 표시·초기화 숨김');
  const openWeekly=async(screen,p)=>{
    if(await screen.locator('#arcade-dialog').isVisible())await screen.locator('#arcade-close').click();
    const pillar=MAP.objects.find(o=>o.id==='pillar-weekly');Object.assign(p,{mapId:PLAZA_ID,x:pillar.x+65,y:pillar.y});game.io.to(p.socketId).emit('room:state',game.store.snapshot(room,p));
    await screen.locator('#interact-prompt').filter({hasText:pillar.name}).waitFor();await screen.locator('#touch-interact').click();await screen.locator('#temple-title').filter({hasText:pillar.name}).waitFor();
  };
  game.store.transact(()=>{recordReward(room,student.id,7);student.starShards=50;});
  const preserved=structuredClone({planets:room.planets,itemLog:room.itemLog,tradeLog:room.tradeLog});
  await openWeekly(page,teacher);await page.locator('#temple-weekly-reset').waitFor();await page.locator('#temple-content').filter({hasText:'★ 7개'}).waitFor();
  assert.deepEqual(await page.locator('#temple-dialog header button:visible').allTextContents(),['초기화','닫기']);
  await page.locator('#temple-weekly-reset').click();await page.getByRole('dialog',{name:'이번 주 받은 별 초기화'}).waitFor();await page.screenshot({path:'.local/request306-weekly-confirm.png'});
  await page.getByRole('button',{name:'취소',exact:true}).click();assert.match(await page.locator('#temple-content').textContent(),/★ 7개/);
  await page.locator('#temple-weekly-reset').click();await page.getByRole('button',{name:'초기화하기',exact:true}).click();await page.locator('#temple-content').filter({hasText:'★ 0개'}).waitFor();
  assert.equal(student.starShards,50);assert.deepEqual({planets:room.planets,itemLog:room.itemLog,tradeLog:room.tradeLog},preserved);
  const total=game.store.records.get(room.code).temple.weeks[0].totals.find(r=>r.playerId===student.id);assert.deepEqual([total.total,total.resetTotal],[7,7]);
  await page.screenshot({path:'.local/request306-weekly-reset.png'});await openWeekly(studentPage,student);await studentPage.locator('#temple-content').filter({hasText:'★ 0개'}).waitFor();assert.equal(await studentPage.locator('#temple-weekly-reset').isHidden(),true);
  assert.deepEqual(await studentPage.locator('#temple-dialog header button:visible').allTextContents(),['닫기']);await studentPage.locator('#temple-close').click();await page.locator('#temple-close').click();
  check('이번 주 받은 별: 교사 닫기 왼쪽 초기화·확인창·집계만 저장·학생 버튼 숨김');
  await open(page,teacher,'memory');await start('상');await page.locator('#arcade-close').click();
  await new Promise(r=>setTimeout(r,100));assert.equal(room.memoryRuns.size,0);assert.equal(await page.locator('#arcade-board button').count(),0);
  // 하 난이도 60초와 타이머 해제는 verify-memory의 가상 시계 검사에서 확인합니다.
  await open(page,teacher,'memory');await start('하');await page.locator('#arcade-restart').click();
  assert.equal(await page.locator('#arcade-score').textContent(),'난이도를 선택하세요 · 시작 전');assert.equal(await page.locator('.memory-card').count(),0);check('닫기 서버 게임 정리·실제 다시하기 초기 상태 복원');
  assert.deepEqual(errors,[]);
}finally{
  await writeFile('.local/request302-browser-result.json',JSON.stringify({checks,errors},null,2));await browser.close();await game.close();await rm(dir,{recursive:true,force:true});
}
console.log(JSON.stringify({checks:checks.length,errors}));
