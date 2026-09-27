// 임시 교실에서 4개 별 원화의 preload/투명도/좌우·4포즈와 실제 맵·공격 연동을 확인합니다.
import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {createClassroomServer} from '../server/app.js';
import {monstersOf} from '../server/monsters.js';
import {fillNewClass} from './class-setup.mjs';

const key='celestial-monster-browser-test-key',game=createClassroomServer({teacherKey:key,studentHours:false});
const {port}=await game.listen(),url='http://127.0.0.1:'+port;
const browser=await chromium.launch({headless:true,args:['--no-proxy-server'],...(process.platform==='win32'?{channel:'msedge'}:{})});
const errors=[],checks=[];await mkdir('.local',{recursive:true});
const check=message=>{checks.push(message);console.log(message);};
try{
 const teacher=await browser.newPage({viewport:{width:1440,height:960},hasTouch:true});teacher.setDefaultTimeout(12000);teacher.on('pageerror',error=>errors.push(error.message));
 await teacher.goto(url);await teacher.locator('#teacher-tab').click();await teacher.locator('#teacher-key').fill(key);await fillNewClass(teacher,['검증 학생']);await teacher.locator('#teacher-form .submit').click();await teacher.locator('#lobby').waitFor({state:'hidden'});
 const room=[...game.store.rooms.values()][0];
 const student=await browser.newPage({viewport:{width:1440,height:960},hasTouch:true});student.setDefaultTimeout(12000);student.on('pageerror',error=>errors.push(error.message));
 await student.goto(url);await student.locator('#join-code').fill(room.code);await student.locator('#nickname').fill('검증 학생');await student.locator('#student-pin').fill('1234');await student.locator('#student-form .submit').click();await student.locator('#lobby').waitFor({state:'hidden'});
 const player=[...room.players.values()].find(value=>value.role==='student');player.avatar.level=5;player.avatar.constellationId='aquarius';
 const publish=()=>game.io.to(player.socketId).emit('room:state',game.store.snapshot(room,player));
 const all=[...monstersOf(room).values()],origin=all.filter(monster=>monster.mapId==='star-origin-3');
 assert.equal(all.length,35);assert.equal(origin.length,5);
 for(const monster of all){monster.dx=0;monster.dy=0;monster.targetId=null;monster.attackers.clear();monster.patrolStartedAt=Date.now()+60000;monster.nextDirectionAt=Date.now()+60000;}
 const maps=[['star-origin-3','star-dragon-1'],['star-origin-3','star-phoenix-1'],['moon-paradise-1','cool-star-1'],['moon-paradise-2','grown-cool-star-1']];
 for(const [mapId,id] of maps){
   const mapMonsters=all.filter(monster=>monster.mapId===mapId);assert.equal(mapMonsters.length,5,`${mapId}: 5마리`);
   Object.assign(player,{mapId,x:900,y:650});publish();
   await student.waitForFunction(expected=>document.getElementById('world').dataset.monsterCount==='5'&&document.getElementById('minimap-title').textContent.includes(expected),mapId==='star-origin-3'?'별의 시작점 3':mapId==='moon-paradise-1'?'달의 낙원 1':'달의 낙원 2');
   check(`${mapId} 실제 브라우저에서 몬스터 5마리 표시`);
   const monster=room.monsters.get(id);assert.ok(monster&&monster.hp===monster.maxHp);
   const face=1;Object.assign(player,{mapId,x:monster.x-monster.radius-45,y:monster.y,facing:{x:face,y:0},facingX:face,battleVitals:null});
   monster.attackers.clear();Object.assign(monster,{dx:0,dy:0,targetId:null,hp:monster.maxHp,nextAttackAt:0});publish();
   await student.locator('#world').evaluate(canvas=>{canvas.dataset.lastMonsterDamage='0';canvas.dataset.lastMonsterEffect='';});
   await student.waitForTimeout(1100);await student.locator('#world').focus();await student.keyboard.press('q');
   await student.waitForFunction(shape=>document.getElementById('world').dataset.lastAttackPlayer!==''&&document.getElementById('world').dataset.monsterCount==='5',id.startsWith('star-dragon')?'star-dragon':id.startsWith('star-phoenix')?'star-phoenix':id.startsWith('cool-star')?'cool-star':'grown-cool-star');
   await student.waitForFunction(()=>Number(document.getElementById('world').dataset.lastMonsterDamage)>0, null,{timeout:7000});
   const result={hp:monster.hp,target:monster.targetId,playerHp:player.battleVitals?.hp};
   assert.ok(result.hp<monster.maxHp,`${id}: Q 공격 피해`);assert.equal(result.target,player.id,`${id}: 공격자 추격`);assert.ok(result.playerHp<40,`${id}: 서버 반격 피해`);
   const effect=await student.locator('#world').getAttribute('data-last-monster-effect');assert.equal(effect,monster.typeId,`${id}: 전용 shape 공격 이벤트`);
   check(`${id} 실제 Q 피격·shape별 반격 이벤트·서버 피해 확인`);
 }
 const alpha=await student.evaluate(async()=>{
   const {CELESTIAL_MONSTER_ART,preloadCelestialArt}=await import('/celestial-monster-art.js');await preloadCelestialArt();
   const result=[];
   for(const [shape,art] of Object.entries(CELESTIAL_MONSTER_ART)){
     const image=new Image();image.src=art.src;await image.decode();const canvas=document.createElement('canvas');canvas.width=image.naturalWidth;canvas.height=image.naturalHeight;
     const ctx=canvas.getContext('2d');ctx.drawImage(image,0,0);const pixels=ctx.getImageData(0,0,canvas.width,canvas.height).data;let clear=0,solid=0;
     for(let i=3;i<pixels.length;i+=4){if(pixels[i]===0)clear++;if(pixels[i]>200)solid++;}
     result.push({shape,width:image.naturalWidth,height:image.naturalHeight,clear:clear/(pixels.length/4),solid:solid/(pixels.length/4),corner:pixels[3]});
   }return result;
 });
 for(const image of alpha){assert.ok(image.width>=1200&&image.height>=1200,image.shape+' 원화 해상도');assert.equal(image.corner,0,image.shape+' 모서리 투명');assert.ok(image.clear>.08&&image.solid>.04,image.shape+' 투명 배경과 실제 그림 확인');}
 check('preloadCelestialArt decode 완료·4개 원화 투명도 및 그림 데이터 확인');
 const gallery=await browser.newPage({viewport:{width:1440,height:2700}});gallery.on('pageerror',error=>errors.push(error.message));await gallery.goto(url+'/health');
 const poseChecks=await gallery.evaluate(async()=>{
   const {CELESTIAL_MONSTER_ART,preloadCelestialArt,drawCelestialMonster}=await import('/celestial-monster-art.js');await preloadCelestialArt();
   document.body.innerHTML='';document.body.style.cssText='margin:0;background:#24283f';
   const canvas=document.createElement('canvas');canvas.width=1440;canvas.height=2700;document.body.append(canvas);const ctx=canvas.getContext('2d');
   const shapes=Object.keys(CELESTIAL_MONSTER_ART),labels=['대기','준비','타격','회복'],times=[0,150,330,520];
   for(let s=0;s<shapes.length;s++)for(let f=0;f<2;f++)for(let pose=0;pose<4;pose++){
     const shape=shapes[s],face=f===0?1:-1,x=180+pose*360,y=170+s*660+f*320;
     ctx.fillStyle='#f5edff';ctx.font='20px sans-serif';ctx.textAlign='center';ctx.fillText(shape+' '+(face>0?'오른쪽':'왼쪽')+' · '+labels[pose],x,50+s*660+f*320);
     const attack=pose===0?null:{startedAt:0,durationMs:600,dx:face,dy:0,reach:100};
     const drew=drawCelestialMonster(ctx,{shape,x,y,radius:shape.includes('grown')||shape.startsWith('star-')?96:48,facingX:face,moving:pose===0},times[pose],attack);
     if(!drew)throw new Error(shape+' '+labels[pose]+' 렌더 실패');
   }
   const probe=document.createElement('canvas');probe.width=probe.height=320;const pc=probe.getContext('2d'),result=[];
   for(const shape of shapes){
     const render=(face,time,attack)=>{pc.clearRect(0,0,320,320);drawCelestialMonster(pc,{shape,x:160,y:185,radius:shape.includes('grown')||shape.startsWith('star-')?96:48,facingX:face},time,attack);return probe.toDataURL();};
     const right=render(1,0,null),left=render(-1,0,null),idle=right,strike=render(1,330,{startedAt:0,durationMs:600,dx:1,dy:0,reach:100}),recover=render(1,520,{startedAt:0,durationMs:600,dx:1,dy:0,reach:100});
     result.push({shape,mirrored:right!==left,strike:idle!==strike,recover:strike!==recover});
   }return result;
 });
 assert.ok(poseChecks.every(value=>value.mirrored&&value.strike&&value.recover),JSON.stringify(poseChecks));
 await gallery.screenshot({path:'.local/celestial-monster-poses.png',fullPage:true});check('4종 좌우 반전·대기/준비/타격/회복 32포즈 갤러리 렌더');
 assert.deepEqual(errors,[]);await writeFile('.local/celestial-monster-result.json',JSON.stringify({checks,alpha,poseChecks,errors},null,2));
}finally{await browser.close();await game.close();}
console.log(JSON.stringify({checks:checks.length,errors}));
