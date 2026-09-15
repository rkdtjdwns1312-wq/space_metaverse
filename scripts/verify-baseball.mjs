import assert from 'node:assert/strict';
import http from 'node:http';
import {readFile} from 'node:fs/promises';
import {extname,join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {chromium} from 'playwright';
import {generateBaseballAnswer,scoreBaseballQuestion} from '../shared/baseball.js';

const root=fileURLToPath(new URL('..',import.meta.url));
const html=`<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><link rel="stylesheet" href="/client/arcade.css"><style>body{margin:0}#arcade-dialog{position:relative;display:block;margin:12px auto}#arcade-board{display:block}</style></head><body><main id="arcade-dialog"><p id="arcade-score" aria-live="polite"></p><div id="arcade-board"></div></main><script type="module">import {createBaseballGame} from '/client/baseball-game.js';const board=document.querySelector('#arcade-board'),score=document.querySelector('#arcade-score');window.toasts=[];window.baseball=createBaseballGame({board,setScore:text=>score.textContent=text,toast:text=>window.toasts.push(text)});</script></body></html>`;
const types={'.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8'};
const server=http.createServer(async(request,response)=>{
  if(request.url==='/'){response.writeHead(200,{'content-type':'text/html; charset=utf-8'});response.end(html);return;}
  try{const path=join(root,decodeURIComponent(request.url.slice(1)));const body=await readFile(path);response.writeHead(200,{'content-type':types[extname(path)]??'application/octet-stream'});response.end(body);}catch{response.writeHead(404);response.end();}
});
await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve);});

let randomCalls=0;const answer5=generateBaseballAnswer(5,()=>{randomCalls++;return 0;});
assert.equal(randomCalls,9);assert.equal(answer5.length,5);assert.notEqual(answer5[0],'0');assert.equal(new Set(answer5).size,5);

const answer=generateBaseballAnswer(3,()=>0);
const makeWrong=value=>{const chars=[...value];const swap=chars[1]==='0'?2:1;[chars[0],chars[swap]]=[chars[swap],chars[0]];return chars.join('');};
const wrong=makeWrong(answer),questionScore=scoreBaseballQuestion(answer,wrong);
assert.notEqual(wrong,answer);assert.notEqual(wrong[0],'0');

const browser=await chromium.launch({headless:true,...(process.platform==='win32'?{channel:'msedge'}:{})});
const context=await browser.newContext({viewport:{width:390,height:844}});context.setDefaultTimeout(5000);
const page=await context.newPage(),errors=[],checks=['유한 셔플 답 생성: 호출 9회, 중복 없음, 첫 숫자 0 아님'];
console.log(`Baseball 1: ${checks[0]}`);page.on('pageerror',error=>errors.push(error.message));
const check=message=>{checks.push(message);console.log(`Baseball ${checks.length}: ${message}`);};
const choose=name=>page.getByRole('button',{name}).click();
const submit=async(value,button)=>{await page.locator('#baseball-input').fill(value);await page.getByRole('button',{name:button}).click();};

try{
  await page.addInitScript(()=>{Math.random=()=>0;});
  await page.goto(`http://127.0.0.1:${server.address().port}/`,{waitUntil:'domcontentloaded',timeout:15000});await page.waitForFunction(()=>window.baseball);

  const levels=page.locator('.baseball-level');assert.equal(await levels.count(),3);assert.deepEqual(await levels.evaluateAll(items=>items.map(item=>item.textContent)),['하 (3자리)','중 (4자리)','상 (5자리)']);
  await choose('하 (3자리)');assert.equal(await page.locator('.baseball-level[aria-pressed="true"]').count(),1);assert.equal(await page.locator('#baseball-input').getAttribute('maxlength'),'3');check('하 3자리·중 4자리·상 5자리와 명확한 난이도 선택');

  const scoreBefore=await page.locator('#arcade-score').textContent();
  for(const invalid of ['12','012','112'])await submit(invalid,'숫자 질문하기');
  assert.equal(await page.locator('#arcade-score').textContent(),scoreBefore);assert.equal(await page.locator('#baseball-attempts li').count(),0);check('자리 수·첫 0·중복 입력은 기회 차감 없음');

  await submit(wrong,'숫자 질문하기');
  await page.locator('#baseball-attempts li').filter({hasText:`질문 · ${questionScore.strikes}S ${questionScore.balls}B · 남은 기회 19회`}).waitFor();
  assert.match(await page.locator('#arcade-score').textContent(),/1\/20회 · 남은 기회 19회/);check('숫자 질문은 정확한 S/B와 남은 기회 즉시 표시');

  await submit(wrong,'정답 맞추기');await page.locator('#baseball-attempts li').last().filter({hasText:'정답 도전 · 오답 · 남은 기회 18회'}).waitFor();
  assert.equal(await page.locator('#baseball-input').isDisabled(),false);check('정답 맞추기 오답 기록과 질문·정답 합산 차감');

  await choose('중 (4자리)');assert.equal(await page.locator('#baseball-attempts li').count(),0);assert.match(await page.locator('#arcade-score').textContent(),/0\/20회 · 남은 기회 20회/);assert.equal(await page.locator('#baseball-input').inputValue(),'');check('난이도 변경 시 이전 기록·입력·점수 완전 초기화');

  await choose('하 (3자리)');
  for(let count=0;count<19;count++)await submit(answer,'숫자 질문하기');
  assert.equal(await page.locator('#baseball-input').isDisabled(),false);assert.equal(await page.locator('#baseball-attempts li').count(),19);
  await submit(answer,'정답 맞추기');await page.locator('#arcade-score').filter({hasText:new RegExp(`^성공 · 20/20회 · 남은 기회 0회 · 정답 ${answer}$`)}).waitFor();
  assert.equal(await page.locator('#baseball-input').isDisabled(),true);check('질문과 합쳐 20번째 정답 도전도 성공 처리');

  await choose('하 (3자리)');
  for(let count=0;count<10;count++)await submit(wrong,'숫자 질문하기');
  for(let count=0;count<10;count++)await submit(wrong,'정답 맞추기');
  await page.locator('#arcade-score').filter({hasText:new RegExp(`^종료 · 20/20회 · 남은 기회 0회 · 정답 ${answer}$`)}).waitFor();
  assert.equal(await page.locator('#baseball-attempts li').count(),20);assert.equal(await page.locator('#baseball-input').isDisabled(),true);assert.match(await page.locator('.baseball-feedback').textContent(),new RegExp(`정답은 ${answer}입니다`));check('20번째 오답 종료·정답 공개·20개 시도 목록 보존');

  assert.deepEqual(errors,[]);assert.equal(checks.length,8);console.log(`verify-baseball: ${checks.length}개 통과, errors=[]`);
}finally{
  await browser.close();await new Promise(resolve=>server.close(resolve));
}
