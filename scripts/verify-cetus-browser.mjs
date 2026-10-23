import assert from 'node:assert/strict';
import {randomBytes} from 'node:crypto';
import {mkdirSync} from 'node:fs';
import {io as socketClient} from 'socket.io-client';
import {chromium} from 'playwright';
import {createClassroomServer} from '../server/app.js';
import {WHALE_STOMACH_ID} from '../shared/config.js';

const teacherKey=randomBytes(32).toString('hex');
const game=createClassroomServer({teacherKey,studentHours:false,teacherManagedAccounts:false});
const {port}=await game.listen(),url=`http://127.0.0.1:${port}`;
const browser=await chromium.launch({headless:true,args:['--no-proxy-server'],...(process.platform==='win32'?{channel:'msedge'}:{})});
const sockets=[];
const connect=async()=>{
  const socket=socketClient(url,{transports:['websocket'],forceNew:true,reconnection:false});
  sockets.push(socket);
  await new Promise((resolve,reject)=>{socket.once('connect',resolve);socket.once('connect_error',reject);});
  return socket;
};
const call=(socket,event,data={})=>socket.timeout(5000).emitWithAck(event,data);
const ok=result=>{assert.equal(result.ok,true,result.error);return result;};
try{
  const teacher=await connect(),created=ok(await call(teacher,'room:create',{teacherKey,title:'고래자리 화면 검사',allowedNames:['하나','둘']}));
  const code=created.room.code,source=await connect();
  const sourceId=ok(await call(source,'room:join',{code,nickname:'하나',pin:'1234'})).selfId;
  const room=game.store.rooms.get(code),whale=room.players.get(sourceId);
  whale.avatar.constellationId='cetus';whale.avatar.level=4;whale.starShards=10;
  const page=await browser.newPage({viewport:{width:1360,height:900}}),errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  await page.goto(url);await page.locator('#student-tab').click();
  await page.locator('#join-code').fill(code);await page.locator('#nickname').fill('둘');await page.locator('#student-pin').fill('1234');
  await page.locator('#student-form .submit').click();await page.locator('#lobby').waitFor({state:'hidden'});
  if(await page.locator('#tutorial-dialog').evaluate(dialog=>dialog.open))await page.locator('#tutorial-later').click();
  const target=[...room.players.values()].find(player=>player.nickname==='둘');assert(target);
  const invite=ok(await call(source,'constellation-ability:use',{targetId:target.id})).invitation;
  await page.locator('#cetus-hud').waitFor({state:'visible'});
  assert.match(await page.locator('#cetus-hud').innerText(),/고래 배 속 초대/);
  await page.locator('#cetus-hud').getByRole('button',{name:'수락'}).click();
  await page.waitForFunction(()=>document.querySelector('#map-caption')?.textContent?.includes('고래 배 속'));
  assert.equal(target.mapId,WHALE_STOMACH_ID);
  assert.match(await page.locator('#cetus-hud').innerText(),/즉시 탈출하기/);
  mkdirSync('.local',{recursive:true});await page.locator('.map-wrap').screenshot({path:'.local/cetus-stomach-browser.png'});
  await page.locator('#cetus-hud').getByRole('button',{name:'즉시 탈출하기'}).click();
  await page.locator('#cetus-hud').waitFor({state:'hidden'});
  assert.notEqual(target.mapId,WHALE_STOMACH_ID);
  assert.deepEqual(errors,[]);
  console.log('Cetus browser invite, belly, and solo escape: PASS');
}finally{
  sockets.forEach(socket=>socket.disconnect());
  await browser.close();await game.close();
}
