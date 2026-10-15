// 합성 메모리 교실과 실제 Canvas/UI만 사용합니다. 학생 저장 파일은 읽지 않습니다.
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {chromium} from 'playwright';
import {io} from 'socket.io-client';
import {createClassroomServer} from '../server/app.js';
import {addPlanet} from '../server/world.js';
import {departmentSlots} from '../shared/plaza-layout.js';
import {PLANET_COLORS,PLAZA_ID,STREET_ID,STATIC_MAPS} from '../shared/config.js';
import {JOURNEY_VERSION} from '../shared/tutorial-journey.js';
const game=createClassroomServer({teacherKey:'map-render-test-key',studentHours:false}),out='.local/663',errors=[],checks=[];
let browser,socket;
await mkdir(out,{recursive:true});
try{
 const {port}=await game.listen(),url=`http://127.0.0.1:${port}`;
 socket=io(url,{transports:['websocket'],reconnection:false});await new Promise((r,j)=>{socket.once('connect',r);socket.once('connect_error',j);});
 const made=await socket.timeout(5000).emitWithAck('room:create',{teacherKey:'map-render-test-key',allowedNames:['지도검사']});assert.ok(made.ok);
 const room=game.store.rooms.get(made.room.code),slots=departmentSlots();
 const names=['독서부','환경과우리교실을함께가꾸는부서','긴 부서 이름도 가로로 표시'];
 for(let i=0;i<names.length;i++)addPlanet(room,{name:names[i],description:'검사용',...slots[i],color:PLANET_COLORS[i],rules:[],templateId:['reading','meal','clean'][i]});
 browser=await chromium.launch({headless:true,args:['--no-proxy-server'],...(process.platform==='win32'?{channel:'msedge'}:{})});
 const page=await browser.newPage({viewport:{width:1440,height:1000}});page.on('pageerror',e=>errors.push(e.message));
 let releaseCliff;const cliffGate=new Promise(resolve=>{releaseCliff=resolve;});
 await page.route('**/assets/floating-cliff-painted.png',async route=>{await cliffGate;await route.continue();});
 await page.goto(url,{waitUntil:'domcontentloaded'});await page.locator('#student-tab').click();await page.locator('#join-code').fill(room.code);await page.locator('#nickname').fill('지도검사');await page.locator('#student-pin').fill('1234');await page.locator('#student-form .submit').click();await page.locator('#lobby').waitFor({state:'hidden'});
 if(await page.locator('#tutorial-dialog').evaluate(d=>d.open))await page.locator('#tutorial-later').click();
 const p=[...room.players.values()].find(p=>p.role==='student');p.journey={version:JOURNEY_VERSION,stage:6,goals:[],claimedAt:Array(5).fill(Date.now()),practiceUntil:0};p.tutorialCompleted=true;
 const publish=()=>game.io.to(p.socketId).emit('room:state',game.store.snapshot(room,p));publish();
 await page.waitForTimeout(500);await page.locator('#map-overview').click();
 // 바위 원화만 지연시킨 상태에서 실제 배경 캐시를 먼저 생성합니다.
 await page.waitForTimeout(1800);
 await page.evaluate(async()=>{
  const config=await import('/shared/config.js'),plaza=await import('/plaza-art.js'),street=await import('/street-art.js'),valley=await import('/valley-art.js'),scenery=await import('/scenery.js');
  const cliff=await import('/floating-island.js');if(cliff.floatingCliffReady())throw new Error('지연 로드 준비 실패');
  const hash=c=>{const a=c.getContext('2d').getImageData(0,0,c.width,c.height).data;let h=2166136261;for(let i=0;i<a.length;i++)h=Math.imul(h^a[i],16777619);return h>>>0;};
  window.captureCliffCaches=()=>{
   const result={};for(const map of Object.values(config.STATIC_MAPS)){
    if(map.id==='black-hole')continue;
    const canvas=document.createElement('canvas');canvas.width=360;canvas.height=Math.round(360*map.height/map.width);const c=canvas.getContext('2d');c.scale(360/map.width,360/map.width);
    if(map.id===config.PLAZA_ID)plaza.drawPlazaGround(c,map);else if(map.id===config.STREET_ID)street.drawStreetGround(c,map);else if(map.id===config.VALLEY_ID)valley.drawValleyGround(c,map,0);else if(map.theme==='star-origin')scenery.drawStarOrigin(c,map,0);else scenery.drawParadise(c,map);
    result[map.id]=hash(canvas);
   }
   const tile=document.createElement('canvas');tile.width=900;tile.height=700;const c=tile.getContext('2d');c.translate(-1400,-1600);plaza.drawPlazaGround(c,config.STATIC_MAPS[config.PLAZA_ID]);result.plazaTiles=hash(tile);
   for(const [i,c]of [...document.querySelectorAll('#universe-links canvas[data-map-id],#minimap,#universe-preview')].entries())result['ui:'+i+':'+(c.dataset.mapId||c.id)]=hash(c);
   return result;
  };
 });
 const before=await page.evaluate(()=>window.captureCliffCaches());
 await page.waitForTimeout(400);assert.deepEqual(await page.evaluate(()=>window.captureCliffCaches()),before,'다른 자산 로드가 안정된 뒤 비교');
 releaseCliff();assert.equal(await page.evaluate(async()=>{const cliff=await import('/floating-island.js');return await cliff.preloadFloatingCliff();}),true);
 const after=await page.evaluate(()=>window.captureCliffCaches());
 const refreshed=Object.keys(before).filter(key=>before[key]!==after[key]);
 for(const id of Object.keys(STATIC_MAPS).filter(id=>id!=='black-hole'))assert.ok(refreshed.includes(id),id+' 캐시 갱신');
 assert.ok(refreshed.includes('plazaTiles'));
 for(const key of Object.keys(before).filter(key=>key.startsWith('ui:')&&!key.endsWith('black-hole')))assert.ok(refreshed.includes(key),key+' 열린 지도 갱신');
 checks.push('원화 지연 로드: 15개 지도 캐시·광장 타일·열린 우주지도/미니맵 모두 갱신');
 await writeFile(out+'/cache-load.json',JSON.stringify({before,after,refreshed},null,2));
 for(const [label,width,height] of [['desktop',1440,1000],['mobile',390,844],['narrow',320,740]]){
  await page.setViewportSize({width,height});await page.locator('#universe-planets').scrollIntoViewIfNeeded();await page.waitForTimeout(250);
  const layout=await page.locator('#universe-planets').evaluate(root=>{
   const r=root.getBoundingClientRect();return {width:innerWidth,root:{x:r.x,right:r.right,scroll:root.scrollWidth,client:root.clientWidth},nodes:[...root.children].map(el=>{
    const label=el.querySelector('span:not(.location-badge)'),canvas=el.querySelector('canvas'),b=el.getBoundingClientRect(),l=label.getBoundingClientRect(),c=canvas.getBoundingClientRect();
    return {text:label.textContent,x:b.x,right:b.right,labelBottom:l.bottom,canvasTop:c.top,canvasWidth:c.width,labelWidth:l.width,scroll:el.scrollWidth,client:el.clientWidth,writing:getComputedStyle(label).writingMode};
   })};
  });
  assert.equal(layout.nodes.length,3);assert.ok(layout.root.scroll<=layout.root.client+1);
  for(const node of layout.nodes){assert.equal(node.writing,'horizontal-tb');assert.ok(node.labelBottom<=node.canvasTop);assert.ok(node.labelWidth>=150);assert.ok(node.canvasWidth>=150);assert.ok(node.x>=0&&node.right<=width);assert.ok(node.scroll<=node.client+1);}
  await page.screenshot({path:`${out}/departments-${label}.png`});checks.push(`${label}: 긴 이름·상단 가로 배치·내부 확대·가로 잘림 없음`);
 }
 await page.locator('#universe-footer-close').click();await page.setViewportSize({width:1440,height:1000});
 // 실제 지도 모듈을 같은 Canvas API로 전체 해상도에서 그립니다.
 const ids=Object.keys(STATIC_MAPS).filter(id=>id!=='black-hole');
 await page.evaluate(async()=>{
  const cliff=await import('/floating-island.js');if(!await cliff.preloadFloatingCliff())throw new Error('바위 원화 로드 실패');
  const config=await import('/shared/config.js');
  window.mapCheck={config,plaza:await import('/plaza-art.js'),street:await import('/street-art.js'),valley:await import('/valley-art.js'),paradise:await import('/paradise-floor.js'),backdrop:await import('/paradise-art.js'),origin:await import('/origin-art.js')};
  await Promise.all([...document.images].map(i=>i.decode().catch(()=>{})));await new Promise(r=>setTimeout(r,700));
 });
 for(const id of ids){
  const png=await page.evaluate(id=>{
   const {config,plaza,street,valley,paradise,backdrop,origin}=window.mapCheck,map=config.STATIC_MAPS[id],canvas=document.createElement('canvas');canvas.width=960;canvas.height=Math.round(960*map.height/map.width);const c=canvas.getContext('2d');c.scale(960/map.width,960/map.width);
   if(id===config.PLAZA_ID)plaza.drawPlazaGround(c,map);else if(id===config.STREET_ID)street.drawStreetGround(c,map);else if(id===config.VALLEY_ID)valley.drawValleyGround(c,map);else if(map.theme==='star-origin')origin.drawOriginArt(c,map);else{backdrop.drawParadiseBackdrop(c,map);paradise.drawParadiseFloor(c,map);}
   return canvas.toDataURL('image/png').split(',')[1];
  },id);await writeFile(`${out}/${id}.png`,Buffer.from(png,'base64'));
 }
 checks.push(`${ids.length}개 지형 전체 지도 렌더링`);
 for(const [id,x,y] of [[PLAZA_ID,2560,1770],[STREET_ID,900,1650],['milky-valley',1200,900]]){
  if(!STATIC_MAPS[id])continue;Object.assign(p,{mapId:id,x,y});publish();await page.waitForTimeout(400);await page.screenshot({path:`${out}/game-${id}.png`});
 }
 assert.deepEqual(errors,[]);await writeFile(`${out}/report.json`,JSON.stringify({checks,errors,maps:ids},null,2));console.log(JSON.stringify({checks,errors}));
}finally{socket?.disconnect();await browser?.close();await game.close();}
