import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {chromium} from 'playwright';
import {createClassroomServer} from '../server/app.js';
import {fillNewClass} from './class-setup.mjs';
import {BOSS_DIALOGUES} from '../shared/boss-dialogues.js';
import {monstersOf,damageMonster} from '../server/monsters.js';
import {castWater} from '../server/water-skills.js';
const out='.local/577-579-visuals';await mkdir(out,{recursive:true});
const game=createClassroomServer({teacherKey:'dialogue-check-local',studentHours:false});let browser;
try{
 const {port}=await game.listen();browser=await chromium.launch({headless:true,channel:'msedge',args:['--no-proxy-server']});
 const page=await browser.newPage({viewport:{width:1200,height:900}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(`http://127.0.0.1:${port}`);
 const visuals=await page.evaluate(async()=>{
  const {TRANSCENDENT_STARS,drawTranscendentStars}=await import('/transcendent-stars.js');
  const {drawPiscesBullet,preloadPiscesBullet}=await import('/pisces-bullet.js');
  await preloadPiscesBullet().decode();
  const make=(w,h)=>Object.assign(document.createElement('canvas'),{width:w,height:h});
  const load=async src=>{const im=new Image();im.src=src;await im.decode();return im;};
  const sheet=make(1000,1000),ctx=sheet.getContext('2d');ctx.fillStyle='#152442';ctx.fillRect(0,0,1000,1000);
  const samples=[];let n=0;
  for(const id of Object.keys(TRANSCENDENT_STARS)){
   const im=await load(`/assets/avatars/celestial/${id}.png`),c=make(240,240),cc=c.getContext('2d');cc.translate(120,120);
   const render=(t,reduced)=>{cc.clearRect(-120,-120,240,240);cc.drawImage(im,-115,-115,230,230);drawTranscendentStars(cc,id,230,t,reduced,im);return c.toDataURL();};
   const a=render(100,false),b=render(3300,false),r1=render(100,true),r2=render(3300,true);render(1500,false);
   samples.push({id,changes:a!==b,reducedStable:r1===r2});ctx.drawImage(c,n%4*250,Math.floor(n/4)*250);ctx.fillStyle='white';ctx.font='16px sans-serif';ctx.fillText(id,n%4*250+10,Math.floor(n/4)*250+242);n++;
  }
  const fish=make(900,420),fc=fish.getContext('2d');fc.fillStyle='#192e4a';fc.fillRect(0,0,900,420);
  const shapes=[];
  for(const level of [2,3,4]){
   const cast={level,size:110,x:0,y:0,dx:1,dy:0,durationMs:650};
   const probe=make(180,180),pc=probe.getContext('2d');pc.translate(90,90);
   const pixels=(ms,dx=1)=>{pc.clearRect(-90,-90,180,180);drawPiscesBullet(pc,{...cast,dx},ms);return pc.getImageData(0,0,180,180).data;};
   const start=pixels(0),mid=pixels(325),end=pixels(650),left=pixels(325,-1);
   let mirrorErrors=0;for(let y=0;y<180;y++)for(let x=0;x<180;x++)mirrorErrors+=Math.abs(mid[(y*180+x)*4+3]-left[(y*180+179-x)*4+3]);mirrorErrors/=180*180;
   shapes.push({level,emptyStart:start.every((v,i)=>i%4!==3||v===0),emptyEnd:end.every((v,i)=>i%4!==3||v===0),area:mid.filter((v,i)=>i%4===3&&v>50).length,mirrorErrors});
   for(const [row,dx] of [[0,1],[1,-1]]){fc.save();fc.translate((level-2)*300+150,100+row*190);drawPiscesBullet(fc,{...cast,dx},325);fc.restore();}
   fc.fillStyle='white';fc.font='20px sans-serif';fc.fillText(`Lv${level}`,(level-2)*300+125,400);
  }
  return {samples,shapes,stars:sheet.toDataURL(),fish:fish.toDataURL()};
 });
 for(const key of ['stars','fish']){await writeFile(`${out}/${key}.png`,Buffer.from(visuals[key].split(',')[1],'base64'));delete visuals[key];}
 assert.equal(visuals.samples.length,16);assert(visuals.samples.every(s=>s.changes&&s.reducedStable));
 await writeFile(`${out}/pixel-checks.json`,JSON.stringify(visuals,null,2));
 assert(visuals.shapes.every(s=>s.emptyStart&&s.emptyEnd&&s.mirrorErrors<2));assert(visuals.shapes[0].area<visuals.shapes[1].area&&visuals.shapes[1].area<visuals.shapes[2].area);
 await page.locator('#teacher-tab').click();await page.locator('#teacher-key').fill('dialogue-check-local');await fillNewClass(page,['검사']);await page.locator('#teacher-form .submit').click();await page.locator('#lobby').waitFor({state:'hidden'});
 const room=[...game.store.rooms.values()][0],p=[...room.players.values()].find(p=>p.role==='teacher');
 const publish=()=>game.io.to(p.socketId).emit('room:state',game.store.snapshot(room,p));
 const boss=[...monstersOf(room).values()].find(m=>m.typeId==='leoon');Object.assign(p,{mapId:boss.mapId,x:boss.x+130,y:boss.y});publish();
 damageMonster(room,boss,p,100000,Date.now());await page.locator('#boss-dialogue').waitFor({state:'visible'});
 for(const [bossId,entry] of Object.entries(BOSS_DIALOGUES)){
  if(bossId!=='leoon')game.io.to(p.socketId).emit('combat:boss-defeated',{id:bossId+'-visual',bossId,mapId:p.mapId});
  await page.locator('#boss-dialogue').waitFor({state:'visible'});
  await page.waitForFunction(name=>document.querySelector('#boss-dialogue-name').textContent===name,entry.name);
  await page.waitForTimeout(180);await page.screenshot({path:`${out}/${bossId}.png`});
  for(let i=0;i<entry.lines.length;i++){assert.equal(await page.locator('.boss-dialogue-line').textContent(),entry.lines[i]);await page.locator('#boss-dialogue button').click();}
  await page.locator('#boss-dialogue').waitFor({state:'hidden'});
 }
 const event={id:'duplicate-probe',bossId:'serena',mapId:p.mapId};game.io.to(p.socketId).emit('combat:boss-defeated',event);game.io.to(p.socketId).emit('combat:boss-defeated',event);
 await page.locator('#boss-dialogue').waitFor({state:'visible'});await page.setViewportSize({width:390,height:844});await page.screenshot({path:`${out}/mobile.png`});
 const bounds=await page.locator('#boss-dialogue').boundingBox();assert(bounds.x>=0&&bounds.x+bounds.width<=391);
 Object.assign(p,{mapId:'space-plaza',x:600,y:500});publish();await page.locator('#boss-dialogue').waitFor({state:'hidden'});
 game.io.to(p.socketId).emit('combat:boss-defeated',event);await page.waitForTimeout(100);assert.equal(await page.locator('#boss-dialogue').isVisible(),false);
 await page.setViewportSize({width:1200,height:900});
 for(const level of [2,3,4]){
  Object.assign(p.avatar,{level,constellationId:'pisces',teacherPreview:true});p.facing={x:1,y:0};publish();
  const result=castWater(room,p,Date.now(),{basic:true});assert.equal(result.hit.projectiles[0].level,level);game.io.to(p.socketId).emit('combat:hit',result.hit);await page.waitForTimeout(260);await page.screenshot({path:`${out}/fish-game-${level}.png`});
  p.waterCooldownUntil=0;const e=castWater(room,p,Date.now());game.io.to(p.socketId).emit('combat:hit',e.hit);await page.waitForTimeout(level===2?1350:850);await page.screenshot({path:`${out}/portal-game-${level}.png`});assert(Number(await page.locator('#world').getAttribute('data-projectile-count'))>0);await page.waitForTimeout(1300);
 }
 assert.deepEqual(errors,[]);await writeFile(`${out}/results.json`,JSON.stringify({visuals,dialogues:4,mapExit:true,errors},null,2));console.log(JSON.stringify({stars:16,fish:visuals.shapes,dialogues:4,mapExit:true,errors}));
}finally{await browser?.close();await game.close();}
