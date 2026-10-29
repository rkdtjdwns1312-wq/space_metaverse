import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {chromium} from 'playwright';
import {createClassroomServer} from '../server/app.js';
import {fillNewClass} from './class-setup.mjs';
import {SLEEPING_STARS_MAPS,STREET,STATIC_MAPS,UNIVERSE_MAP_LAYOUT,BLACK_HOLE} from '../shared/config.js';
import {monstersOf} from '../server/monsters.js';
import {beginSerenaSkill} from '../server/serena-skills.js';
import {ensureVitals} from '../server/vitals.js';
import {SERENA} from '../shared/serena.js';

const out='.local/sleeping-stars-serena',key='isolated-night-map-browser',errors=[];
const game=createClassroomServer({teacherKey:key,studentHours:false});let browser;
await mkdir(out,{recursive:true});
try{
  const {port}=await game.listen(),url='http://127.0.0.1:'+port;
  browser=await chromium.launch({headless:true,...(process.platform==='win32'?{channel:'msedge'}:{}),args:['--no-proxy-server']});
  const page=await browser.newPage({viewport:{width:1280,height:900}});page.on('pageerror',error=>errors.push(error.message));
  await page.goto(url);await page.locator('#teacher-tab').click();await page.locator('#teacher-key').fill(key);
  await fillNewClass(page,['밤길검사']);await page.locator('#teacher-form .submit').click();await page.locator('#lobby').waitFor({state:'hidden'});
  const room=[...game.store.rooms.values()][0],teacher=[...room.players.values()].find(player=>player.role==='teacher');
  const publish=player=>game.io.to(player.socketId).emit('room:state',game.store.snapshot(room,player));
  const move=async(mapId,position)=>{
    Object.assign(teacher,{mapId,...(position||STATIC_MAPS[mapId].spawn),input:{x:0,y:0,at:0}});publish(teacher);
    await page.waitForFunction(id=>document.getElementById('minimap').dataset.mapId===id,mapId);
    await page.evaluate(async id=>{const {STATIC_MAPS}=await import('/shared/config.js'),{prepareMapArt}=await import('/map-art-ready.js');const state=prepareMapArt(STATIC_MAPS[id]);await state.promise;if(state.status!=='ready')throw Error('art failed '+id);},mapId);
  };
  const north=STREET.objects.find(object=>object.id==='gate-sleeping-stars');
  await move(STREET.id,{x:north.x,y:north.y+55});await page.locator('#interact-prompt').filter({hasText:'별들이 잠드는 곳 1'}).waitFor();
  await page.screenshot({path:out+'/shelter-north-gate.png'});
  await page.locator('#world').focus();await page.keyboard.press('f');await page.waitForFunction(id=>document.getElementById('minimap').dataset.mapId===id,SLEEPING_STARS_MAPS[0].id);
  assert.equal(teacher.mapId,SLEEPING_STARS_MAPS[0].id);
  for(const map of SLEEPING_STARS_MAPS){
    await move(map.id,{x:map.width/2,y:map.height/2});
    await page.waitForTimeout(180);assert.equal(await page.locator('#world').getAttribute('data-monster-count'),'0');
    await page.screenshot({path:out+'/'+map.id+'.png'});
  }
  const sheet=await page.evaluate(async()=>{
    const {SLEEPING_STARS_MAPS}=await import('/shared/config.js'),{drawSleepingStarsArt}=await import('/sleeping-stars-art.js');
    const canvas=Object.assign(document.createElement('canvas'),{width:1200,height:900}),ctx=canvas.getContext('2d');
    for(const [index,map] of SLEEPING_STARS_MAPS.entries()){
      ctx.save();ctx.translate(index%2*600,Math.floor(index/2)*450);ctx.scale(600/map.width,450/map.height);drawSleepingStarsArt(ctx,map);ctx.restore();
      ctx.font='18px sans-serif';ctx.fillStyle='#e6e6ef';ctx.fillText(map.name,index%2*600+18,Math.floor(index/2)*450+28);
    }
    return canvas.toDataURL();
  });await writeFile(out+'/four-maps.png',Buffer.from(sheet.split(',')[1],'base64'));
  await page.locator('#map-overview').click();
  assert.equal(await page.locator('#universe-links .universe-node').count(),UNIVERSE_MAP_LAYOUT.length);
  assert.equal(await page.locator('#universe-links [data-map-id="black-hole"]').count(),0);
  for(const map of SLEEPING_STARS_MAPS)assert.equal(await page.locator(`#universe-links .universe-node[data-map-id="${map.id}"]`).count(),1);
  await page.screenshot({path:out+'/universe-desktop.png'});await page.locator('#universe-close').click();
  await move(BLACK_HOLE.id);await page.locator('#map-overview').click();
  assert.notEqual(await page.locator('#universe-preview').getAttribute('data-map-id'),BLACK_HOLE.id);await page.locator('#universe-close').click();
  await page.setViewportSize({width:390,height:844});await move(SLEEPING_STARS_MAPS[0].id);
  await page.locator('#map-overview').click();await page.screenshot({path:out+'/universe-mobile.png'});
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);await page.locator('#universe-close').click();

  const studentPage=await browser.newPage({viewport:{width:1280,height:900}});studentPage.on('pageerror',error=>errors.push(error.message));
  await studentPage.goto(url);await studentPage.locator('#student-tab').click();await studentPage.locator('#join-code').fill(room.code);await studentPage.locator('#nickname').fill('밤길검사');await studentPage.locator('#student-pin').fill('1234');await studentPage.locator('#student-form .submit').click();await studentPage.locator('#lobby').waitFor({state:'hidden'});
  const student=[...room.players.values()].find(player=>player.role==='student');
  Object.assign(student.avatar,{level:5,constellationId:'taurus',form:'transcendent'});student.accountKind='master';ensureVitals(student).hp=500;
  room.serena={state:'active',monsterId:SERENA.monsterId,respawnAt:null};const boss=monstersOf(room).get(SERENA.monsterId);
  Object.assign(student,{mapId:boss.mapId,x:boss.x+480,y:boss.y+100,input:{x:0,y:0,at:0}});publish(student);
  await studentPage.waitForFunction(()=>document.getElementById('minimap').dataset.mapId==='star-origin-4');
  await studentPage.evaluate(async()=>{const {preloadOriginArt}=await import('/origin-art.js');await preloadOriginArt();});
  const now=Date.now();assert(beginSerenaSkill(room,boss,'red',now,()=>.999));boss.stunUntil=now+10000;publish(student);
  await studentPage.waitForTimeout(250);await studentPage.screenshot({path:out+'/serena-red-two.png'});
  assert.equal(boss.serenaSkills.marks[0].requiredFriends,2);assert.equal(student.battleVitals.hp,500);
  const labels=await studentPage.evaluate(async()=>{
    const {drawSerenaGround,drawSerenaMarks}=await import('/serena-skill-art.js');
    const canvas=Object.assign(document.createElement('canvas'),{width:700,height:450}),ctx=canvas.getContext('2d'),texts=[];
    const original=ctx.fillText.bind(ctx);ctx.fillText=(text,...args)=>{texts.push(text);original(text,...args);};
    const player={id:'preview',connected:true,x:350,y:280},points=new Map([[player.id,player]]),now=1000;
    const effects={marks:[{kind:'red',playerId:player.id,startsAt:0,endsAt:5000,radiusX:220,radiusY:132,requiredFriends:2,nearbyFriends:1}]};
    ctx.fillStyle='#34373e';ctx.fillRect(0,0,700,450);drawSerenaGround(ctx,effects,[player],points,now,true);drawSerenaMarks(ctx,effects,[player],points,()=>100,now,true);
    return {texts,png:canvas.toDataURL()};
  });assert(labels.texts.includes('2'));assert(labels.texts.includes('친구 1/2명 · 4초'));
  await writeFile(out+'/serena-red-readable.png',Buffer.from(labels.png.split(',')[1],'base64'));
  assert.deepEqual(errors,[]);console.log('PASS sleeping maps4, north gate F travel, shared minimap art, hidden black-hole overview, desktop/mobile, Serena numbered red mark; JS errors0');
}finally{await browser?.close();await game.close();}
