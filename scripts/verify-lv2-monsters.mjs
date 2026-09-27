// 임시 학급에서 원화 투명도·좌우/포즈·실제 Q 공격과 서버 반격을 확인합니다.
import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {createClassroomServer} from '../server/app.js';
import {monstersOf} from '../server/monsters.js';
import {fillNewClass} from './class-setup.mjs';
const key='lv2-monster-browser-test-key',game=createClassroomServer({teacherKey:key,studentHours:false});
const {port}=await game.listen(),url='http://127.0.0.1:'+port;
const browser=await chromium.launch({headless:true,args:['--no-proxy-server'],...(process.platform==='win32'?{channel:'msedge'}:{})});
const errors=[],checks=[];await mkdir('.local',{recursive:true});
const check=t=>{checks.push(t);console.log(t);};
try{
 const page=await browser.newPage({viewport:{width:1440,height:960},hasTouch:true});page.setDefaultTimeout(10000);page.on('pageerror',e=>errors.push(e.message));
 await page.goto(url);await page.locator('#teacher-tab').click();await page.locator('#teacher-key').fill(key);await fillNewClass(page,['1']);await page.locator('#teacher-form .submit').click();await page.locator('#lobby').waitFor({state:'hidden'});
 const room=[...game.store.rooms.values()][0];
 const student=await browser.newPage({viewport:{width:1440,height:960},hasTouch:true});student.setDefaultTimeout(10000);student.on('pageerror',e=>errors.push(e.message));
 await student.goto(url);await student.locator('#join-code').fill(room.code);await student.locator('#nickname').fill('1');await student.locator('#student-pin').fill('1234');await student.locator('#student-form .submit').click();await student.locator('#lobby').waitFor({state:'hidden'});
 const p=[...room.players.values()].find(p=>p.role==='student');p.avatar.level=5;p.avatar.constellationId='aquarius';
 const publish=()=>game.io.to(p.socketId).emit('room:state',game.store.snapshot(room,p));
 const all=[...monstersOf(room).values()],second=all.filter(m=>m.mapId==='star-origin-2');
 for(const m of all)Object.assign(m,{dx:0,dy:0,nextDirectionAt:Infinity});
 const scorpion=second.find(m=>m.typeId==='star-scorpion'),chameleon=second.find(m=>m.typeId==='chameleon-star');
 Object.assign(scorpion,{x:520,y:420});Object.assign(chameleon,{x:880,y:420});
 Object.assign(p,{mapId:'star-origin-2',x:720,y:650});publish();
 await student.waitForFunction(()=>document.getElementById('world').dataset.monsterCount==='5');
 const alpha=await student.evaluate(async()=>{
   const {LV2_MONSTER_ART}=await import('/lv2-monster-art.js'),result=[];
   for(const [shape,art] of Object.entries(LV2_MONSTER_ART)){
     const im=new Image();im.src=art.src;await im.decode();const c=document.createElement('canvas');c.width=im.width;c.height=im.height;const ctx=c.getContext('2d');ctx.drawImage(im,0,0);
     const pixels=ctx.getImageData(0,0,c.width,c.height).data;let clear=0,solid=0;for(let i=3;i<pixels.length;i+=4){if(pixels[i]===0)clear++;if(pixels[i]>200)solid++;}
     result.push({shape,clear:clear/(pixels.length/4),solid:solid/(pixels.length/4),corner:pixels[3]});
   }return result;
 });
 for(const a of alpha){assert.equal(a.corner,0);assert.ok(a.clear>.3&&a.solid>.1,'진짜 투명 배경과 원화 존재');}
 check('두 원화 투명 PNG 정상 로드·둘째 맵5마리');await student.waitForTimeout(200);await student.screenshot({path:'.local/248-monsters-map.png'});
 for(const [monster,face] of [[scorpion,1],[chameleon,-1]]){
   for(const m of all){m.attackers.clear();m.targetId=null;}
   Object.assign(p,{x:monster.x+face*90,y:monster.y,facing:{x:-face,y:0},battleVitals:null});
   Object.assign(monster,{facingX:face,hp:40,nextAttackAt:0});publish();
   // 서버의 1초 공격 제한을 그대로 지키며 다음 몬스터를 시험합니다.
   await student.waitForTimeout(1050);await student.locator('#world').focus();await student.keyboard.press('q');
   await student.waitForFunction(shape=>document.getElementById('world').dataset.lastMonsterEffect===shape,monster.typeId);
   assert.ok(monster.hp<40&&monster.hp>0);assert.equal(monster.targetId,p.id);assert.ok(p.battleVitals.hp<40);
   await student.waitForTimeout(180);await student.screenshot({path:'.local/248-'+monster.typeId+'-counter.png'});
   check(monster.typeId+' 실제 Q 피격→추격·반격 이벤트→전용 공격 표시');
 }
 // 게임을 실행하지 않는 별도 문서에 실제 렌더러를 사용해 모든 자세를 모읍니다.
 const gallery=await browser.newPage({viewport:{width:1280,height:1080}});gallery.on('pageerror',e=>errors.push(e.message));await gallery.goto(url+'/health');
 const renderChecks=await gallery.evaluate(async()=>{
   const {drawLv2Monster}=await import('/lv2-monster-art.js');
   document.body.innerHTML='';document.body.style.margin='0';const c=document.createElement('canvas');c.width=1280;c.height=1080;document.body.append(c);const ctx=c.getContext('2d');
   const draw=()=>{ctx.fillStyle='#222843';ctx.fillRect(0,0,c.width,c.height);
     for(const [i,shape] of ['star-scorpion','chameleon-star'].entries())for(const [j,face] of [1,-1].entries()){
       const row=i*2+j,y=row*270+170;
       for(const [col,time] of [0,150,330,480].entries()){
         const x=160+col*320;ctx.fillStyle='#f3e9ff';ctx.font='16px sans-serif';ctx.textAlign='center';ctx.fillText(shape+' '+(face>0?'오른쪽':'왼쪽')+' · '+['대기','준비','타격','회복'][col],x,row*270+28);
         drawLv2Monster(ctx,{shape,x,y,radius:50,facingX:face,moving:time===0},time,time?{startedAt:0,durationMs:600,dx:face,dy:0,reach:90}:null);
       }
     }
   };draw();await new Promise(r=>setTimeout(r,200));draw();
   // 실제 픽셀 차이로 방향과 공격 자세의 변화 확인(메타데이터만 확인하지 않음).
   const probe=document.createElement('canvas');probe.width=probe.height=300;const pc=probe.getContext('2d'),results=[];
   for(const shape of ['star-scorpion','chameleon-star']){
     const render=(face,time,attack)=>{pc.clearRect(0,0,300,300);drawLv2Monster(pc,{shape,x:150,y:170,radius:48,facingX:face},time,attack);return probe.toDataURL();};
     const right=render(1,0),left=render(-1,0),strike=render(1,330,{startedAt:0,durationMs:600,dx:1,dy:0,reach:90});results.push({shape,mirrored:right!==left,attack: strike!==right});
   }return results;
 });
 assert.ok(renderChecks.every(r=>r.mirrored&&r.attack));await gallery.screenshot({path:'.local/248-monster-poses.png',fullPage:true});check('두 종류 좌우 반전·대기/준비/타격/회복 16장 렌더 검수');
 assert.deepEqual(errors,[]);await writeFile('.local/248-monster-result.json',JSON.stringify({checks,alpha,renderChecks,errors},null,2));
}finally{await browser.close();await game.close();}
