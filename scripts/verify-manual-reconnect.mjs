import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {createClassroomServer} from '../server/app.js';
import {fillNewClass} from './class-setup.mjs';

const key='isolated-manual-reconnect',game=createClassroomServer({teacherKey:key,studentHours:false}),errors=[];
const {port}=await game.listen(),url=`http://127.0.0.1:${port}`;
const browser=await chromium.launch({headless:true,...(process.platform==='win32'?{channel:'msedge'}:{}),args:['--no-proxy-server']});
try{
  const teacher=await browser.newPage();teacher.on('pageerror',error=>errors.push(error.message));
  await teacher.goto(url);await teacher.locator('#teacher-tab').click();await teacher.locator('#teacher-key').fill(key);
  await fillNewClass(teacher,['재접속학생']);await teacher.locator('#teacher-form .submit').click();await teacher.locator('#lobby').waitFor({state:'hidden'});
  for(let attempt=0;attempt<12&&await teacher.locator('dialog[open]').count();attempt++)await teacher.keyboard.press('Escape');
  const code=(await teacher.locator('#room-code').textContent()).trim();
  const student=await browser.newPage();student.on('pageerror',error=>errors.push(error.message));
  await student.addInitScript(()=>{
    let factory;
    Object.defineProperty(window,'io',{configurable:true,get:()=>factory,set:value=>{
      factory=value;
      Object.defineProperty(window,'io',{configurable:true,writable:true,value:(...args)=>{
        const socket=factory(...args),emitWithAck=socket.emitWithAck.bind(socket);
        window.__testReconnectSocket=socket;
        socket.emitWithAck=function(event,...eventArgs){
          if(event==='session:resume'&&window.__busyResumeOnce){
            window.__busyResumeOnce=false;window.__busyResumeAt=performance.now();
            return Promise.resolve({ok:false,error:'요청이 잠시 몰렸어요. 잠시 뒤 다시 시도해주세요.',retryable:true});
          }
          if(event==='session:resume'&&window.__busyResumeAt)window.__busyResumeDelay=performance.now()-window.__busyResumeAt;
          if(event==='session:resume'&&window.__breakResumeOnce){
            const mode=window.__breakResumeOnce,reconnectFirst=mode.startsWith('new-socket');window.__breakResumeOnce=false;
            return emitWithAck(event,...eventArgs).then(reply=>new Promise((resolve,reject)=>{
              socket.disconnect();
              if(reconnectFirst){
                socket.once('connect',()=>mode==='new-socket-success'?resolve(reply):reject(new Error('socket has been disconnected')));
                setTimeout(()=>socket.connect(),30);
              }else reject(new Error('socket has been disconnected'));
            }));
          }
          if(event==='session:resume'&&window.__dropResumeAckOnce){
            window.__dropResumeAckOnce=false;
            return emitWithAck(event,...eventArgs).then(reply=>{
              window.__resumeAckDropped=true;window.__resumeReply=reply;
              return new Promise((resolve,reject)=>setTimeout(()=>reject(new Error('operation has timed out')),6100));
            });
          }
          return emitWithAck(event,...eventArgs);
        };
        return socket;
      }});
    }});
  });
  await student.goto(url);await student.locator('#student-tab').click();await student.locator('#join-code').fill(code);
  await student.locator('#nickname').fill('재접속학생');await student.locator('#student-pin').fill('1234');
  await student.locator('#student-form .submit').click();await student.locator('#lobby').waitFor({state:'hidden'});
  for(let attempt=0;attempt<12&&await student.locator('dialog[open]').count();attempt++)await student.keyboard.press('Escape');
  const room=game.store.rooms.get(code),player=[...room.players.values()].find(value=>value.nickname==='재접속학생');
  assert.equal(await student.locator('#reconnect-overlay').isVisible(),false,'normal connected state has no overlay');
  async function waitForPlayer(predicate,message,timeoutMs=8000){
    const deadline=Date.now()+timeoutMs;
    while(Date.now()<deadline){if(predicate())return;await new Promise(resolve=>setTimeout(resolve,30));}
    throw new Error(message);
  }
  async function forceDisconnectAndResume({dropAck=false,breakAck=false,busyAck=false}={}){
    const socket=game.io.sockets.sockets.get(player.socketId);assert(socket,'student socket should be present');
    const previousSocketId=player.socketId;
    socket.disconnect(true);await student.locator('#reconnect-overlay').waitFor({state:'visible'});
    const button=student.locator('#reconnect-overlay button');
    if(dropAck)await student.evaluate(()=>{window.__dropResumeAckOnce=true;window.__resumeAckDropped=false;window.__resumeReply=null;});
    if(breakAck)await student.evaluate(mode=>{window.__breakResumeOnce=mode;},breakAck);
    if(busyAck)await student.evaluate(()=>{window.__busyResumeOnce=true;window.__busyResumeAt=0;window.__busyResumeDelay=0;});
    await button.click();
    if(dropAck){
      await student.waitForFunction(()=>window.__resumeAckDropped===true,null,{timeout:10000});
      assert.equal(await student.evaluate(()=>window.__resumeReply?.ok),true,'server committed the first resume before its ACK was dropped');
      const firstResumeSocketId=player.socketId;assert.notEqual(firstResumeSocketId,previousSocketId);
      await waitForPlayer(()=>player.connected&&player.socketId!==firstResumeSocketId,'resume did not retry on a fresh transport',12000);
    }
    await student.locator('#reconnect-overlay').waitFor({state:'hidden'});
    assert.equal(await student.locator('#lobby').isVisible(),false,'resume returns to the existing classroom');
    assert.equal(await student.locator('#reconnect-overlay button').isDisabled(),false);
    await waitForPlayer(()=>player.connected&&player.socketId!==previousSocketId,'student session did not resume');
  }
  await forceDisconnectAndResume();
  await forceDisconnectAndResume();
  await forceDisconnectAndResume({dropAck:true});
  await forceDisconnectAndResume({breakAck:'disconnected'});
  await forceDisconnectAndResume({breakAck:'new-socket'});
  await forceDisconnectAndResume({breakAck:'new-socket-success'});
  await forceDisconnectAndResume({busyAck:true});
  assert.ok(await student.evaluate(()=>window.__busyResumeDelay)>=1000,'busy session recovery backs off before retrying');
  game.store.sessions.delete(player.token);
  const socket=game.io.sockets.sockets.get(player.socketId);assert(socket);socket.disconnect(true);
  await student.locator('#reconnect-overlay').waitFor({state:'visible'});await student.locator('#reconnect-overlay button').click();
  await student.locator('#lobby').waitFor({state:'visible'});await student.locator('#form-message').waitFor();
  assert.match(await student.locator('#form-message').textContent(),/연결 시간이 끝났어요|다시 입장해/,'expired token shows a clear login prompt');
  assert.deepEqual(errors,[]);console.log('PASS normal state, manual resume, lost ACK, repeated transport loss, stale ACK after new connection, and expired-token login prompt; JS errors 0');
}finally{await browser.close();await game.close();}
