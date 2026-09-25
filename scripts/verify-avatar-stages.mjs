// 실제 교실 저장소와 분리한 서버에서 진화·두 브라우저·이동·레벨별 그림을 검증합니다.
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';
import { createClassroomServer } from '../server/app.js';
import { fillNewClass } from './class-setup.mjs';
import { VALLEY, VALLEY_ID, RULES } from '../shared/config.js';
import { CONSTELLATIONS } from '../shared/constellations.js';

const game = createClassroomServer({teacherKey:'stages-browser-private-key', studentHours:false});
const address = await game.listen(), url = `http://127.0.0.1:${address.port}`;
const browser = await chromium.launch({headless:true,...(process.platform==='win32'?{channel:'msedge'}:{})});
const checks=[], errors=[];
const check = name => { checks.push(name); console.log(name); };
await mkdir('.local',{recursive:true});
try {
  const teacher=await browser.newPage();
  await teacher.goto(url);
  await teacher.locator('#teacher-tab').click();
  await teacher.locator('#teacher-key').fill('stages-browser-private-key');
  await fillNewClass(teacher,['1','2']);
  await teacher.locator('#teacher-form .submit').click();
  await teacher.locator('#lobby').waitFor({state:'hidden'});
  const room=[...game.store.rooms.values()][0];
  const pages=[];
  for (const nickname of ['1','2']) {
    const page=await browser.newPage({viewport:{width:1280,height:900}});
    page.setDefaultTimeout(15000);
    page.on('pageerror',e=>errors.push(e.message));
    // 앱의 캔버스가 실제 사용한 파일과 그리기 위치를 관찰합니다.
    await page.addInitScript(()=>{
      window.avatarDraws={};
      const original=CanvasRenderingContext2D.prototype.drawImage;
      CanvasRenderingContext2D.prototype.drawImage=function(image,...args){
        if(this.canvas.id==='world' && image?.src?.includes('/assets/avatars/'))
          window.avatarDraws[new URL(image.src).pathname]={args,x:this.getTransform().e,y:this.getTransform().f,at:performance.now()};
        return original.call(this,image,...args);
      };
    });
    await page.goto(url);
    await page.locator('#join-code').fill(room.code);
    await page.locator('#nickname').fill(nickname);
    await page.locator('#student-pin').fill('1234');
    await page.locator('#student-form .submit').click();
    await page.locator('#lobby').waitFor({state:'hidden'});
    pages.push(page);
  }
  const [student,friend]=pages;
  const player=[...room.players.values()].find(p=>p.nickname==='1');
  const observer=[...room.players.values()].find(p=>p.nickname==='2');
  const star=VALLEY.objects.find(o=>o.id==='evolution-star');
  const approachX=star.x+star.radius+RULES.radius+10;
  const publish=()=>{for(const p of room.players.values())game.io.to(p.socketId).emit('room:state',game.store.snapshot(room,p));};
  Object.assign(player,{mapId:VALLEY_ID,x:approachX,y:star.y});
  Object.assign(observer,{mapId:VALLEY_ID,x:approachX+100,y:star.y+100});
  Object.assign(player.avatar,{form:'constellation',constellationId:'aquarius',level:2,xp:20});
  publish();
  for (const level of [3,4]) {
    if(level===4){player.avatar.xp=25;publish();}
    await student.locator('#interact-object').filter({hasText:'진화의 별'}).waitFor();
    await student.locator('#touch-interact').click();
    await student.locator('#evolution-evolve').click();
    await student.locator('#evolution-yes').click();
    await student.locator('#evolution-summary').filter({hasText:`LV${level}`}).waitFor();
    assert.equal(player.avatar.level,level);assert.equal(player.avatar.xp,0);
    await student.locator('#evolution-header-close').click();
    const sprite=`/assets/avatars/lv${level}/aquarius.png`;
    for (const page of pages) await page.waitForFunction(path=>Boolean(window.avatarDraws[path]),sprite);
    check(`Lv${level} 수동 진화·XP0·내 화면과 친구 화면의 새 2D 그림`);
    await student.locator('#avatar-dialog').evaluate(d=>d.showModal());
    await student.locator('#self-form-name').filter({hasText:CONSTELLATIONS.find(c=>c.id==='aquarius').name}).waitFor();
    await student.locator('#self-skill-panel').waitFor({state:'visible'});
    assert.equal(await student.locator('#self-skill-title').textContent(),'별자리 스킬');
    assert.equal(await student.locator('#self-skill-slots .skill-placeholder').count(),4);
    check(`Lv${level} 내정보 별자리 이름·별자리 스킬 제목·빈칸 4개`);
    await student.screenshot({path:`.local/avatar-stages-lv${level}.png`});
    await student.evaluate(()=>document.querySelectorAll('dialog[open]').forEach(d=>d.close()));
    check(`Lv${level} 내정보 별자리 표기`);
  }
  const oldX=player.x;
  const oldDrawX=await friend.evaluate(()=>window.avatarDraws['/assets/avatars/lv4/aquarius.png'].x);
  await student.locator('#world').focus();
  await student.keyboard.down('ArrowRight');
  await new Promise(resolve=>setTimeout(resolve,700));
  await student.keyboard.up('ArrowRight');
  assert.ok(player.x>oldX+20,'키보드 이동이 서버 좌표를 변경해야 함');
  await friend.waitForFunction(old=>Math.abs(window.avatarDraws['/assets/avatars/lv4/aquarius.png'].x-old)>10,oldDrawX);
  check('Lv4 방향키 이동·친구 화면의 실시간 캐릭터 그리기');
  Object.assign(player,{x:approachX,y:star.y});publish();
  await student.setViewportSize({width:390,height:844});
  await student.locator('#interact-object').filter({hasText:'진화의 별'}).waitFor();
  await student.locator('#touch-interact').click();
  await student.locator('#evolution-change').click();
  await student.locator('#evolution-grid .constellation-choice').first().waitFor();
  assert.equal(await student.locator('#evolution-grid .constellation-choice').count(),16);
  assert.equal(await student.locator('#evolution-grid').evaluate(e=>getComputedStyle(e).gridTemplateColumns.split(' ').length),4);
  assert.ok(await student.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  await student.screenshot({path:'.local/avatar-stages-mobile.png'});
  check('Lv4 16종 변경 선택·390px 4열·가로 넘침 없음');
  const gallery=await browser.newPage({viewport:{width:1280,height:1100},bypassCSP:true});
  await gallery.goto(url);
  await gallery.setContent(`<style>body{background:#eee8ff;font:18px sans-serif}main{display:grid;grid-template-columns:repeat(8,1fr);gap:10px}figure{margin:0;text-align:center;background:#fff9;border-radius:16px}img{width:140px;height:200px;object-fit:contain}</style><h1>Lv3 · Lv4 2D 캐릭터</h1><main>${[3,4].flatMap(l=>CONSTELLATIONS.map(c=>`<figure><img src="${url}/assets/avatars/lv${l}/${c.id}.png"><figcaption>Lv${l} ${c.name}</figcaption></figure>`)).join('')}</main>`);
  await gallery.waitForFunction(()=>[...document.images].every(i=>i.complete&&i.naturalWidth>0));
  await gallery.screenshot({path:'.local/avatar-stages-gallery.png',fullPage:true});
  check('Lv3·Lv4 32종 전체 PNG 브라우저 디코딩·시각 검수용 갤러리');
  assert.deepEqual(errors,[]);
} finally {
  await writeFile('.local/avatar-stages-result.json',JSON.stringify({checks,errors},null,2));
  await browser.close();await game.close();
}
console.log(JSON.stringify({count:checks.length,errors}));
