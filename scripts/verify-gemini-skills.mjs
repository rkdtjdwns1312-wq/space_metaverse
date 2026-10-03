// 임시 교실에서 쌍둥이자리 시트·E/Q 실제 표시를 확인합니다.
import assert from 'node:assert/strict';
import {randomBytes} from 'node:crypto';
import {mkdir,mkdtemp,rm,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {chromium} from 'playwright';
import {io} from 'socket.io-client';
import {createClassroomServer} from '../server/app.js';
import {ensureVitals} from '../server/vitals.js';

const dir=await mkdtemp(join(tmpdir(),'gemini-vfx-'));
const key=randomBytes(24).toString('hex'),game=createClassroomServer({teacherKey:key,studentHours:false,dataDir:dir});
const {port}=await game.listen(),url=`http://127.0.0.1:${port}`;
const browser=await chromium.launch({headless:true,args:['--no-proxy-server'],...(process.platform==='win32'?{channel:'msedge'}:{})});
const teacher=io(url,{transports:['websocket'],reconnection:false,autoConnect:false}),errors=[],checks=[];
try{
  await mkdir('.local',{recursive:true});
  await new Promise((resolve,reject)=>{teacher.once('connect',resolve);teacher.once('connect_error',reject);teacher.connect();});
  const made=await teacher.timeout(5000).emitWithAck('room:create',{teacherKey:key,studentAccounts:[{nickname:'쌍별검사',pin:'1234'}]});
  assert.ok(made.ok);
  const page=await browser.newPage({viewport:{width:1440,height:900}});
  page.on('pageerror',error=>errors.push(error.message));page.setDefaultTimeout(10000);
  await page.goto(url+'/?class='+made.room.code);
  await page.locator('#nickname').fill('쌍별검사');await page.locator('#student-pin').fill('1234');
  await page.locator('#student-form .submit').click();await page.locator('#lobby').waitFor({state:'hidden'});
  await page.locator('#password-offer-no').click();
  const room=game.store.rooms.get(made.room.code),player=[...room.players.values()].find(p=>p.nickname==='쌍별검사');
  room.monsters=new Map();
  Object.assign(player,{mapId:'star-origin-1',x:650,y:470,facing:{x:1,y:0},battleVitals:null,geminiCooldownUntil:0});
  Object.assign(player.avatar,{level:4,constellationId:'gemini'});ensureVitals(player);
  game.io.to(player.socketId).emit('room:state',game.store.snapshot(room,player));
  const sheets=await page.evaluate(async()=>{
    const output=[];for(const kind of ['attack','skill-lv2','skill-lv3','skill-lv4']){
      const image=new Image();image.src=`/assets/skills/gemini/${kind}.png`;await image.decode();
      output.push([kind,image.naturalWidth,image.naturalHeight]);
    }return output;
  });
  assert.ok(sheets.every(([,w,h])=>w===1536&&h===1024));
  checks.push('24F 시트 4종 브라우저 로드');
  await page.waitForTimeout(200);await page.locator('#world').focus();await page.keyboard.press('e');
  await page.waitForFunction(()=>Number(document.getElementById('world').dataset.projectileCount)>=2);
  assert.equal(ensureVitals(player).mp,45);
  await page.waitForTimeout(340);await page.screenshot({path:'.local/343-gemini-skill.png'});
  checks.push('E키: 마나5 차감·LV4 쌍별 관통 연출');
  await page.waitForTimeout(750);await page.keyboard.press('q');
  await page.waitForFunction(()=>Number(document.getElementById('world').dataset.projectileCount)>0);
  await page.waitForTimeout(150);await page.screenshot({path:'.local/343-gemini-attack.png'});
  checks.push('Q키: 작은 쌍별 비행');
  assert.deepEqual(errors,[]);
  await writeFile('.local/343-gemini-browser.json',JSON.stringify({checks,errors},null,2));
  console.log(JSON.stringify({checks,errors},null,2));
}finally{
  teacher.disconnect();await browser.close();await game.close();await rm(dir,{recursive:true,force:true});
}
