// 요청 279: 오색별빛 쉼터 원화와 길목 안내 글자, 전체 화면을 확인합니다.
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {chromium} from 'playwright';
import {createClassroomServer} from '../server/app.js';
import {fillNewClass} from './class-setup.mjs';
import {STREET,STREET_ID} from '../shared/config.js';
import {onStreetFloor,STREET_LAYOUT} from '../shared/street-layout.js';

const key='street-art-test-only-key',game=createClassroomServer({teacherKey:key,studentHours:false});
const {port}=await game.listen(),url=`http://127.0.0.1:${port}`;
const browser=await chromium.launch({headless:true,args:['--no-proxy-server'],...(process.platform==='win32'?{channel:'msedge'}:{})});
const errors=[];await mkdir('.local',{recursive:true});
try{
  const page=await browser.newPage({viewport:{width:1440,height:960}});page.setDefaultTimeout(15000);page.on('pageerror',e=>errors.push(e.message));
  await page.goto(url,{waitUntil:'domcontentloaded',timeout:25000});await page.locator('#teacher-tab').click();await page.locator('#teacher-key').fill(key);
  await fillNewClass(page,['276']);await page.locator('#teacher-form .submit').click();await page.locator('#lobby').waitFor({state:'hidden'});
  const room=[...game.store.rooms.values()][0],player=[...room.players.values()].find(p=>p.role==='teacher')||[...room.players.values()][0];
  const publish=()=>game.io.to(player.socketId).emit('room:state',game.store.snapshot(room,player));
  Object.assign(player,{mapId:STREET_ID,x:STREET.spawn.x,y:STREET.spawn.y});publish();
  await page.waitForFunction(id=>document.getElementById('minimap')?.dataset.mapId===id,STREET_ID);
  const loaded=await page.evaluate(async()=>{
    const [config,street,props,gates]=await Promise.all([import('/shared/config.js'),import('/street-art.js'),import('/painted-props.js'),import('/gate-art.js')]);
    await Promise.all([street.preloadStreetArt(),props.preloadPaintedProps(),gates.preloadGateArt()]);
    const imageFiles=await Promise.all(Object.values(props.PAINTED_PROPS).map(async spec=>{const image=new Image();image.src='/assets/maps/'+spec.file;await image.decode();return {file:spec.file,width:image.naturalWidth,height:image.naturalHeight};}));
    const canvas=document.createElement('canvas');canvas.width=900;canvas.height=1350;const ctx=canvas.getContext('2d');ctx.scale(.5,.5);street.drawStreetGround(ctx,config.STREET);
    const painted=[];
    for(const o of config.STREET.objects){if(['shop','energy-shop','crafting','arcade','math-station','english-station'].includes(o.kind))painted.push({id:o.id,kind:o.kind,file:props.PAINTED_PROPS[o.kind].file,drawn:props.drawPaintedProp(ctx,o)});else if(o.kind==='gate')gates.drawPaintedGate(ctx,o);}
    const closeup=document.createElement('canvas');closeup.width=2040;closeup.height=1170;
    closeup.getContext('2d').drawImage(canvas,140,20,680,390,0,0,2040,1170);
    const signAssetRequested=performance.getEntriesByType('resource').some(entry=>entry.name.includes('/assets/maps/plaza-sign.png'));
    return {imageFiles,painted,backdrop:street.STREET_BACKDROP_SRC,gate:gates.GATE_ART_SRC,routeLabels:street.STREET_ROUTE_LABELS,signAssetRequested,overview:canvas.toDataURL('image/png'),closeup:closeup.toDataURL('image/png')};
  });
  assert.deepEqual(loaded.imageFiles.map(x=>x.file).sort(),['arcade-front.png','crafting-front.png','energy-shop-front.png','star-shop-front.png','math-station-front.png','english-station-front.png'].sort());
  assert.ok(loaded.imageFiles.every(x=>x.width>0&&x.height>0));assert.equal(loaded.painted.length,12);assert.ok(loaded.painted.every(x=>x.drawn));
  assert.equal(loaded.painted.filter(x=>x.kind==='arcade').length,7);
  assert.equal(await page.locator('#minimap').getAttribute('data-map-id'),STREET_ID);
  const routeLabels=loaded.routeLabels;assert.deepEqual(routeLabels,[{text:'별 발전소 가는길',x:STREET_LAYOUT.upper.x,y:750},{text:'놀이터 가는길',x:STREET_LAYOUT.upper.x,y:1580}]);
  assert.ok(routeLabels.every(label=>onStreetFloor(STREET,label.x,label.y)),'길 안내 글자는 길목 바닥 안에 렌더링합니다.');
  assert.equal(loaded.signAssetRequested,false,'푯말 그림 PNG를 내려받지 않습니다.');
  await page.screenshot({path:'.local/request279-street-game.png'});
  const gallery=await browser.newPage({viewport:{width:1000,height:1120}});gallery.on('pageerror',e=>errors.push(e.message));await gallery.goto(`${url}/health`);
  await gallery.evaluate(data=>{document.body.innerHTML='<main style="margin:0;background:#202038;color:white;font:18px sans-serif"><h1 style="margin:8px">오색별빛 쉼터 · 전체 맵 원화 검수</h1><img id="overview" style="display:block;width:min(900px,95vw);height:auto;margin:auto"/><pre id="assets" style="white-space:pre-wrap"></pre></main>';document.getElementById('overview').src=data.overview;document.getElementById('assets').textContent=JSON.stringify({backdrop:data.backdrop,images:data.imageFiles,paintedProps:data.painted},null,2);},loaded);
  await gallery.locator('#overview').evaluate(img=>img.decode());await gallery.screenshot({path:'.local/request279-street-overview.png',fullPage:true});
  await gallery.evaluate(data=>{const image=document.createElement('img');image.id='closeup';image.style='display:block;width:min(1400px,96vw);height:auto;margin:16px auto';image.src=data.closeup;document.querySelector('main').prepend(image);},loaded);
  await gallery.locator('#closeup').evaluate(img=>img.decode());await gallery.locator('#closeup').screenshot({path:'.local/request279-street-signs-closeup.png'});
  assert.deepEqual(errors,[]);
  const result={checks:7,background:loaded.backdrop,assets:loaded.imageFiles,drawnProps:loaded.painted.map(({id,kind,file})=>({id,kind,file})),routeLabels,signAssetRequested:loaded.signAssetRequested,screenshots:['.local/request279-street-overview.png','.local/request279-street-game.png','.local/request279-street-signs-closeup.png']};
  await writeFile('.local/request279-street-art-result.json',JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2));
}finally{await browser.close();await game.close();}
