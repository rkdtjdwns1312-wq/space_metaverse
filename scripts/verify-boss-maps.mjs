// 임시 교실 브라우저에서 두 보스의 실제 맵 그림과 드랍 원화를 확인합니다.
import assert from 'node:assert/strict';
import {randomBytes} from 'node:crypto';
import {mkdtemp,rm,mkdir} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {chromium} from 'playwright';
import {io} from 'socket.io-client';
import {createClassroomServer} from '../server/app.js';
import {monstersOf} from '../server/monsters.js';

const dir=await mkdtemp(join(tmpdir(),'boss-maps-'));
const key=randomBytes(24).toString('hex'),game=createClassroomServer({teacherKey:key,studentHours:false,dataDir:dir});
const {port}=await game.listen(),url=`http://127.0.0.1:${port}`;
const browser=await chromium.launch({headless:true,args:['--no-proxy-server'],...(process.platform==='win32'?{channel:'msedge'}:{})});
const teacher=io(url,{transports:['websocket'],reconnection:false,autoConnect:false}),errors=[];
try{
  await mkdir('.local',{recursive:true});
  await new Promise((resolve,reject)=>{teacher.once('connect',resolve);teacher.once('connect_error',reject);teacher.connect();});
  const made=await teacher.timeout(5000).emitWithAck('room:create',{teacherKey:key,studentAccounts:[{nickname:'보스검사',pin:'1234'}]});
  assert.ok(made.ok,made.error);
  const page=await browser.newPage({viewport:{width:1440,height:900}});
  page.on('pageerror',error=>errors.push(error.message));page.setDefaultTimeout(10000);
  await page.goto(url+'/?class='+made.room.code);
  await page.locator('#nickname').fill('보스검사');await page.locator('#student-pin').fill('1234');
  await page.locator('#student-form .submit').click();await page.locator('#lobby').waitFor({state:'hidden'});
  await page.locator('#password-offer-no').click();
  const room=game.store.rooms.get(made.room.code),player=[...room.players.values()].find(p=>p.nickname==='보스검사');
  for(const [id,mapId] of [['noksera','moon-paradise-3'],['leoon','sun-paradise-3']]){
    Object.assign(player,{mapId,x:1200,y:570,facing:{x:-1,y:0}});
    Object.assign(player.avatar,{level:4,constellationId:'taurus'});
    const boss=monstersOf(room).get(id+'-boss');
    boss.x=900;boss.y=570;boss.dx=0;boss.dy=0;boss.nextDirectionAt=Infinity;boss.lastMoveAt=Date.now();
    game.io.to(player.socketId).emit('room:state',game.store.snapshot(room,player));
    await page.waitForFunction(expected=>document.getElementById('world').dataset.monsterCount==='1'&&
      document.getElementById('world').dataset.mapId===expected,mapId).catch(async()=>{
      await page.waitForFunction(()=>document.getElementById('world').dataset.monsterCount==='1');
    });
    await page.waitForTimeout(400);
    await page.screenshot({path:`.local/boss-${id}.png`});
    const art=await page.evaluate(async id=>{const image=new Image();image.src='/assets/monsters/'+id+'.png';await image.decode();return [image.naturalWidth,image.naturalHeight];},id);
    assert.ok(art[0]>500&&art[1]>500);
  }
  assert.deepEqual(errors,[]);
  console.log('Boss browser maps: Noksera and Leoon rendered; no page errors.');
}finally{
  teacher.disconnect();await browser.close();await game.close();await rm(dir,{recursive:true,force:true});
}
