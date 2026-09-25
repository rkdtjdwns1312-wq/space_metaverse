import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {chromium} from 'playwright';
import {createClassroomServer} from '../server/app.js';
import {fillNewClass} from './class-setup.mjs';
import {STREET,STREET_ID} from '../shared/config.js';
import {generateSudoku} from '../shared/sudoku.js';

const checks=[],errors=[],key='isolated-sudoku-browser-key';
const game=createClassroomServer({teacherKey:key,studentHours:false,craftingRecipes:[]});
let browser,page;
const check=label=>{checks.push(label);console.log(`Sudoku ${checks.length}: ${label}`);};
try{
  await mkdir('.local',{recursive:true});
  const url=`http://127.0.0.1:${(await game.listen()).port}`;
  browser=await chromium.launch({headless:true,...(process.platform==='win32'?{channel:'msedge'}:{})});
  page=await browser.newPage({viewport:{width:1440,height:960}});page.setDefaultTimeout(10000);page.on('pageerror',e=>errors.push(e.message));
  await page.goto(url,{waitUntil:'domcontentloaded'});
  await page.locator('#teacher-tab').click();await page.locator('#teacher-key').fill(key);await fillNewClass(page,['1']);
  await page.locator('#teacher-form .submit').click();await page.locator('#lobby').waitFor({state:'hidden'});
  const room=[...game.store.rooms.values()][0],p=[...room.players.values()][0];
  const machines=STREET.objects.filter(o=>o.kind==='arcade'),machine=machines[3];
  assert.equal(machine.gameId,'sudoku');assert.equal(machines.some(m=>m.gameId==='addition'),false);
  Object.assign(p,{mapId:STREET_ID,x:machine.x,y:machine.y+72});
  game.io.to(p.socketId).emit('room:state',game.store.snapshot(room,p));
  await page.locator('#interact-prompt').filter({hasText:'스도쿠'}).waitFor();
  await page.locator('#world').focus();await page.keyboard.press('f');
  await page.locator('#arcade-title').filter({hasText:'별빛 스도쿠'}).waitFor();
  check('네 번째 기기는 연산게임 대신 별빛 스도쿠를 열며 기존 연산 선택 없음');
  // 생성기는 단위 검사에서 여러 seed를 검증합니다. 화면 검사는 고정 난수로 실제 입력 정답을 재현합니다.
  await page.evaluate(()=>{Math.random=()=>0;});
  const low=generateSudoku('low',()=>0);
  await page.locator('.sudoku-start').click();await page.locator('.sudoku-cell').last().waitFor();
  assert.equal(await page.locator('.sudoku-cell').count(),36);
  const empty=low.puzzle.findIndex(n=>!n),given=low.puzzle.findIndex(n=>n);
  const cell=i=>page.locator(`.sudoku-cell[data-index="${i}"]`);
  await cell(empty).click();await page.locator('.sudoku-key[data-value="1"]').click();
  assert.equal((await cell(empty).innerText()).trim(),'1');
  await cell(empty).focus();await page.keyboard.press('Delete');assert.equal((await cell(empty).innerText()).trim(),'');
  const givenText=(await cell(given).innerText()).trim();
  await cell(given).click({force:true});await page.locator('.sudoku-key[data-value="2"]').click();
  assert.equal((await cell(given).innerText()).trim(),givenText);
  check('하36칸·터치 숫자 입력·키보드 지우기·고정 단서 보존');
  await page.locator('.sudoku-check').click();assert.ok(!/완성|축하/.test(await page.locator('.sudoku-status').innerText()));
  for(let i=0;i<low.puzzle.length;i++)if(!low.puzzle[i]){await cell(i).click();await page.locator(`.sudoku-key[data-value="${low.solution[i]}"]`).click();}
  await page.locator('.sudoku-check').click();
  assert.match(await page.locator('.sudoku-status').innerText(),/완성|축하|정답|성공/);
  check('빈칸이 남으면 완료되지 않고 모든 정답 입력 후 완료');
  for(const [difficulty,size] of [['medium',9],['high',12]]){
    await page.locator(`[data-difficulty="${difficulty}"]`).click();await page.locator('.sudoku-start').click();
    await page.waitForFunction(n=>document.querySelectorAll('.sudoku-cell').length===n,size*size);
    const board=generateSudoku(difficulty,()=>0),index=board.puzzle.findIndex(n=>!n);
    await cell(index).click();await page.keyboard.press(difficulty==='high'?'c':'9');
    assert.equal((await cell(index).innerText()).trim(),difficulty==='high'?'12':'9');
    await page.setViewportSize({width:390,height:844});await page.screenshot({path:`.local/199-sudoku-${difficulty}.png`});
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
    const grid=await page.locator('.sudoku-grid').boundingBox();assert.ok(grid.width<=366);
    check(`${difficulty}: ${size}×${size} 칸·키보드 입력·390px 가로 넘침 없음`);
  }
  await page.locator('#arcade-close').click();await page.locator('#arcade-dialog').waitFor({state:'hidden'});
  assert.equal(await page.locator('.sudoku-game').count(),0);
  await page.locator('#world').focus();await page.keyboard.press('f');
  await page.locator('.sudoku-start').waitFor();assert.equal(await page.locator('.sudoku-cell').count(),0);
  await page.locator('#arcade-close').click();assert.deepEqual(errors,[]);
  check('닫기 시 게임과 이벤트 정리·다시 열면 준비 화면·브라우저 오류0');
  await writeFile('.local/199-sudoku-browser.json',JSON.stringify({checks,errors},null,2));
}catch(error){await page?.screenshot({path:'.local/199-sudoku-failure.png'}).catch(()=>{});throw error;}
finally{await browser?.close();await game.close();}
