import {chromium} from 'playwright';
import {io} from 'socket.io-client';
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {createClassroomServer} from '../server/app.js';
import {SKILL_EFFECTS} from '../shared/skill-effects.js';
const game=createClassroomServer({teacherKey:'effects-browser-key',studentHours:false});
const {port}=await game.listen(),url='http://127.0.0.1:'+port;
const browser=await chromium.launch({headless:true,...(process.platform==='win32'?{channel:'msedge'}:{})});
const errors=[],checks=[];const check=text=>{checks.push(text);console.log(text);};
const socket=io(url,{transports:['websocket'],reconnection:false});
await mkdir('.local',{recursive:true});
try{
 const page=await browser.newPage({viewport:{width:1440,height:1000}});page.on('pageerror',e=>errors.push(e.message));
 await page.goto(url+'/skill-effects-gallery.html');await page.locator('.effect-card').last().waitFor();
 assert.equal(await page.locator('.effect-card').count(),64);assert.equal(await page.locator('.constellation-row').count(),16);check('16별자리×4단계 미리보기 64칸');
 await page.locator('#pause-all').click();const canvas=page.locator('.effect-card canvas').first();
 const initial=await canvas.getAttribute('data-progress');await page.waitForTimeout(120);assert.equal(await canvas.getAttribute('data-progress'),initial);
 await page.locator('.play-one').first().click();await page.waitForTimeout(130);assert.notEqual(await canvas.getAttribute('data-progress'),initial);check('전체정지·선택한카드만 재생');
 const renders=await page.evaluate(async()=>{
  const {SKILL_EFFECTS}=await import('/shared/skill-effects.js');const {drawSkillEffect}=await import('/skill-effects.js');
  const c=document.createElement('canvas');c.width=320;c.height=230;const ctx=c.getContext('2d');
  return SKILL_EFFECTS.map(effect=>[.25,.55,.8].map(p=>{ctx.clearRect(0,0,320,230);ctx.save();ctx.translate(80,115);drawSkillEffect(ctx,effect,p);ctx.restore();const pixels=ctx.getImageData(0,0,320,230).data;let count=0;for(let i=3;i<pixels.length;i+=4)if(pixels[i])count++;return {count,data:c.toDataURL()};}));
 });
 assert.ok(renders.flat().every(r=>r.count>60));const hashes=renders.map(frames=>createHash('sha256').update(frames[1].data).digest('hex'));assert.equal(new Set(hashes).size,64);
 assert.ok(renders.every(frames=>frames[0].data!==frames[2].data));check('192프레임 실렌더·64개고유모양·시간별움직임');
 for(let group=0;group<4;group++){
  const png=await page.evaluate(async group=>{
   const {SKILL_EFFECTS}=await import('/shared/skill-effects.js');const {drawSkillEffect}=await import('/skill-effects.js');
   const c=document.createElement('canvas');c.width=1280;c.height=1040;const ctx=c.getContext('2d');ctx.fillStyle='#252942';ctx.fillRect(0,0,c.width,c.height);
   SKILL_EFFECTS.slice(group*16,group*16+16).forEach((effect,i)=>{const x=(i%4)*320,y=Math.floor(i/4)*260;ctx.save();ctx.translate(x+65,y+135);drawSkillEffect(ctx,effect,.55);ctx.restore();ctx.fillStyle='#f4e9ff';ctx.font='17px sans-serif';ctx.fillText(effect.constellationName+' · LV'+effect.level,x+18,y+29);ctx.fillStyle='#b7b4ce';ctx.font='13px sans-serif';ctx.fillText(effect.name,x+18,y+240);});return c.toDataURL().split(',')[1];
  },group);await writeFile('.local/skill-effects-sheet-'+(group+1)+'.png',Buffer.from(png,'base64'));
 }
 await page.emulateMedia({reducedMotion:'reduce'});await page.waitForFunction(()=>document.querySelector('#reduced-motion').checked);await page.setViewportSize({width:390,height:844});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));check('움직임줄이기·390px가로넘침없음');
 await new Promise((r,j)=>{if(socket.connected)return r();socket.once('connect',r);socket.once('connect_error',j);});
 const created=await socket.timeout(5000).emitWithAck('room:create',{teacherKey:'effects-browser-key',allowedNames:['연습']});
 await page.goto(url);await page.locator('#join-code').fill(created.room.code);await page.locator('#nickname').fill('연습');await page.locator('#student-pin').fill('1234');await page.locator('#student-form .submit').click();await page.locator('#lobby').waitFor({state:'hidden'});
 const room=game.store.rooms.get(created.room.code),p=[...room.players.values()].find(p=>p.role==='student');
 await page.emulateMedia({reducedMotion:'no-preference'});
 for(const effect of SKILL_EFFECTS.filter((e,i)=>i%7===0)){
  p.avatar.level=effect.level;p.avatar.constellationId=effect.constellationId;p.facing={x:-1,y:0};game.io.to(p.socketId).emit('room:state',game.store.snapshot(room,p));await page.waitForTimeout(500);await page.locator('#world').focus();await page.keyboard.press('e');
  await page.waitForFunction(id=>document.getElementById('world').dataset.lastSkillEffect===id,effect.id);assert.equal(await page.locator('#world').getAttribute('data-last-skill-dx'),'-1');
 }
 check('10종실제E키·서버별자리연출·최근방향반영');
 assert.deepEqual(errors,[]);await writeFile('.local/skill-effects-result.json',JSON.stringify({checks,errors},null,2));
}finally{socket.disconnect();await browser.close();await game.close();}
