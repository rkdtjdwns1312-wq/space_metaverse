import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {createClassroomServer} from '../server/app.js';
const game=createClassroomServer({teacherKey:'isolated-art-retry',studentHours:false});
const {port}=await game.listen();
const browser=await chromium.launch({headless:true,channel:'msedge'});
try{
 const page=await browser.newPage();
 await page.route(`http://127.0.0.1:${port}/`,route=>route.fulfill({contentType:'text/html',body:'<!doctype html><body></body>'}));
 await page.goto(`http://127.0.0.1:${port}/`);
 await page.evaluate(async()=>{
  const {createArtStudioUI}=await import('/art-studio-ui.js');
  let saved=null,failOnce=true;
  window.artRetryUI=createArtStudioUI({stop(){},getPlayer:()=>({id:'student',role:'student'}),request:async(event,data)=>{
   if(event==='art:list')return {ownerId:'student',roster:[],works:[]};
   if(event==='art:save'){
    if(!data.id&&saved)return {work:structuredClone(saved),replayed:true};
    saved={...structuredClone(data),id:'saved-work',revision:saved?saved.revision+1:1,createdAt:1,updatedAt:2};
    window.savedRetryArt=saved;
    if(failOnce){failOnce=false;throw Error('simulated lost ACK');}
    return {work:structuredClone(saved)};
   }
  }});
  await window.artRetryUI.open();
 });
 await page.locator('[data-art-tab=mine]').click();
 const title=page.locator('[data-art=title]'),save=page.locator('[data-art=save]');
 await title.fill('원래 작품');await save.click();
 await page.locator('[data-art=status]').filter({hasText:'simulated lost ACK'}).waitFor();
 await title.fill('수정한 작품');await page.locator('[data-art=canvas]').click({position:{x:100,y:100}});
 await save.click();await page.locator('[data-art=status]').filter({hasText:'그 뒤에 고친 그림은 그대로'}).waitFor();
 assert.equal(await title.inputValue(),'수정한 작품');
 assert.equal(await page.locator('[data-art=capacity]').textContent(),'아직 저장하지 않았어요');
 assert.equal(await page.evaluate(()=>window.savedRetryArt.drawing.strokes.length),0);
 await save.click();await page.locator('[data-art=status]').filter({hasText:'작품을 저장했어요.'}).waitFor();
 const stored=await page.evaluate(()=>window.savedRetryArt);
 assert.equal(stored.title,'수정한 작품');assert.equal(stored.drawing.strokes.length,1);assert.equal(stored.revision,2);
 console.log('PASS art lost-ACK retry retains newer title and strokes, then saves existing work without duplication');
}finally{await browser.close();await game.close();}
