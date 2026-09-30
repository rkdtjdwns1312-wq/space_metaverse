import assert from 'node:assert/strict';
import {randomBytes} from 'node:crypto';
import {mkdir,writeFile,mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve,dirname} from 'node:path';
import {chromium} from 'playwright';
import {io} from 'socket.io-client';
import {createClassroomServer} from '../server/app.js';
import {ensureVitals} from '../server/vitals.js';
import {addPlanet} from '../server/world.js';
import {departmentSlots} from '../shared/plaza-layout.js';

const root=resolve(tmpdir()),dir=await mkdtemp(join(root,'aquarius-ui-'));
const key=randomBytes(24).toString('hex'),game=createClassroomServer({teacherKey:key,studentHours:false,dataDir:dir});
const {port}=await game.listen(),url=`http://127.0.0.1:${port}`;
const browser=await chromium.launch({headless:true,args:['--no-proxy-server'],...(process.platform==='win32'?{channel:'msedge'}:{})});
const teacher=io(url,{transports:['websocket'],reconnection:false,autoConnect:false}),errors=[],checks=[];
const check=text=>{checks.push(text);console.log('PASS:',text);};
try{
  await mkdir('.local',{recursive:true});
  await new Promise((r,j)=>{teacher.once('connect',r);teacher.once('connect_error',j);teacher.connect();});
  const made=await teacher.timeout(5000).emitWithAck('room:create',{teacherKey:key,studentAccounts:['물병검사','미접속1','미접속2','미접속3'].map(nickname=>({nickname,pin:'1234'}))});assert.ok(made.ok);
  const page=await browser.newPage({viewport:{width:1440,height:960},hasTouch:true});page.setDefaultTimeout(10000);page.on('pageerror',e=>errors.push(e.message));
  await page.goto(url+'/?class='+made.room.code);await page.locator('#nickname').fill('물병검사');await page.locator('#student-pin').fill('1234');await page.locator('#student-form .submit').click();await page.locator('#lobby').waitFor({state:'hidden'});
  await page.locator('#password-offer-no').click();
  const room=game.store.rooms.get(made.room.code),p=[...room.players.values()].find(p=>p.nickname==='물병검사');
  const publish=()=>game.io.to(p.socketId).emit('room:state',game.store.snapshot(room,p));
  await page.evaluate(async()=>{await Promise.all(['attack','skill-lv2','skill-lv3','skill-lv4'].map(async name=>{const image=new Image();image.src=`/assets/skills/aquarius/${name}.png`;await image.decode();if(image.naturalWidth!==1536||image.naturalHeight!==1024)throw Error('Invalid sheet '+name);}));});check('4종 24프레임 시트 실제 로드');
  for(const level of [2,3,4]){
    Object.assign(p.avatar,{level,constellationId:'aquarius'});Object.assign(p,{x:1800,y:1320,facing:{x:1,y:0},aquariusCooldownUntil:0});p.battleVitals=null;ensureVitals(p);publish();
    await page.waitForTimeout(160);await page.locator('#world').focus();await page.keyboard.press('e');
    await page.waitForFunction(()=>document.getElementById('world').dataset.aquariusCasts==='1');assert.equal(ensureVitals(p).mp,(level-1)*10-10);
    await page.waitForTimeout(1100);await page.screenshot({path:`.local/300-aquarius-lv${level}.png`});
    const frames=new Set();for(let i=0;i<8;i++){frames.add(await page.locator('#world').getAttribute('data-aquarius-frame'));await page.waitForTimeout(100);}assert.ok(frames.size>=4);
    await page.waitForFunction(()=>document.getElementById('world').dataset.aquariusCasts==='0',{},{timeout:6500});
    // 클라이언트 마지막 프레임과 서버50ms tick의 경계 차이까지 기다립니다.
    for(let i=0;i<10&&room.aquariusCasts.size;i++)await page.waitForTimeout(50);
    assert.equal(room.aquariusCasts.size,0);check(`LV${level} E키·MP차감·물병 반복 애니메이션·5초 종료`);
  }
  await page.locator('#touch-attack').click();await page.waitForFunction(()=>Number(document.getElementById('world').dataset.projectileCount)>0);await page.screenshot({path:'.local/300-aquarius-Q.png'});check('터치 Q 물방울 투사체');
  await page.evaluate(()=>document.getElementById('avatar-dialog').showModal());await page.locator('#self-skill-slots button').nth(1).click();
  const text=await page.locator('#skill-description-text').textContent();assert.ok(text.includes('600%')&&text.includes('최대 30')&&text.includes('20초'));
  await page.screenshot({path:'.local/300-aquarius-info.png'});check('내정보 단계별 아이콘과 회복·피해·쿨타임 설명');
  await page.locator('#skill-description-dialog button').click();await page.evaluate(()=>document.getElementById('avatar-dialog').close());
  p.inventory.push({id:'sun-card',quantity:1},{id:'space-food-card',quantity:1});publish();await page.waitForTimeout(150);
  await page.evaluate(()=>document.getElementById('inventory-dialog').showModal());
  await page.locator('#bag-list [data-item-id="sun-card"] button').click();await page.locator('#bag-detail .item-info').click();
  assert.equal(await page.locator('#item-info-level').textContent(),'Lv 2 아이템');assert.ok(!(await page.locator('#item-info-text').textContent()).endsWith('LV 2'));
  for(const width of [1440,390]){
    await page.setViewportSize({width,height:960});
    const name=await page.locator('#item-info-title').boundingBox(),level=await page.locator('#item-info-level').boundingBox();
    assert.ok(name.x+name.width<=level.x);assert.ok(Math.abs(name.y+name.height/2-level.y-level.height/2)<3);
    await page.screenshot({path:`.local/303-item-header-${width}.png`});
  }
  check('아이템 정보 PC·작은 화면 이름 왼쪽/단계 오른쪽 같은 줄');
  await page.setViewportSize({width:1440,height:960});await page.locator('[data-close="item-info-dialog"]').click();
  await page.locator('#bag-detail .use').click();assert.equal(await page.locator('#use-target option').count(),3);
  assert.ok((await page.locator('#use-target').textContent()).includes('미접속'));
  await page.screenshot({path:'.local/304-offline-sun.png'});await page.locator('#use-confirm').click();await page.locator('#use-dialog').waitFor({state:'hidden'});
  assert.ok([...room.players.values()].filter(v=>v.nickname.startsWith('미접속')).every(v=>v.cardMarkers.some(m=>m.itemId==='sun-card')));check('미접속3명 선택·해 실제 사용 성공');
  await page.evaluate(()=>document.getElementById('inventory-dialog').close());
  const planet=addPlanet(room,{...departmentSlots()[0],name:'검증행성',description:'임시',color:'#d5c4f3',rules:[],createdBy:p.id,templateId:'reading'});
  planet.interiorDecor={board:{shapeId:'tablet'},'report-board':{shapeId:'hex'},'warning-rock':{shapeId:'crystal'}};
  Object.assign(p,{mapId:'planet:'+planet.id,x:600,y:480});p.avatar.departmentId=planet.id;publish();
  await page.waitForFunction(id=>document.getElementById('minimap').dataset.mapId===id,p.mapId);await page.waitForTimeout(500);
  await page.screenshot({path:'.local/301-interior-no-hex.png'});check('육각 장식 저장값이 있는 부서 내부 실제 화면');
  Object.assign(p,{mapId:'black-hole',x:600,y:390});publish();
  await page.waitForFunction(()=>document.getElementById('minimap').dataset.mapId==='black-hole');
  await page.evaluate(async()=>{await Promise.all(['black-hole-interior','black-star-sanctuary'].map(async name=>{const i=new Image();i.src=`/assets/maps/${name}.png`;await i.decode();}));});
  await page.waitForTimeout(500);await page.screenshot({path:'.local/305-black-hole-game.png'});check('블랙홀 내부·검은별 새 원화 실제 게임 렌더링');
  p.cardMarkers=[{id:'visible-test',itemId:'sun-card',fromId:p.id,fromNickname:p.nickname,fromLevel:4,at:Date.now(),until:Date.now()+60000}];publish();await page.waitForTimeout(100);
  const headTexts=await page.evaluate(async()=>{
    const texts=[],original=CanvasRenderingContext2D.prototype.fillText;
    CanvasRenderingContext2D.prototype.fillText=function(text,...args){if(this.canvas.id==='world')texts.push(text);return original.call(this,text,...args);};
    try{await new Promise(r=>setTimeout(r,150));return texts;}finally{CanvasRenderingContext2D.prototype.fillText=original;}
  });
  assert.ok(headTexts.length>0);assert.ok(!headTexts.some(t=>t==='☀️'));assert.equal(p.cardMarkers[0].itemId,'sun-card');
  await page.screenshot({path:'.local/311-no-overhead-items.png'});check('활성 해 효과 보존·맵 머리 위 아이템 아이콘 숨김');
  assert.deepEqual(errors,[]);check('브라우저 오류 0');await writeFile('.local/300-browser-result.json',JSON.stringify({checks,errors},null,2));
}finally{teacher.disconnect();await browser.close();await game.close();assert.equal(dirname(resolve(dir)),root);await rm(dir,{recursive:true,force:true});}
