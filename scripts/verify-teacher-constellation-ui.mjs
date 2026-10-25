import test from 'node:test';
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {createClassroomServer} from '../server/app.js';
import {fillNewClass} from './class-setup.mjs';

test('teacher constellation menu groups the three views and updates its review badge',async()=>{
  const game=createClassroomServer({teacherKey:'constellation-ui-test-isolated',studentHours:false});
  const {port}=await game.listen();
  let browser;
  try{
    browser=await chromium.launch({headless:true,args:['--no-proxy-server'],...(process.platform==='win32'?{channel:'msedge'}:{})});
    const page=await browser.newPage({viewport:{width:390,height:850}});
    const errors=[];page.on('pageerror',error=>errors.push(error.message));
    await page.goto(`http://127.0.0.1:${port}`,{waitUntil:'domcontentloaded'});
    await page.locator('#teacher-tab').click();
    await page.locator('#teacher-key').fill('constellation-ui-test-isolated');
    await fillNewClass(page,['하늘']);
    await page.locator('#teacher-form .submit').click();
    await page.locator('#lobby').waitFor({state:'hidden'});
    await page.locator('#dock-menu').click();
    await page.locator('#teacher-tools').click();

    const group=page.locator('#teacher-constellation');
    const parent=group.locator(':scope > h3 > button');
    const badge=page.locator('#teacher-constellation-new');
    assert.equal(await parent.getAttribute('aria-label'),'별자리캐릭터 확인');
    assert.equal(await parent.getAttribute('aria-expanded'),'false');
    assert.equal(await badge.isVisible(),false);
    assert.equal(await group.locator(':scope > .teacher-tool-content > section').count(),3);
    await parent.click();
    assert.equal(await parent.getAttribute('aria-expanded'),'true');
    for(const label of ['물고기자리 짝 자리 확인','백조자리 캠페인 푯말 승인','왕관자리 Lv5 자리·급식 우선권']){
      const button=group.getByRole('button',{name:label,exact:true});
      assert.equal(await button.isVisible(),true);
      await button.click();
      assert.equal(await button.getAttribute('aria-expanded'),'true');
    }

    const room=[...game.store.rooms.values()][0];
    const teacher=[...room.players.values()].find(player=>player.role==='teacher');
    const snapshot=game.store.snapshot(room,teacher);
    const send=requests=>game.io.to(teacher.socketId).emit('room:state',{...snapshot,campaignRequests:requests});
    send([{playerId:'pending',nickname:'학생',text:'우리 반 약속'}]);
    await badge.waitFor({state:'visible'});
    assert.equal(await badge.textContent(),'new');
    assert.equal(await parent.getAttribute('aria-label'),'별자리캐릭터 확인, 새 검토 요청');
    send([]);
    await badge.waitFor({state:'hidden'});
    assert.equal(await parent.getAttribute('aria-label'),'별자리캐릭터 확인');
    assert.deepEqual(errors,[]);
  }finally{
    await browser?.close();
    await game.close();
  }
});
