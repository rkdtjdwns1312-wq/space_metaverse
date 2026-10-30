import assert from 'node:assert/strict';
import {mkdirSync} from 'node:fs';
import {chromium} from 'playwright';
import {createClassroomServer} from '../server/app.js';
import {fillNewClass} from './class-setup.mjs';
import {STREET,STREET_ID} from '../shared/config.js';
import {cozyRewardUnit} from '../shared/cozy-activities.js';

let now=Date.now();
const key='isolated-cozy-activities',game=createClassroomServer({teacherKey:key,studentHours:false,clock:()=>now}),errors=[],checks=[];
const {port}=await game.listen(),browser=await chromium.launch({headless:true,channel:'msedge',args:['--no-proxy-server']});
mkdirSync('.local/cozy-activities',{recursive:true});
const check=label=>checks.push(label);
const assertDialogFits=async(page,label)=>{const box=await page.locator('.cozy-dialog').evaluate(el=>({client:el.clientWidth,scroll:el.scrollWidth}));assert.ok(box.scroll<=box.client+1,`${label} dialog horizontal overflow: ${JSON.stringify(box)}`);};
const capture=async(page,path)=>{await page.locator('.cozy-dialog').evaluate(el=>{el.scrollTop=0;});await page.screenshot({path,fullPage:true});};
try{
 const teacherContext=await browser.newContext({viewport:{width:1280,height:900}}),studentContext=await browser.newContext({viewport:{width:1280,height:900}}),teacher=await teacherContext.newPage(),page=await studentContext.newPage();for(const p of [teacher,page]){p.on('pageerror',e=>errors.push(e.message));p.on('console',m=>{if(m.type()==='error'&&/content security policy|refused to apply inline style|violat(?:e|ion).*csp/i.test(m.text()))errors.push(`CSP: ${m.text()}`);});}
 await teacher.goto(`http://127.0.0.1:${port}`);await teacher.locator('#connection').filter({hasText:'연결되었어요'}).waitFor({state:'attached'});await teacher.locator('#teacher-tab').click();await teacher.locator('#teacher-key').fill(key);await fillNewClass(teacher,['학생1']);await teacher.locator('#teacher-form .submit').click();await teacher.locator('#lobby').waitFor({state:'hidden'});
 for(let n=0;n<12&&await teacher.locator('dialog[open]').count();n++)await teacher.keyboard.press('Escape');
 const code=await teacher.locator('#room-code').textContent(),room=game.store.rooms.get(code),teacherPlayer=[...room.players.values()].find(p=>p.role==='teacher');
 await page.goto(`http://127.0.0.1:${port}`);await page.locator('#connection').filter({hasText:'연결되었어요'}).waitFor({state:'attached'});await page.locator('#student-tab').click();await page.locator('#join-code').fill(code);await page.locator('#nickname').fill('학생1');await page.locator('#student-pin').fill('1234');await page.locator('#student-form .submit').click();await page.locator('#lobby').waitFor({state:'hidden'});for(let n=0;n<12&&await page.locator('dialog[open]').count();n++)await page.keyboard.press('Escape');
 const player=[...room.players.values()].find(p=>p.role==='student'),startEnergy=player.cosmicEnergy,unit=cozyRewardUnit(player.avatar?.level);
 const moveTo=async(who,tab,kind)=>{const prop=STREET.objects.find(o=>o.kind===`cozy-${kind}`);assert.ok(prop,`missing cozy-${kind} street prop`);Object.assign(who,{mapId:STREET_ID,x:prop.x,y:prop.y,input:{x:0,y:0,at:0}});game.io.to(who.socketId).emit('room:state',game.store.snapshot(room,who,now));await tab.waitForFunction(()=>!document.querySelector('#interact-prompt').hidden);};
 const at=async(kind)=>{await moveTo(player,page,kind);await page.locator('#interact-prompt').click();await page.locator('.cozy-dialog[open]').waitFor();await page.waitForFunction(()=>{const img=document.querySelector('.cozy-hero img');return img?.complete&&img.naturalWidth>0;});await assertDialogFits(page,kind+' desktop');};



 Object.assign(player.avatar,{level:4,constellationId:'hercules'});Object.assign(player,{mapId:STREET_ID,x:1800,y:1320,facing:{x:-1,y:0},battleVitals:null});game.io.to(player.socketId).emit('room:state',game.store.snapshot(room,player,Date.now()));
 await page.waitForFunction(()=>document.querySelector('#self-skill-slots [data-slot=skill]')?.getAttribute('aria-label')?.includes('수호'));
 await page.locator('#world').focus();await page.keyboard.press('e');await page.waitForFunction(()=>document.querySelector('#self-skill-slots [data-slot=skill] img')?.src.includes('slam-club'));
 assert.equal(player.herculesNextStance,'attack');assert(player.herculesShield);
 now+=16000;player.herculesCooldownUntil=0;player.herculesShield=null;await page.waitForTimeout(300);await page.locator('#world').focus();await page.keyboard.press('e');
 await page.waitForFunction(()=>document.querySelector('#world').dataset.attackCount==='1');await page.waitForTimeout(400);await page.screenshot({path:'.local/hercules-slam-game.png'});
 assert.equal(player.herculesNextStance,'shield');
 await page.evaluate(async()=>{
  const image=new Image();image.src='/assets/skills/hercules/slam-frames.webp';await image.decode();
  const {drawHerculesAttack}=await import('/hercules-effects.js');const c=document.createElement('canvas');c.id='slam-review';c.width=1260;c.height=840;document.body.append(c);c.style.position='fixed';c.style.left='0';c.style.top='0';c.style.zIndex='999999';const ctx=c.getContext('2d');ctx.fillStyle='#18213b';ctx.fillRect(0,0,c.width,c.height);
  for(let i=0;i<12;i++){ctx.save();ctx.translate(i%4*315,Math.floor(i/4)*280);drawHerculesAttack(ctx,{kind:'hercules-slam',x:45,y:245,dx:1,dy:0,size:60,reach:108,radius:96,durationMs:900,impactMs:450},i*75+5);ctx.fillStyle='#fff';ctx.font='15px sans-serif';ctx.fillText(String(i+1),12,24);ctx.restore();}
 });await page.locator('#slam-review').screenshot({path:'.local/hercules-slam-12frames.png'});assert.deepEqual(errors,[]);console.log('PASS actual shield/attack HUD toggle, E 12frame slam, JS/CSP errors0');
}finally{await browser.close();await game.close();}
