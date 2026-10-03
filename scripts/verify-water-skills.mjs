// 격리 교실에서 세 별자리 24F 파일 로드·키 입력·실제 맵 그리기를 확인합니다.
import assert from 'node:assert/strict';
import {randomBytes} from 'node:crypto';
import {mkdir,mkdtemp,rm,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {chromium} from 'playwright';
import {io} from 'socket.io-client';
import {createClassroomServer} from '../server/app.js';
import {ensureVitals} from '../server/vitals.js';

const dir=await mkdtemp(join(tmpdir(),'water-vfx-'));
const key=randomBytes(24).toString('hex'),game=createClassroomServer({teacherKey:key,studentHours:false,dataDir:dir});
const {port}=await game.listen(),url=`http://127.0.0.1:${port}`;
const browser=await chromium.launch({headless:true,args:['--no-proxy-server'],...(process.platform==='win32'?{channel:'msedge'}:{})});
const teacher=io(url,{transports:['websocket'],reconnection:false,autoConnect:false}),errors=[],checks=[];
try{
  await mkdir('.local',{recursive:true});
  await new Promise((resolve,reject)=>{teacher.once('connect',resolve);teacher.once('connect_error',reject);teacher.connect();});
  const made=await teacher.timeout(5000).emitWithAck('room:create',{teacherKey:key,studentAccounts:[{nickname:'물빛검사',pin:'1234'}]});
  assert.ok(made.ok);
  const page=await browser.newPage({viewport:{width:1440,height:900}});
  page.on('pageerror',error=>errors.push(error.message));page.setDefaultTimeout(10000);
  await page.goto(url+'/?class='+made.room.code);
  await page.locator('#nickname').fill('물빛검사');await page.locator('#student-pin').fill('1234');
  await page.locator('#student-form .submit').click();await page.locator('#lobby').waitFor({state:'hidden'});
  await page.locator('#password-offer-no').click();
  const room=game.store.rooms.get(made.room.code),player=[...room.players.values()].find(p=>p.nickname==='물빛검사');
  room.monsters=new Map();
  const publish=()=>game.io.to(player.socketId).emit('room:state',game.store.snapshot(room,player));
  const sources=await page.evaluate(async()=>{
    const output=[];
    for(const star of ['cancer','cetus','pisces'])for(const kind of ['attack','skill-lv2','skill-lv3','skill-lv4']){
      const image=new Image();image.src=`/assets/skills/${star}/${kind}.png`;await image.decode();
      output.push([star,kind,image.naturalWidth,image.naturalHeight]);
    }
    return output;
  });
  assert.equal(sources.length,12);assert.ok(sources.every(row=>row[2]===1536&&row[3]===1024));
  checks.push('세 별자리 시트 12종이 실제 브라우저에서 1536×1024로 로드');
  for(const star of ['cancer','cetus','pisces']){
    Object.assign(player,{mapId:'star-origin-1',x:650,y:470,facing:{x:1,y:0},waterCooldownUntil:0,waterAura:null,battleVitals:null});
    Object.assign(player.avatar,{level:4,constellationId:star});ensureVitals(player);publish();
    await page.waitForTimeout(180);await page.locator('#world').focus();
    if(star==='pisces')await page.evaluate(()=>{
      window.__fishFrames=[];
      const trace=()=>{
        const canvas=document.getElementById('world');
        if(Number(canvas.dataset.projectileCount)>0)window.__fishFrames.push({x:Number(canvas.dataset.projectileX),y:Number(canvas.dataset.projectileY)});
        if(window.__fishFrames.length<90)requestAnimationFrame(trace);
      };
      requestAnimationFrame(trace);
    });
    await page.keyboard.press('e');
    if(star==='pisces')await page.waitForFunction(()=>Number(document.getElementById('world').dataset.projectileCount)>0);
    else await page.waitForFunction(kind=>document.getElementById('world').dataset.waterAuraKind===kind,star);
    await page.waitForTimeout(star==='pisces'?150:400);
    await page.screenshot({path:`.local/337-${star}-skill.png`});
    if(star==='pisces'){
      await page.waitForTimeout(700);
      const frames=await page.evaluate(()=>window.__fishFrames);
      const unique=frames.filter((point,index)=>index===0||point.x!==frames[index-1].x);
      assert.ok(unique.length>=10,'물고기가 여러 프레임에 걸쳐 움직여야 해요.');
      assert.ok(unique.at(-1).x-unique[0].x>200,'물고기가 앞으로 전진해야 해요.');
      const peak=Math.min(...unique.map(point=>point.y));
      assert.ok(peak<unique[0].y-20&&peak<unique.at(-1).y-20,
        `물고기가 떠올랐다 내려와야 해요: 처음 ${unique[0].y}, 최고 ${peak}, 마지막 ${unique.at(-1).y}`);
      checks.push('물고기 투사체 실제 재생: 전진·상승·하강 위치를 3시점 비교');
    }
    assert.equal(ensureVitals(player).mp,star==='pisces'?25:20);
    checks.push(`${star} E키·마나 차감·맵 이펙트 표시`);
    // 다음 별자리 전에 1초 Q 간격을 확보합니다.
    await page.waitForTimeout(1050);
    await page.keyboard.press('q');
    await page.waitForFunction(()=>Number(document.getElementById('world').dataset.projectileCount)>0);
    await page.screenshot({path:`.local/337-${star}-attack.png`});
    checks.push(`${star} Q키·투사체 실제 재생`);
    await page.waitForTimeout(850);
  }
  assert.deepEqual(errors,[]);
  await writeFile('.local/337-water-browser.json',JSON.stringify({checks,errors},null,2));
  console.log(JSON.stringify({checks,errors},null,2));
}finally{
  teacher.disconnect();await browser.close();await game.close();await rm(dir,{recursive:true,force:true});
}
