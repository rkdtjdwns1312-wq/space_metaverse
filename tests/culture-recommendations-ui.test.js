import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {chromium} from 'playwright';

test('actual culture reader supports recommendation sort, consonant filter, vote/cancel; history has no recommendation controls',async t=>{
  const root=process.cwd(),files={
    '/client/culture-library.js':'client/culture-library.js','/client/history-library.js':'client/history-library.js',
    '/client/reading-refresh.js':'client/reading-refresh.js','/client/culture-library.css':'client/culture-library.css',
    '/shared/station-rewards.js':'shared/station-rewards.js','/shared/culture-stories.js':'shared/culture-stories.js','/shared/culture-stories-extra.js':'shared/culture-stories-extra.js','/shared/culture-stories-more.js':'shared/culture-stories-more.js','/shared/history-lessons.js':'shared/history-lessons.js',
    '/shared/history-keywords.js':'shared/history-keywords.js'
  };
  const server=createServer(async(req,res)=>{
    const url=new URL(req.url,'http://localhost');
    if(url.pathname==='/'){res.writeHead(200,{'content-type':'text/html; charset=utf-8'}).end('<!doctype html><html lang="ko"><meta charset="utf-8"><link rel="stylesheet" href="/client/culture-library.css"><body></body></html>');return;}
    const file=files[url.pathname];if(!file){res.writeHead(404).end();return;}
    res.writeHead(200,{'content-type':url.pathname.endsWith('.css')?'text/css':'text/javascript'}).end(await readFile(resolve(root,file)));
  });
  await new Promise(resolveListen=>server.listen(0,'127.0.0.1',resolveListen));
  const browser=await chromium.launch({headless:true,channel:'msedge',args:['--no-proxy-server']}),page=await browser.newPage();
  const voted=new Set(),events=[];let counts={b:1,c:1},deferNextVote=false,deferredVoteResolve=null;const books=[{id:'a',title:'가을 별',category:'이야기',paragraphs:['첫 문장입니다.'],lesson:'함께 생각해요'},
    {id:'b',title:'나무 그늘',category:'이야기',paragraphs:['나무 아래입니다.'],lesson:'함께 생각해요'},
    {id:'c',title:'다람쥐 우체국',category:'이야기',paragraphs:['도토리를 전해요.'],lesson:'함께 생각해요'}];
  await page.exposeFunction('recommendationRequest',async(event,{storyId}={})=>{
    events.push([event,storyId]);const result={count:0,limit:10,reward:1,claimedIds:[],recommendationCounts:{...counts},recommendedIds:[...voted]};
    if(event==='culture:recommend'&&deferNextVote){deferNextVote=false;return new Promise(resolve=>{deferredVoteResolve=()=>resolve({...result,recommendationCounts:{b:99,c:0},recommendedIds:['b']});});}
    if(event==='culture:recommend'){if(voted.has(storyId)){voted.delete(storyId);counts[storyId]--;}else{voted.add(storyId);counts[storyId]++;}result.recommendationCounts={...counts};result.recommendedIds=[...voted];}
    return result;
  });
  t.after(async()=>{await page.close();await browser.close();await new Promise(done=>server.close(done));});
  await page.goto(`http://127.0.0.1:${server.address().port}/`);
  await page.evaluate(async books=>{const {createReadingLibrary}=await import('/client/culture-library.js');window.culture=createReadingLibrary({request:window.recommendationRequest,stop(){},getSelf:()=>({role:'student',avatar:{level:1}}),stories:books});await window.culture.open();},books);
  const dialog=page.locator('#culture-library-dialog'),list=dialog.locator('.culture-titles');
  const titles=()=>list.locator('.culture-title span').allTextContents();
  assert.deepEqual(await titles(),['가을 별','나무 그늘','다람쥐 우체국']);
  await dialog.getByRole('button',{name:'추천순'}).click();assert.deepEqual(await titles(),['나무 그늘','다람쥐 우체국','가을 별']);
  await dialog.locator('.culture-tabs button',{hasText:'ㄴ'}).click();assert.deepEqual(await titles(),['나무 그늘']);
  await dialog.locator('.culture-tabs button',{hasText:'전체'}).click();await list.locator('[data-story-id="b"]').click();
  const recommend=dialog.locator('.culture-recommend');await recommend.waitFor();assert.equal(await recommend.textContent(),'추천해요 · 1');
  await recommend.click();assert.equal(await recommend.textContent(),'내 추천 취소 · 2');assert.equal(await recommend.getAttribute('aria-pressed'),'true');
  await dialog.locator('.culture-back').click();assert.equal(await list.locator('[data-story-id="b"] .culture-vote-count').textContent(),'추천 2 · 내 추천');
  await list.locator('[data-story-id="b"]').click();const cancel=dialog.locator('.culture-recommend');await cancel.waitFor();assert.equal(await cancel.textContent(),'내 추천 취소 · 2');
  await cancel.click();assert.equal(await cancel.textContent(),'추천해요 · 1');assert.equal(events.filter(e=>e[0]==='culture:recommend').length,2);
  await dialog.locator('.culture-back').click();
  counts={b:0,c:3};deferNextVote=true;await list.locator('[data-story-id="b"]').click();await dialog.locator('.culture-recommend').click();
  for(let i=0;i<30&&!deferredVoteResolve;i++)await page.waitForTimeout(10);assert.equal(typeof deferredVoteResolve,'function');
  await dialog.evaluate(element=>element.close());await page.waitForTimeout(0);await page.evaluate(()=>window.culture.open());
  deferredVoteResolve();deferredVoteResolve=null;await page.waitForTimeout(20);
  await dialog.getByRole('button',{name:'추천순'}).click();assert.deepEqual(await titles(),['다람쥐 우체국','가을 별','나무 그늘']);
  await dialog.evaluate(element=>element.close());
  await page.evaluate(async()=>{const {createHistoryLibrary}=await import('/client/history-library.js');window.historyLibrary=createHistoryLibrary({request:async event=>({count:0,limit:10,reward:1,claimedIds:[]}),stop(){},getSelf:()=>({role:'student',avatar:{level:1}})});await window.historyLibrary.open();});
  const history=page.locator('#history-library-dialog');assert.equal(await history.locator('.culture-sort-button').count(),0);assert.equal(await history.locator('.culture-recommend').count(),0);
});
