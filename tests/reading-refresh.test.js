import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {mkdirSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {chromium} from 'playwright';
import {createReadingRefresh} from '../client/reading-refresh.js';

class FakeEvents {
  listeners = new Map();
  addEventListener(type, listener) {
    if (!this.listeners.has(type)) this.listeners.set(type, new Set());
    this.listeners.get(type).add(listener);
  }
  removeEventListener(type, listener) { this.listeners.get(type)?.delete(listener); }
  fire(type) { for (const listener of this.listeners.get(type) || []) listener(); }
  count(type) { return this.listeners.get(type)?.size || 0; }
}

function clockAt(iso) {
  let time = Date.parse(iso), nextId = 1;
  const timers = new Map();
  return {
    timers,
    now: () => time,
    setTimer(fn, delay) { const id = nextId++; timers.set(id, {fn, at: time + delay}); return id; },
    clearTimer(id) { timers.delete(id); },
    async advance(ms) {
      const target = time + ms;
      while (true) {
        const due = [...timers.entries()].filter(([, timer]) => timer.at <= target).sort((a, b) => a[1].at - b[1].at)[0];
        if (!due) break;
        time = due[1].at; timers.delete(due[0]); due[1].fn();
        await Promise.resolve(); await Promise.resolve();
      }
      time = target; await Promise.resolve(); await Promise.resolve();
    }
  };
}

function fixture(iso, refresh) {
  const clock = clockAt(iso), documentRef = new FakeEvents(), windowRef = new FakeEvents();
  documentRef.visibilityState = 'visible';
  const dialog = {open: true};
  const service = createReadingRefresh({dialog, refresh, now: clock.now, setTimer: clock.setTimer, clearTimer: clock.clearTimer, documentRef, windowRef});
  return {clock, documentRef, windowRef, dialog, service};
}

test('refreshes once at KST midnight and rearms for the following day', async () => {
  const calls = [], f = fixture('2026-10-13T14:59:59.000Z', async () => { calls.push('refresh'); return true; });
  f.service.start();
  assert.equal(f.clock.timers.size, 1);
  await f.clock.advance(999); assert.equal(calls.length, 0);
  await f.clock.advance(1); assert.equal(calls.length, 1);
  assert.equal(f.clock.timers.size, 1);
  f.documentRef.fire('visibilitychange'); f.windowRef.fire('focus');
  await Promise.resolve(); assert.equal(calls.length, 1);
  f.service.stop(); assert.equal(f.clock.timers.size, 0);
});

test('refreshes on visible or focused return after midnight, but not while hidden', async () => {
  const calls = [], f = fixture('2026-10-13T14:59:00.000Z', async () => { calls.push('refresh'); return true; });
  f.service.start(); f.documentRef.visibilityState = 'hidden';
  await f.clock.advance(60_000); assert.equal(calls.length, 0);
  f.documentRef.fire('visibilitychange'); await Promise.resolve(); assert.equal(calls.length, 0);
  f.documentRef.visibilityState = 'visible'; f.documentRef.fire('visibilitychange');
  await Promise.resolve(); await Promise.resolve(); assert.equal(calls.length, 1);
  await f.clock.advance(1000); f.windowRef.fire('focus'); await Promise.resolve(); assert.equal(calls.length, 1);
  f.service.stop();
});

test('keeps checking after a busy refresh and retries when it becomes available', async () => {
  let ready = false, calls = 0;
  const f = fixture('2026-10-13T14:59:00.000Z', async () => { calls++; return ready; });
  f.service.start(); await f.clock.advance(60_000);
  assert.equal(calls, 1); assert.equal(f.clock.timers.size, 2);
  ready = true; await f.clock.advance(1000); assert.equal(calls, 2);
  f.documentRef.fire('visibilitychange'); await Promise.resolve(); assert.equal(calls, 2);
  f.service.stop(); assert.equal(f.clock.timers.size, 0);
});

test('stops midnight timers and ignores pending responses after the dialog closes', async () => {
  let finish, calls = 0;
  const f = fixture('2026-10-13T14:59:59.000Z', () => { calls++; return new Promise(resolve => { finish = resolve; }); });
  f.service.start(); await f.clock.advance(1000); assert.equal(calls, 1);
  f.dialog.open = false; f.service.stop(); finish(true); await Promise.resolve();
  assert.equal(f.clock.timers.size, 0); assert.equal(f.documentRef.count('visibilitychange'), 0); assert.equal(f.windowRef.count('focus'), 0);
  f.documentRef.fire('visibilitychange'); f.windowRef.fire('focus'); assert.equal(calls, 1);
});

test('does not mistake UTC midnight for the KST daily boundary', async () => {
  let calls = 0;
  const f = fixture('2026-10-13T14:30:00.000Z', async () => { calls++; return true; });
  f.service.start(); await f.clock.advance(30 * 60_000); assert.equal(calls, 1);
  f.service.stop();
});

test('actual culture and science dialogs refresh at KST midnight without repeating a science reward', {skip:process.platform!=='win32'}, async t => {
  const root=process.cwd(), files={
    '/client/culture-library.js':'client/culture-library.js',
    '/client/science-library.js':'client/science-library.js',
    '/client/reading-refresh.js':'client/reading-refresh.js',
    '/shared/culture-stories.js':'shared/culture-stories.js',
    '/shared/culture-stories-extra.js':'shared/culture-stories-extra.js',
    '/shared/history-keywords.js':'shared/history-keywords.js',
    '/shared/station-rewards.js':'shared/station-rewards.js',
    '/shared/science-facts.js':'shared/science-facts.js',
    '/shared/science-facts-extra.js':'shared/science-facts-extra.js'
  };
  const server=createServer(async(req,res)=>{
    const pathname=new URL(req.url,'http://localhost').pathname;
    if(pathname==='/'){res.writeHead(200,{'content-type':'text/html; charset=utf-8'}).end('<!doctype html><html lang="ko"><meta charset="utf-8"><title>Reading refresh UI test</title><body></body></html>');return;}
    const file=files[pathname];
    if(!file){res.writeHead(404).end();return;}
    const {readFile}=await import('node:fs/promises');
    res.writeHead(200,{'content-type':'text/javascript; charset=utf-8'});res.end(await readFile(resolve(root,file)));
  });
  await new Promise(resolveListen=>server.listen(0,'127.0.0.1',resolveListen));
  const browser=await chromium.launch({headless:true,channel:'msedge',args:['--no-proxy-server']});
  const page=await browser.newPage();
  await page.clock.install({time:new Date('2026-10-13T14:59:59.000Z')});
  await page.emulateMedia({reducedMotion:'reduce'});
  const events=[];
  await page.exposeFunction('readingRequest',async(event,day)=>{
    events.push(event);
    if(event==='culture:status')return {day,count:day==='2026-10-13'?1:0,limit:10,claimedIds:day==='2026-10-13'?['story-1']:[],reward:1};
    if(event==='science:status')return {day,count:0,remaining:day==='2026-10-13'?50:49,canOpen:true,activeId:null,reward:1};
    if(event==='science:open')return {factId:events.filter(e=>e==='science:open').length===1?'science-01':'science-02',count:1,remaining:49,canOpen:true,activeId:'science-01',reward:1};
    if(event==='science:claim')return {awarded:true,amount:1,count:1,remaining:49,canOpen:true,activeId:null};
    throw new Error(`unexpected request ${event}`);
  });
  t.after(async()=>{await page.close();await browser.close();await new Promise(done=>server.close(done));});
  await page.goto(`http://127.0.0.1:${server.address().port}/`);
  await page.evaluate(async()=>{
    const {createReadingLibrary}=await import('/client/culture-library.js');
    window.culture=createReadingLibrary({request:(event)=>window.readingRequest(event,new Date(Date.now()+9*60*60*1000).toISOString().slice(0,10)),stop(){},getSelf:()=>({role:'student',avatar:{level:1}}),stories:[{id:'story-1',title:'별빛 이야기',category:'과학',paragraphs:['짧은 이야기입니다.'],lesson:'살펴봐요'}]});
    await window.culture.open();
  });
  const cultureProgress=page.locator('#culture-library-dialog .culture-progress');
  await cultureProgress.getByText('오늘의 독서 보상 1 / 10권').waitFor();
  await page.clock.fastForward(1000);
  await cultureProgress.getByText('오늘의 독서 보상 0 / 10권').waitFor();
  const cultureStatusCount=events.filter(e=>e==='culture:status').length;
  assert.equal(cultureStatusCount,2);
  await page.locator('#culture-library-dialog').evaluate(dialog=>dialog.close());
  await page.clock.fastForward(24*60*60*1000);
  assert.equal(events.filter(e=>e==='culture:status').length,cultureStatusCount,'닫힌 교양 창은 다시 조회하지 않아야 해요.');

  await page.evaluate(async()=>{
    const {createScienceLibrary}=await import('/client/science-library.js');
    window.science=createScienceLibrary({request:(event)=>window.readingRequest(event,new Date(Date.now()+9*60*60*1000).toISOString().slice(0,10)),stop(){}});
    await window.science.open();
  });
  const scienceDialog=page.locator('#science-library-dialog');
  await scienceDialog.locator('.science-start').click();
  await scienceDialog.locator('.science-done').waitFor({state:'visible'});
  await scienceDialog.locator('.science-done').click();
  await scienceDialog.locator('.science-next').waitFor({state:'visible'});
  await page.clock.fastForward(24*60*60*1000);
  const scienceProgress=scienceDialog.locator('.culture-progress');
  await scienceProgress.waitFor({state:'visible'});
  assert.match(await scienceProgress.textContent(),/^오늘 0 \/ 2개 · 이번 차례 남은 이야기 49 \/ \d+개$/);
  assert.equal(await scienceDialog.locator('.science-done').isDisabled(),true,'자정 뒤에도 이미 읽은 이야기는 다시 보상할 수 없어야 해요.');
  assert.equal(events.filter(e=>e==='science:claim').length,1);
  await scienceDialog.locator('.science-next').click();
  await scienceDialog.locator('.science-done').waitFor({state:'visible'});
  assert.equal(events.filter(e=>e==='science:claim').length,1,'다음 이야기 보기만으로 보상 요청이 추가되면 안 돼요.');
  await scienceDialog.evaluate(dialog=>dialog.close());
  const scienceStatusCount=events.filter(e=>e==='science:status').length;
  await page.clock.fastForward(24*60*60*1000);
  assert.equal(events.filter(e=>e==='science:status').length,scienceStatusCount,'닫힌 과학 창은 다시 조회하지 않아야 해요.');
  const output=resolve(root,'.local/reading-refresh-ui.json');
  mkdirSync(resolve(root,'.local'),{recursive:true});
  writeFileSync(output,JSON.stringify({result:'passed',checks:['culture KST reset in visible dialog','science read state preserved; next fact available','closed dialogs stop daily refresh'],requestCounts:Object.fromEntries([...new Set(events)].map(event=>[event,events.filter(value=>value===event).length]))},null,2)+'\n');
});
