import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {chromium} from 'playwright';
import {io} from 'socket.io-client';
import {createClassroomServer} from '../server/app.js';
import {MAP,PLAZA_ID,GARDEN,PARADISE_MAPS,MOON_PARADISE_MAPS,STAR_PARADISE} from '../shared/config.js';

const key='request-259-paradise-art-test-key',game=createClassroomServer({teacherKey:key,studentHours:false});
const {port}=await game.listen(),url=`http://127.0.0.1:${port}`;
const browser=await chromium.launch({headless:true,args:['--no-proxy-server'],...(process.platform==='win32'?{channel:'msedge'}:{})});
const socket=io(url,{transports:['websocket'],reconnection:false}),checks=[],errors=[];
await mkdir('.local',{recursive:true});
const check=value=>{checks.push(value);console.log(`Paradise art ${checks.length}: ${value}`);};
try{
 await new Promise((resolve,reject)=>{socket.once('connect',resolve);socket.once('connect_error',reject);});
 const created=await socket.timeout(5000).emitWithAck('room:create',{teacherKey:key,title:'요청259 그림 확인',allowedNames:['검증 학생']});assert.ok(created.ok);
 const page=await browser.newPage({viewport:{width:1440,height:960},hasTouch:true});page.setDefaultTimeout(10000);page.on('pageerror',e=>errors.push(e.message));
 await page.goto(url);await page.locator('#join-code').fill(created.room.code);await page.locator('#nickname').fill('검증 학생');await page.locator('#student-pin').fill('1234');await page.locator('#student-form .submit').click();await page.locator('#lobby').waitFor({state:'hidden'});
 const room=game.store.rooms.get(created.room.code),player=[...room.players.values()].find(p=>p.role==='student'),publish=()=>game.io.to(player.socketId).emit('room:state',game.store.snapshot(room,player));
 assert.equal(player.mapId,PLAZA_ID);
 const maps=[GARDEN,...PARADISE_MAPS,...MOON_PARADISE_MAPS,STAR_PARADISE];
 const gallery=await browser.newPage({viewport:{width:1440,height:1920}});gallery.on('pageerror',e=>errors.push(e.message));await gallery.goto(url+'/health');
 await gallery.evaluate(async()=>{
  const config=await import('/shared/config.js'),scenery=await import('/scenery.js');
  document.body.replaceChildren();document.body.style.cssText='margin:0;display:grid;grid-template-columns:1fr 1fr;grid-template-rows:repeat(4,480px);background:#fff;color:#50486f;font:20px Jua';
  const maps=[config.GARDEN,...config.PARADISE_MAPS,...config.MOON_PARADISE_MAPS,config.STAR_PARADISE];
  await Promise.all(['paradise-sun.png','paradise-moon.png','plaza-paving.png','plaza-sanctuary.png'].map(file=>new Promise((resolve,reject)=>{const image=new Image();image.onload=resolve;image.onerror=()=>reject(Error(file+' failed to load'));image.src='/assets/maps/'+file;})));
  await document.fonts.ready;
  for(const map of maps){const block=document.createElement('section'),label=document.createElement('div'),canvas=document.createElement('canvas');block.style.cssText='height:480px;overflow:hidden';label.textContent=map.name;label.style.cssText='height:32px;text-align:center';canvas.width=720;canvas.height=456;canvas.style.display='block';const ctx=canvas.getContext('2d');ctx.scale(.4,.4);
   (map.id===config.GARDEN.id?scenery.drawCrossroads:map.id===config.STAR_PARADISE.id?scenery.drawStarParadise:scenery.drawParadise)(ctx,map);
   for(const o of map.objects){ctx.font='22px Jua';ctx.textAlign='center';ctx.lineWidth=4;ctx.strokeStyle='#fff';ctx.strokeText(o.name.replace(/[←→↑↓]/g,''),o.x,o.y);ctx.fillStyle='#594c72';ctx.fillText(o.name.replace(/[←→↑↓]/g,''),o.x,o.y);}block.append(label,canvas);document.body.append(block);
  }
 });
 await gallery.screenshot({path:'.local/259-paradise-art-8maps.png'});check('8개 낙원 배경 렌더링·전체 화면 캡처');
 const assetResult=await gallery.evaluate(async()=>Promise.all(['paradise-sun.png','paradise-moon.png','plaza-sanctuary.png','plaza-paving.png'].map(file=>new Promise(resolve=>{const image=new Image();image.onload=()=>resolve({file,loaded:true,width:image.naturalWidth,height:image.naturalHeight});image.onerror=()=>resolve({file,loaded:false,width:0,height:0});image.src='/assets/maps/'+file;}))));
 for(const image of assetResult)assert.ok(image.loaded,`${image.file} is required`);
 check('우주·석판·태양·달 PNG 4종 정상 로드');
 const state=await gallery.evaluate(async()=>{const c=await import('/shared/config.js');return [c.GARDEN,...c.PARADISE_MAPS,...c.MOON_PARADISE_MAPS,c.STAR_PARADISE].map(m=>({id:m.id,width:m.width,height:m.height,vista:m.vista,theme:m.theme}));});
 assert.equal(state.length,8);for(const item of state)assert.equal(item.width,1800);for(const map of [...PARADISE_MAPS,...MOON_PARADISE_MAPS])assert.ok(map.vista.bodyRadius>0);check('8개 맵 크기와 단계별 vista 정의 유지');
 for(const map of maps){Object.assign(player,{mapId:map.id,x:map.width/2,y:map.height/2});publish();await page.waitForFunction(id=>document.getElementById('minimap').dataset.mapId===id,map.id);assert.equal(await page.locator('#minimap').getAttribute('data-has-player'),'true');}
 check('미니맵 8개 현재 위치 동기화');assert.deepEqual(errors,[]);check('브라우저 페이지 오류 0개');
 await writeFile('.local/259-paradise-art-result.json',JSON.stringify({checks,errors,assets:assetResult,maps:state,screenshot:'.local/259-paradise-art-8maps.png'},null,2));
}finally{socket.close();await browser.close();await game.close();}
