// 임시 교실에서 양자리 Q/E 시트와 구름 이동·유지를 실제 화면으로 확인합니다.
import assert from 'node:assert/strict';
import {randomBytes} from 'node:crypto';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {chromium} from 'playwright';
import {io} from 'socket.io-client';
import {createClassroomServer} from '../server/app.js';
import {ensureVitals} from '../server/vitals.js';
import {monstersOf} from '../server/monsters.js';

const dir=await mkdtemp(join(tmpdir(),'aries-vfx-'));
const key=randomBytes(24).toString('hex'),game=createClassroomServer({teacherKey:key,studentHours:false,dataDir:dir});
const {port}=await game.listen(),url=`http://127.0.0.1:${port}`;
const browser=await chromium.launch({headless:true,args:['--no-proxy-server'],...(process.platform==='win32'?{channel:'msedge'}:{})});
const teacher=io(url,{transports:['websocket'],reconnection:false,autoConnect:false}),errors=[];
try{
  await new Promise((resolve,reject)=>{teacher.once('connect',resolve);teacher.once('connect_error',reject);teacher.connect();});
  const made=await teacher.timeout(5000).emitWithAck('room:create',{teacherKey:key,studentAccounts:[{nickname:'양검사',pin:'1234'}]});
  assert.ok(made.ok);
  const page=await browser.newPage({viewport:{width:1440,height:900}});
  page.on('pageerror',error=>errors.push(error.message));page.setDefaultTimeout(10000);
  await page.goto(url+'/?class='+made.room.code);
  await page.locator('#nickname').fill('양검사');await page.locator('#student-pin').fill('1234');
  await page.locator('#student-form .submit').click();await page.locator('#lobby').waitFor({state:'hidden'});
  await page.locator('#password-offer-no').click();
  const room=game.store.rooms.get(made.room.code),player=[...room.players.values()].find(p=>p.nickname==='양검사');
  Object.assign(player,{mapId:'star-origin-1',x:650,y:470,facing:{x:1,y:0},battleVitals:null,ariesCooldownUntil:0});
  Object.assign(player.avatar,{level:4,constellationId:'aries'});ensureVitals(player);
  const monsters=[...monstersOf(room).values()].filter(m=>m.mapId===player.mapId).slice(0,3);
  monsters.forEach((m,index)=>Object.assign(m,{x:820+index*70,y:440+index*40,dx:0,dy:0,nextDirectionAt:Infinity}));
  game.io.to(player.socketId).emit('room:state',game.store.snapshot(room,player));
  const sheets=await page.evaluate(async()=>Promise.all(['attack','skill-lv2','skill-lv3','skill-lv4'].map(async kind=>{
    const image=new Image();image.src=`/assets/skills/aries/${kind}.png`;await image.decode();
    return [kind,image.naturalWidth,image.naturalHeight];
  })));
  assert.ok(sheets.every(([,width,height])=>width===1536&&height===1024));
  await page.waitForTimeout(200);await page.locator('#world').focus();await page.keyboard.press('e');
  await page.waitForFunction(()=>Number(document.getElementById('world').dataset.ariesCloudCount)===3);
  assert.equal(ensureVitals(player).mp,30);
  await page.waitForTimeout(1400);await page.screenshot({path:'.local/344-aries-cloud.png'});
  await page.keyboard.press('q');await page.waitForFunction(()=>Number(document.getElementById('world').dataset.projectileCount)>0);
  await page.screenshot({path:'.local/344-aries-attack.png'});
  assert.deepEqual(errors,[]);
  console.log(JSON.stringify({sheets,clouds:3,mp:ensureVitals(player).mp,errors}));
}finally{
  teacher.disconnect();await browser.close();await game.close();await rm(dir,{recursive:true,force:true});
}
