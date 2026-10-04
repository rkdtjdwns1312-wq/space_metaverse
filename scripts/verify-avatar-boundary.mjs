import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {chromium} from 'playwright';
import {createClassroomServer} from '../server/app.js';
import {fillNewClass} from './class-setup.mjs';
import {STREET,STREET_ID,STATIC_MAPS} from '../shared/config.js';
import {avatarFitsFloor,avatarFloorRadius} from '../shared/avatar-boundary.js';
import {monsterVisualScale} from '../shared/monsters.js';

const game=createClassroomServer({teacherKey:'boundary-test-private-key',studentHours:false});
const url='http://127.0.0.1:'+(await game.listen()).port;
const browser=await chromium.launch({headless:true,args:['--no-proxy-server'],...(process.platform==='win32'?{channel:'msedge'}:{})});
const errors=[],checks=[];await mkdir('.local',{recursive:true});
try{
  const teacher=await browser.newPage();await teacher.goto(url);await teacher.locator('#teacher-tab').click();await teacher.locator('#teacher-key').fill('boundary-test-private-key');await fillNewClass(teacher,['경계검사']);await teacher.locator('#teacher-form .submit').click();await teacher.locator('#lobby').waitFor({state:'hidden'});
  const room=[...game.store.rooms.values()][0],page=await browser.newPage({viewport:{width:1440,height:960}});page.on('pageerror',e=>errors.push(e.message));
  await page.goto(url);await page.locator('#join-code').fill(room.code);await page.locator('#nickname').fill('경계검사');await page.locator('#student-pin').fill('1234');await page.locator('#student-form .submit').click();await page.locator('#lobby').waitFor({state:'hidden'});
  if(await page.locator('#tutorial-dialog').evaluate(dialog=>dialog.open))await page.locator('#tutorial-later').click();
  const p=[...room.players.values()].find(p=>p.role==='student');
  const publish=()=>game.io.to(p.socketId).emit('room:state',game.store.snapshot(room,p));
  for(let level=1;level<=5;level++){
    Object.assign(p.avatar,{level,constellationId:level>1?'aquarius':null});Object.assign(p,{mapId:STREET_ID,x:900,y:1780,input:{x:0,y:0,at:0}});publish();
    await page.waitForFunction(()=>document.querySelector('#minimap').dataset.mapId==='star-street');await page.locator('#world').focus();
    await page.keyboard.down('s');await page.waitForTimeout(700);await page.keyboard.up('s');await page.waitForTimeout(200);
    assert.ok(avatarFitsFloor(STREET,p.x,p.y,p),'LV'+level+' body remains inside floor');assert.ok(p.y>1780,'actually moved');
    const rendered=await page.locator('#world').evaluate(c=>({x:Number(c.dataset.selfRenderX),y:Number(c.dataset.selfRenderY)}));
    assert.ok(avatarFitsFloor(STREET,rendered.x,rendered.y,p),'interpolated body inside floor');
    assert.ok(p.y+avatarFloorRadius(p)<1880,'body bottom stays above lower edge');
    checks.push('LV'+level+' 실제 S 이동·서버/렌더 하단 경계');
  }
  await page.screenshot({path:'.local/281-lv5-floor-edge.png'});
  for(const [id,typeId,count] of [['star-origin-1','star-crab',5],['star-origin-3','star-dragon',5],['sun-paradise','warm-star',5],['sun-paradise-2','grown-warm-star',5],['moon-paradise-1','cool-star',5],['moon-paradise-2','grown-cool-star',5],['moon-paradise-3','noksera',1],['sun-paradise-3','leoon',1]]){
    const map=STATIC_MAPS[id];Object.assign(p,{mapId:id,x:map.width/2+120,y:map.height/2+80,input:{x:0,y:0,at:0}});publish();
    await page.waitForFunction(id=>document.querySelector('#minimap').dataset.mapId===id,id);
    await page.waitForFunction(scale=>Math.abs(Number(document.querySelector('#world').dataset.monsterVisualScale)-scale)<1e-6,monsterVisualScale(id,typeId));
    assert.equal(await page.locator('#world').getAttribute('data-monster-count'),String(count));
    await page.waitForTimeout(400);await page.screenshot({path:'.local/282-'+id+'.png'});checks.push(id+' 몬스터'+count+'마리 시각 배율 반영');
  }
  // 같은 지면과 반경으로 두 LV2 원화를 비교합니다. 몸체 면적은 같고 원화 비율은 보존됩니다.
  await page.evaluate(async()=>{
    const [{drawSunMonster},{drawCelestialMonster},{monsterVisualScale}]=await Promise.all([import('/sun-monster-art.js'),import('/celestial-monster-art.js'),import('/shared/monsters.js')]);
    const c=document.createElement('canvas');c.id='size-comparison';c.width=700;c.height=440;c.style='position:fixed;top:0;left:0;z-index:99999;background:#e7e4fa';document.body.append(c);
    const ctx=c.getContext('2d');const warm={shape:'warm-star',x:210,y:230,radius:96*monsterVisualScale('sun-paradise','warm-star')},cool={shape:'cool-star',x:490,y:230,radius:96};
    drawSunMonster(ctx,warm,0);drawCelestialMonster(ctx,cool,0);
    await new Promise(resolve=>setTimeout(resolve,300));ctx.clearRect(0,0,700,440);drawSunMonster(ctx,warm,0);drawCelestialMonster(ctx,cool,0);
    ctx.fillStyle='#5e457d';ctx.font='18px sans-serif';ctx.textAlign='center';ctx.fillText('LV3 따뜻한별',210,410);ctx.fillText('LV3 서늘한별',490,410);
  });
  await page.locator('#size-comparison').screenshot({path:'.local/284-monster-size-comparison.png'});
  assert.deepEqual(errors,[]);await writeFile('.local/281-avatar-boundary-result.json',JSON.stringify({checks,errors},null,2));console.log(JSON.stringify({checks,errors}));
}finally{await browser.close();await game.close();}
