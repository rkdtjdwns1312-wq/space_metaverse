import assert from 'node:assert/strict';
import {mkdirSync} from 'node:fs';
import {randomBytes} from 'node:crypto';
import {chromium} from 'playwright';
import {io as socketClient} from 'socket.io-client';
import {createClassroomServer} from '../server/app.js';
import {monstersOf} from '../server/monsters.js';

const key=randomBytes(32).toString('hex'),game=createClassroomServer({teacherKey:key,studentHours:false,teacherManagedAccounts:false});
const {port}=await game.listen(),url=`http://127.0.0.1:${port}`;
const browser=await chromium.launch({headless:true,args:['--no-proxy-server'],...(process.platform==='win32'?{channel:'msedge'}:{})});
const errors=[],socket=socketClient(url,{transports:['websocket'],reconnection:false});
mkdirSync('.local',{recursive:true});
try{
 await new Promise((resolve,reject)=>{socket.once('connect',resolve);socket.once('connect_error',reject);});
 const created=await socket.timeout(5000).emitWithAck('room:create',{teacherKey:key,title:'몬스터 화면 검사',allowedNames:['검사별']});assert.equal(created.ok,true);
 const room=game.store.rooms.get(created.room.code),page=await browser.newPage({viewport:{width:1360,height:900}});page.on('pageerror',e=>errors.push(e.message));
 await page.goto(url);await page.locator('#student-tab').click();await page.locator('#join-code').fill(room.code);await page.locator('#nickname').fill('검사별');await page.locator('#student-pin').fill('1234');await page.locator('#student-form .submit').click();await page.locator('#lobby').waitFor({state:'hidden'});
 if(await page.locator('#tutorial-dialog').evaluate(d=>d.open))await page.locator('#tutorial-later').click();
 const player=[...room.players.values()].find(p=>p.nickname==='검사별');assert(player);player.avatar.level=3;player.avatar.constellationId='aquarius';
 const monsters=[...monstersOf(room).values()],baby=monsters.find(m=>m.typeId==='baby-energy-star');assert(baby);
 for(const m of monsters){m.attackers.clear();Object.assign(m,{dx:0,dy:0,nextDirectionAt:Date.now()+60000,patrolStartedAt:Date.now()+60000});}
 Object.assign(player,{mapId:baby.mapId,x:baby.x-baby.radius-40,y:baby.y,facing:{x:1,y:0},battleVitals:null});
 game.io.to(player.socketId).emit('room:state',game.store.snapshot(room,player));
 await page.waitForFunction(()=>document.querySelector('#minimap-title')?.textContent.includes('낙원의 갈림길'));
 await page.evaluate(async()=>{const {preloadMonsterAttack}=await import('/monster-attack-frames.js');await preloadMonsterAttack('baby-energy-star');});
 await page.locator('#world').focus();await page.keyboard.press('q');
 await page.waitForFunction(()=>document.querySelector('#world').dataset.lastMonsterEffect==='baby-energy-star');
 assert(baby.hp<baby.maxHp);assert(player.battleVitals.hp<player.battleVitals.maxHp||player.battleVitals.hp<40);
 await page.screenshot({path:'.local/baby-star-crossroads.png'});
 const gallery=await browser.newPage({viewport:{width:1440,height:1150}});gallery.on('pageerror',e=>errors.push(e.message));await gallery.goto(url+'/health');
 const result=await gallery.evaluate(async()=>{
  const {MONSTER_TYPES}=await import('/shared/monsters.js');
  const painted=await import('/monster-attack-frames.js'),lv2=await import('/lv2-monster-art.js'),sun=await import('/sun-monster-art.js'),celestial=await import('/celestial-monster-art.js'),boss=await import('/boss-monster-art.js');
  const {drawBabyStar}=await import('/baby-star-art.js'),{drawWaterMonster}=await import('/water-monster-art.js');
  await painted.preloadMonsterAttack();await celestial.preloadCelestialArt();await boss.preloadBossArt();await boss.preloadBossArt('serena');
  for(const src of [...Object.values(lv2.LV2_MONSTER_ART),...Object.values(sun.SUN_MONSTER_ART)].map(a=>a.src)){const im=new Image();im.src=src;await im.decode();}
  const drawers=[boss.drawBossMonster,drawBabyStar,celestial.drawCelestialMonster,sun.drawSunMonster,lv2.drawLv2Monster,drawWaterMonster];
  const probe=document.createElement('canvas');probe.width=probe.height=300;const pc=probe.getContext('2d');
  const draw=(ctx,m,time,attack)=>drawers.some(fn=>fn(ctx,m,time,attack));
  for(const m of MONSTER_TYPES)draw(pc,{...m,x:150,y:160,radius:35,facingX:1},0,null);
  await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
  const checks=[];
  for(const m of MONSTER_TYPES){
   const duration=['serena','spirit-king'].includes(m.id)?800:600;
   const samples=[];for(const time of [30,90,150,215,295,390,475,560]){pc.clearRect(0,0,300,300);assertDraw(draw(pc,{...m,x:150,y:160,radius:35,facingX:1},time*duration/600,{startedAt:0,durationMs:duration,dx:1,dy:0,reach:40}),m.id);samples.push(probe.toDataURL());}
   checks.push({id:m.id,distinct:new Set(samples).size});
  }
  function assertDraw(ok,id){if(!ok)throw Error('not loaded '+id);}
  const alpha=[];
  for(const [id,art]of Object.entries(painted.MONSTER_ATTACK_ART)){
   const im=painted.paintedMonsterImage(id),c=document.createElement('canvas');c.width=im.width;c.height=im.height;const ctx=c.getContext('2d');ctx.drawImage(im,0,0);const p=ctx.getImageData(0,0,c.width,c.height).data;let clear=0;for(let i=3;i<p.length;i+=4)if(p[i]===0)clear++;
   const sourceFrames=[];for(let i=0;i<8;i++){pc.clearRect(0,0,300,300);painted.drawPaintedMonsterFrame(pc,id,i,35,150,230);sourceFrames.push(probe.toDataURL());}
   alpha.push({id,clear:clear/(c.width*c.height),corner:p[3],distinct:new Set(sourceFrames).size});
  }
  document.body.replaceChildren();document.body.style.cssText='margin:0;background:#20263b';
  const c=document.createElement('canvas');c.width=1440;c.height=1150;document.body.append(c);const ctx=c.getContext('2d');
  window.renderMonsterGallery=group=>{ctx.fillStyle='#20263b';ctx.fillRect(0,0,c.width,c.height);for(let row=0;row<5;row++){
   const m=MONSTER_TYPES[group*5+row];for(let col=0;col<6;col++){const time=[0,150,250,340,480,590][col],x=120+col*240,y=row*230+160;
    ctx.fillStyle='#fff8e8';ctx.font='15px sans-serif';ctx.textAlign='center';ctx.fillText(m.name+' · '+['대기','준비','전진','타격','복귀','마무리'][col],x,row*230+24);
    const duration=['serena','spirit-king'].includes(m.id)?800:600;
    draw(ctx,{...m,x,y,radius:42,facingX:col===5?-1:1,moving:false},time*duration/600,col?{startedAt:0,durationMs:duration,dx:col===5?-1:1,dy:0,reach:45}:null);
   }
  }};
  return {checks,alpha};
 });
 assert.equal(result.checks.length,15);for(const row of result.checks)assert(row.distinct>=3,JSON.stringify(row));
 // Generated transparent PNGs may retain imperceptible 1/255 alpha at an edge.
 for(const row of result.alpha){assert(row.corner<=2,row.id);assert(row.clear>.35,row.id);assert.equal(row.distinct,8,row.id);}
 for(let group=0;group<3;group++){await gallery.evaluate(g=>window.renderMonsterGallery(g),group);await gallery.screenshot({path:`.local/monster-attacks-${group+1}.png`});}
 assert.deepEqual(errors,[]);console.log(JSON.stringify({result,errors,game:'baby Q hit and counter PASS'},null,2));
}finally{socket.disconnect();await browser.close();await game.close();}
