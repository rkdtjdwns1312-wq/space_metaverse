// 독립된 임시 교실에서 백조자리 시트 로드·키 입력·맵 재생을 검사합니다.
import assert from 'node:assert/strict';
import {randomBytes} from 'node:crypto';
import {mkdir,mkdtemp,rm,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {chromium} from 'playwright';
import {io} from 'socket.io-client';
import {createClassroomServer} from '../server/app.js';
import {ensureVitals} from '../server/vitals.js';

const dir=await mkdtemp(join(tmpdir(),'swan-vfx-'));
const key=randomBytes(24).toString('hex'),game=createClassroomServer({teacherKey:key,studentHours:false,dataDir:dir});
const {port}=await game.listen(),url=`http://127.0.0.1:${port}`;
const browser=await chromium.launch({headless:true,args:['--no-proxy-server'],...(process.platform==='win32'?{channel:'msedge'}:{})});
const teacher=io(url,{transports:['websocket'],reconnection:false,autoConnect:false}),errors=[],checks=[];
try{
  await mkdir('.local',{recursive:true});
  await new Promise((resolve,reject)=>{teacher.once('connect',resolve);teacher.once('connect_error',reject);teacher.connect();});
  const made=await teacher.timeout(5000).emitWithAck('room:create',{teacherKey:key,studentAccounts:[{nickname:'백조검사',pin:'1234'}]});
  assert.ok(made.ok);
  const page=await browser.newPage({viewport:{width:1440,height:900}});
  page.on('pageerror',error=>errors.push(error.message));page.setDefaultTimeout(10000);
  await page.goto(url+'/?class='+made.room.code);
  await page.locator('#nickname').fill('백조검사');await page.locator('#student-pin').fill('1234');
  await page.locator('#student-form .submit').click();await page.locator('#lobby').waitFor({state:'hidden'});
  await page.locator('#password-offer-no').click();
  const room=game.store.rooms.get(made.room.code),player=[...room.players.values()].find(p=>p.nickname==='백조검사');
  room.monsters=new Map();
  Object.assign(player,{mapId:'star-origin-1',x:650,y:470,facing:{x:1,y:0},swanAura:null,swanCooldownUntil:0,battleVitals:null});
  Object.assign(player.avatar,{level:4,constellationId:'cygnus'});ensureVitals(player);
  game.io.to(player.socketId).emit('room:state',game.store.snapshot(room,player));
  const sheets=await page.evaluate(async()=>{
    const output=[];
    for(const kind of ['attack','skill-lv2','skill-lv3','skill-lv4']){
      const image=new Image();image.src=`/assets/skills/cygnus/${kind}.png`;await image.decode();
      output.push([kind,image.naturalWidth,image.naturalHeight]);
    }
    return output;
  });
  assert.ok(sheets.every(([,w,h])=>w===1536&&h===1024));
  checks.push('백조자리 24F 시트 4종이 실제 브라우저에서 로드');
  await page.waitForTimeout(200);await page.locator('#world').focus();await page.keyboard.press('e');
  await page.waitForFunction(()=>document.getElementById('world').dataset.swanAuraCount==='1');
  assert.equal(ensureVitals(player).mp,30);
  const first=await page.locator('#world').evaluate(canvas=>canvas.dataset.swanAuraFrame);
  await page.waitForTimeout(150);
  const next=await page.locator('#world').evaluate(canvas=>canvas.dataset.swanAuraFrame);
  assert.notEqual(first,next,'날개 24F가 실제 시간에 따라 진행되어야 해요.');
  await page.screenshot({path:'.local/340-swan-aura.png'});
  checks.push('E키: 마나10 차감·아바타 뒤 날개 표시·24F 실제 진행');
  await page.keyboard.press('q');
  await page.waitForFunction(()=>Number(document.getElementById('world').dataset.projectileCount)>=4);
  assert.equal(player.swanAura.remainingAttacks,9);
  await page.waitForTimeout(130);
  await page.screenshot({path:'.local/340-swan-feathers.png'});
  checks.push('Q키: LV4 강화 깃털 4개·남은 공격9회·실제 맵 재생');
  assert.deepEqual(errors,[]);
  await writeFile('.local/340-swan-browser.json',JSON.stringify({checks,errors},null,2));
  console.log(JSON.stringify({checks,errors},null,2));
}finally{
  teacher.disconnect();await browser.close();await game.close();await rm(dir,{recursive:true,force:true});
}
