import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {chromium} from 'playwright';
import {io} from 'socket.io-client';
import {createClassroomServer} from '../server/app.js';
import {addPlanet} from '../server/world.js';
import {MAP,PLAZA_ID,PLANET_TEMPLATES} from '../shared/config.js';
import {departmentSlots} from '../shared/plaza-layout.js';

// Requests 264/265 use only a temporary in-memory classroom and synthetic planets.
const ids=['diary','subject','reading','rules','pe','meal','facility','finance','counsel','cleaning','art','show','audit'];
assert.deepEqual(PLANET_TEMPLATES.map(template=>template.id),ids,'the expected 13 department templates are present');
const key='request-264-department-art-test-key';
const game=createClassroomServer({teacherKey:key,studentHours:false});
const {port}=await game.listen(),url=`http://127.0.0.1:${port}`;
const browser=await chromium.launch({headless:true,args:['--no-proxy-server'],...(process.platform==='win32'?{channel:'msedge'}:{})});
const socket=io(url,{transports:['websocket'],reconnection:false}),checks=[],errors=[];
await mkdir('.local',{recursive:true});
const check=value=>{checks.push(value);console.log(`Department art ${checks.length}: ${value}`);};

try{
  await new Promise((resolve,reject)=>{socket.once('connect',resolve);socket.once('connect_error',reject);});
  const created=await socket.timeout(5000).emitWithAck('room:create',{teacherKey:key,title:'부서행성 그림 검증',allowedNames:['검증 학생']});
  assert.ok(created.ok,created.message||'temporary classroom creation failed');
  const page=await browser.newPage({viewport:{width:1440,height:960},hasTouch:true});
  page.setDefaultTimeout(10000);page.on('pageerror',error=>errors.push(error.message));
  await page.goto(url);await page.locator('#join-code').fill(created.room.code);await page.locator('#nickname').fill('검증 학생');
  await page.locator('#student-pin').fill('1234');await page.locator('#student-form .submit').click();await page.locator('#lobby').waitFor({state:'hidden'});
  const room=game.store.rooms.get(created.room.code),player=[...room.players.values()].find(candidate=>candidate.role==='student');
  assert.ok(player);assert.equal(player.mapId,PLAZA_ID);

  const slots=departmentSlots();assert.ok(slots.length>=ids.length,'there are enough valid plaza positions for all template types');
  const planets=ids.map((id,index)=>addPlanet(room,{...slots[index],name:PLANET_TEMPLATES.find(t=>t.id===id).name,
    description:'그림 확인용 임시 부서행성',color:PLANET_TEMPLATES.find(t=>t.id===id).color,rules:[],createdBy:player.id,templateId:id}));
  const publish=()=>game.io.to(player.socketId).emit('room:state',game.store.snapshot(room,player));publish();
  await page.waitForFunction(id=>document.getElementById('minimap')?.dataset.mapId===id,PLAZA_ID);

  const gallery=await browser.newPage({viewport:{width:1440,height:1120}});gallery.on('pageerror',error=>errors.push(error.message));
  await gallery.goto(url+'/health');
  const artInfo=await gallery.evaluate(async ids=>{
    const [{DEPARTMENT_ART,DEPARTMENT_VISUAL_SCALE,departmentVisualBox,drawDepartmentHome,preloadDepartmentArt},config]=await Promise.all([
      import('/department-art.js'),import('/shared/config.js')]);
    if(!DEPARTMENT_ART||typeof departmentVisualBox!=='function'||typeof drawDepartmentHome!=='function')throw Error('department art exports are incomplete');
    await preloadDepartmentArt(ids);
    const result=[];
    for(const id of ids){
      const entry=DEPARTMENT_ART[id];if(!entry||typeof entry.src!=='string')throw Error(`missing DEPARTMENT_ART.${id}.src`);
      const image=new Image();image.src=entry.src;
      await new Promise((resolve,reject)=>{if(image.complete&&image.naturalWidth)resolve();else{image.onload=resolve;image.onerror=()=>reject(Error(`failed to load ${id}: ${entry.src}`));}});
      const canvas=document.createElement('canvas');canvas.width=image.naturalWidth;canvas.height=image.naturalHeight;
      const cx=canvas.getContext('2d',{willReadFrequently:true});cx.drawImage(image,0,0);
      const pixels=cx.getImageData(0,0,canvas.width,canvas.height).data;let left=canvas.width,top=canvas.height,right=-1,bottom=-1;
      for(let y=0;y<canvas.height;y++)for(let x=0;x<canvas.width;x++)if(pixels[(y*canvas.width+x)*4+3]){left=Math.min(left,x);top=Math.min(top,y);right=Math.max(right,x);bottom=Math.max(bottom,y);}
      const bytes=await (await fetch(entry.src)).arrayBuffer();
      const hash=[...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(value=>value.toString(16).padStart(2,'0')).join('');
      result.push({id,src:entry.src,width:image.naturalWidth,height:image.naturalHeight,transparent:pixels.filter((_,i)=>i%4===3).some(alpha=>alpha===0),
        alphaBox:{left:left/canvas.width,top:top/canvas.height,right:(right+1)/canvas.width,bottom:(bottom+1)/canvas.height},hash});
    }
    const templateMap=new Map(config.PLANET_TEMPLATES.map(template=>[template.id,template]));
    document.body.replaceChildren();document.body.style.cssText='margin:0;padding:24px;display:grid;grid-template-columns:repeat(4,1fr);gap:12px;background:#fff;color:#514866;font:18px sans-serif';
    await document.fonts.ready;
    for(const id of ids){const cell=document.createElement('section'),label=document.createElement('div'),canvas=document.createElement('canvas');
      cell.style.cssText='height:245px;text-align:center;overflow:hidden';label.textContent=id;label.style.height='25px';canvas.width=260;canvas.height=215;
      const ctx=canvas.getContext('2d');drawDepartmentHome(ctx,{id,x:130,y:150,radius:36,color:templateMap.get(id).color},null,templateMap.get(id));cell.append(label,canvas);document.body.append(cell);}
    const box=departmentVisualBox({id:'measure',x:100,y:100,radius:36});
    return {scale:DEPARTMENT_VISUAL_SCALE,box,images:result, gallery:document.body.scrollWidth};
  },ids);
  assert.equal(artInfo.scale,Math.SQRT2,'department artwork uses the requested √2 scale');
  for(const image of artInfo.images){
    assert.match(image.src,new RegExp(`/assets/planets/${image.id}\\.png$`),`${image.id} points at its named planet PNG`);
    assert.ok(image.width>0&&image.height>0,`${image.id} image completes loading`);
    assert.ok(image.transparent,`${image.id} contains transparent pixels`);
    assert.ok(image.alphaBox.right>image.alphaBox.left&&image.alphaBox.bottom>image.alphaBox.top,`${image.id} has a nonempty visible alpha box`);
  }
  assert.equal(new Set(artInfo.images.map(image=>image.hash)).size,ids.length,'all 13 artwork files have distinct SHA-256 hashes');
  // 서로 다른 지붕과 행성 실루엣의 원본 여백은 달라도 됩니다. 공통 외관 상자와 종횡비 보존을 검증합니다.
  const box=artInfo.box,width=Number(box?.width??box?.w),height=Number(box?.height??box?.h);
  assert.ok(Number.isFinite(width)&&Number.isFinite(height),'departmentVisualBox returns width and height');
  assert.ok(Math.abs(width-95.4*Math.SQRT2)<.15&&Math.abs(height-113.4*Math.SQRT2)<.15,
    `visual box scales 95.4×113.4 by √2 (got ${width}×${height})`);
  await gallery.screenshot({path:'.local/264-department-art-gallery.png',fullPage:true});
  check('13개 PNG 로드·투명도·서로 다른 해시·√2 시각 크기와 갤러리 렌더링');

  await page.waitForFunction(()=>document.getElementById('minimap-title')?.textContent==='별의 기원');
  for(const planet of planets){
    Object.assign(player,{mapId:PLAZA_ID,x:planet.x,y:planet.y});publish();
    await page.locator('#interact-prompt').filter({hasText:planet.name}).waitFor({state:'visible'});
    await page.locator('#touch-interact').tap();await page.locator('#planet-dialog').waitFor({state:'visible'});
    await page.locator('#planet-title').filter({hasText:planet.name}).waitFor({state:'attached'});
    assert.equal(player.mapId,PLAZA_ID,`${planet.templateId} interaction remains on the plaza`);
    await page.locator('#planet-close').click();await page.locator('#planet-dialog').waitFor({state:'hidden'});
  }
  assert.equal(await page.locator('#minimap').getAttribute('data-has-player'),'true','the actual plaza minimap shows the player');
  check('실제 13종 부서행성 각각 상호작용·행성 창 표시·광장 미니맵 현재 위치');
  await page.setViewportSize({width:390,height:844});publish();
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'390px classroom has no horizontal overflow');
  check('390px 교실 화면 가로 넘침 없음');
  assert.deepEqual(errors,[],'browser pages have no uncaught errors');check('브라우저 오류 0개');
  await writeFile('.local/department-art-result.json',JSON.stringify({checks,errors,artInfo,
    temporaryRoom:created.room.code,screenshot:'.local/264-department-art-gallery.png'},null,2));
}finally{socket.close();await browser.close();await game.close();}
