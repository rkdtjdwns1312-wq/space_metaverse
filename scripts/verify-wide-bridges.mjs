import assert from 'node:assert/strict';
import {randomBytes} from 'node:crypto';
import {mkdir} from 'node:fs/promises';
import {chromium} from 'playwright';
import {io} from 'socket.io-client';
import {createClassroomServer} from '../server/app.js';
import {STATIC_MAPS} from '../shared/config.js';
import {PLAZA_LAYOUT as P} from '../shared/plaza-layout.js';
import {VALLEY_LAYOUT as V} from '../shared/valley-layout.js';
import {avatarFitsFloor} from '../shared/avatar-boundary.js';

const key=randomBytes(24).toString('hex'),game=createClassroomServer({teacherKey:key,studentHours:false});
const url='http://127.0.0.1:'+(await game.listen()).port;
const browser=await chromium.launch({headless:true,args:['--no-proxy-server'],...(process.platform==='win32'?{channel:'msedge'}:{})});
const teacher=io(url,{transports:['websocket'],reconnection:false,autoConnect:false});
const page=await browser.newPage({viewport:{width:1440,height:960}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
const interpolate=(a,b,t)=>({x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t});
try{
  await new Promise((r,j)=>{teacher.once('connect',r);teacher.once('connect_error',j);teacher.connect();});
  const made=await teacher.timeout(5000).emitWithAck('room:create',{teacherKey:key,allowedNames:['길목검사']});assert.equal(made.ok,true);
  await page.goto(url);await page.locator('#join-code').fill(made.room.code);await page.locator('#nickname').fill('길목검사');
  await page.locator('#student-pin').fill('1234');await page.locator('#student-form .submit').click();await page.locator('#lobby').waitFor({state:'hidden'});
  const room=game.store.rooms.get(made.room.code),p=[...room.players.values()].find(p=>p.role==='student');
  Object.assign(p.avatar,{level:5,constellationId:'sagittarius'});
  const routes=[...P.islands.map(z=>({id:'space-plaza',a:P.center,b:z,start:.35,end:.83,name:z.id})),
    {id:'milky-valley',a:V.center,b:V.temples[1],start:.15,end:.78,name:'growth'},
    {id:'star-street',a:{x:900,y:650},b:{x:900,y:1550},start:.42,end:.78,name:'playground'},
    {id:'moon-garden',a:{x:900,y:570},b:{x:900,y:120},start:.30,end:.83,name:'paradise'},
    {id:'star-origin-1',a:{x:600,y:450},b:{x:600,y:80},start:.25,end:.88,name:'origin'}];
  await mkdir('.local',{recursive:true});
  for(const [i,r] of routes.entries()){
    Object.assign(p,{mapId:r.id,...interpolate(r.a,r.b,r.start),input:{x:0,y:0,at:0}});
    game.io.to(p.socketId).emit('room:state',game.store.snapshot(room,p));
    await page.waitForFunction(id=>document.querySelector('#minimap').dataset.mapId===id,r.id);
    await page.waitForTimeout(180);
    const to=interpolate(r.a,r.b,r.end),box=await page.locator('#joystick').boundingBox(),cx=box.x+box.width/2,cy=box.y+box.height/2;
    await page.mouse.move(cx,cy);await page.mouse.down();const deadline=Date.now()+7000;
    try{
      while(Math.hypot(p.x-to.x,p.y-to.y)>20&&Date.now()<deadline){
        const dx=to.x-p.x,dy=to.y-p.y,d=Math.hypot(dx,dy);
        await page.mouse.move(cx+dx/d*40,cy+dy/d*40);await page.waitForTimeout(45);
        assert.ok(avatarFitsFloor(STATIC_MAPS[r.id],p.x,p.y,p),r.name+' 몸 전체가 바닥 안');
      }
    }finally{await page.mouse.up();}
    assert.ok(Math.hypot(p.x-to.x,p.y-to.y)<35,r.name+' LV5 통과');
    await page.waitForTimeout(140);await page.screenshot({path:`.local/287-${r.name}.png`});
    console.log(`Wide bridge ${i+1}: ${r.name} LV5 조이스틱 통행`);
  }
  await page.locator('#world').focus();await page.keyboard.press('f');
  await page.waitForFunction(()=>document.querySelector('#minimap').dataset.mapId==='star-origin-2');
  assert.equal(p.mapId,'star-origin-2');console.log('Wide bridge 9: LV5 게이트 F 실제 맵 이동');
  assert.deepEqual(errors,[]);console.log('PASS 9, 브라우저 오류0');
}finally{teacher.disconnect();await browser.close();await game.close();}
