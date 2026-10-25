// 합성 후보의 얼굴 보존·하체 및 이음새를 원본과 나란히 검수합니다. 저장 교실은 열지 않습니다.
import assert from 'node:assert/strict';
import {WALK_POSE_REGISTRATION} from '../client/walk-pose-sheet.js';
import {fillNewClass} from './class-setup.mjs';
import {mkdir,writeFile} from 'node:fs/promises';
import {chromium} from 'playwright';
import {createClassroomServer} from '../server/app.js';
const out='.local/669-pose',game=createClassroomServer({teacherKey:'pose-review-synthetic',studentHours:false});let browser;
const only=process.argv.find(a=>a.startsWith('--only='))?.slice(7)?.split(','),contactOnly=process.argv.includes('--contact-only');
try{
 await mkdir(out,{recursive:true});const url=`http://127.0.0.1:${(await game.listen()).port}`;
 browser=await chromium.launch({headless:true,channel:'msedge',args:['--no-proxy-server']});
 const page=await browser.newPage({bypassCSP:true,viewport:{width:1400,height:900}});
 await page.goto(url+'/__pose-review',{waitUntil:'domcontentloaded'});
 for(const key of Object.keys(WALK_POSE_REGISTRATION).filter(k=>!only||only.includes(k))){const [id,lv]=key.split(':'),level=Number(lv);
 const result=await page.evaluate(async({id,level})=>{
  const {prepareWalkPoseSheet,composeWalkPose}=await import('/walk-pose-sheet.js');
  const im=new Image();im.src=id==='teacher'?'/assets/avatars/teacher/star-sovereign.png':'/assets/avatars/'+(level===2?'':'lv'+level+'/')+(id==='hercules'&&level===2?'hercules-front-v2':id)+'.png';await im.decode();
  const original=document.createElement('canvas');original.width=original.height=256;original.getContext('2d').drawImage(im,0,0,256,256);
  const poses=await prepareWalkPoseSheet(id,level),frames=poses.frames.map((_,i)=>composeWalkPose(original,poses,i));
  document.body.replaceChildren();document.body.style='margin:0;background:#33485c;color:white';
  const sheet=document.createElement('canvas');sheet.id='poses';sheet.width=1280;sheet.height=580;document.body.append(sheet);const c=sheet.getContext('2d');
  c.fillStyle='#33485c';c.fillRect(0,0,sheet.width,sheet.height);c.font='18px sans-serif';
  for(let i=0;i<10;i++){const x=i%5*256,y=Math.floor(i/5)*290;c.fillStyle='white';c.fillText(i===0?'ORIGINAL':i===9?'LEFT 3':'POSE '+i,x+10,y+22);c.save();if(i===9){c.translate(x+256,y+30);c.scale(-1,1);}else c.translate(x,y+30);c.drawImage(i===0?original:frames[i===9?2:i-1],0,0);c.restore();}
  const live=document.createElement('canvas');live.id='live';live.width=768;live.height=290;document.body.append(live);const l=live.getContext('2d');
  function draw(t){l.fillStyle='#33485c';l.fillRect(0,0,768,290);l.drawImage(original,0,20);l.drawImage(frames[Math.floor(t/220)%8],256,20);l.save();l.translate(768,20);l.scale(-1,1);l.drawImage(frames[Math.floor(t/220)%8],0,0);l.restore();requestAnimationFrame(draw);}requestAnimationFrame(draw);
  let faceChanged=0;const base=original.getContext('2d').getImageData(0,0,256,256).data;
  const hashes=frames.map(frame=>{const data=frame.getContext('2d').getImageData(0,0,256,256).data;let hash=0;for(let y=0;y<256;y++)for(let x=0;x<256;x++){const i=(y*256+x)*4;if(y<160)for(let k=0;k<4;k++)if(data[i+k]!==base[i+k])faceChanged++;hash=(hash*31+data[i]+data[i+3])>>>0;}return hash;});
  return {faceChanged,distinct:new Set(hashes).size,registration:poses.registration,png:sheet.toDataURL().split(',')[1]};
 },{id,level});
 await writeFile(out+'/'+id+'-lv'+level+'.png',Buffer.from(result.png,'base64'));delete result.png;assert.equal(result.faceChanged,0);assert.equal(result.distinct,8);
 await writeFile(out+'/report-'+id+'-lv'+level+'.json',JSON.stringify(result,null,2));console.log(JSON.stringify({id,level,...result}));
 }
 if(!contactOnly){
 // 준비 전 원화 표시와 준비 후 전체 프레임 전환을 실제 일반 모션 경로로 확인합니다.
 const runtime=await page.evaluate(async()=>{
  const {prepareConstellationWalk,constellationWalkFrame,LOCOMOTION_PROFILES}=await import('/constellation-locomotion.js');
  const im=new Image();im.src='/assets/avatars/sagittarius.png';await im.decode();
  const fallback=constellationWalkFrame(im,'sagittarius',2,12),original=constellationWalkFrame(im,'sagittarius',2,0),atomic=fallback===original;
  await prepareConstellationWalk(im,'sagittarius',2);const frames=Array.from({length:32},(_,i)=>constellationWalkFrame(im,'sagittarius',2,i));
  const base=original.getContext('2d').getImageData(0,0,256,256).data;let faceChanged=0;
  for(const frame of frames){const data=frame.getContext('2d').getImageData(0,0,256,256).data;for(let y=0;y<256;y++)for(let x=0;x<256;x++)if(LOCOMOTION_PROFILES.sagittarius[2].faces.some(([cx,cy,rx,ry])=>((x/256-cx)/rx)**2+((y/256-cy)/ry)**2<.9)){const i=(y*256+x)*4;for(let ch=0;ch<4;ch++)if(data[i+ch]!==base[i+ch])faceChanged++;}}
  return {atomic,faceChanged,poses:[...new Set(frames.map(f=>f.dataset.walkPose))],cached:constellationWalkFrame(im,'sagittarius',2,12)===frames[12]};
 });assert.ok(runtime.atomic&&runtime.cached);assert.equal(runtime.faceChanged,0);assert.equal(runtime.poses.length,8);
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.addInitScript(()=>{const original=CanvasRenderingContext2D.prototype.drawImage;CanvasRenderingContext2D.prototype.drawImage=function(source,...args){if(this.canvas.id==='world'&&args.length===4&&args[0]===-args[2]/2&&args[1]===-args[3]/2){window.poseDraw=source?.dataset?.walkPose??null;if(window.poseDraw!==null)(window.seenWalkPoses??=new Set()).add(window.poseDraw);}return original.call(this,source,...args);};});
 await page.goto(url);await page.locator('#teacher-tab').click();await page.locator('#teacher-key').fill('pose-review-synthetic');await fillNewClass(page,['합성검사']);await page.locator('#teacher-form .submit').click();await page.locator('#lobby').waitFor({state:'hidden'});
 const room=[...game.store.rooms.values()][0],p=[...room.players.values()].find(p=>p.role==='teacher');
 Object.assign(p.avatar,{level:2,constellationId:'sagittarius',form:'constellation',teacherPreview:true});Object.assign(p,{x:1700,y:1320,facingX:1});
 const publish=()=>game.io.to(p.socketId).emit('room:state',game.store.snapshot(room,p));publish();
 const move=async n=>{for(let i=0;i<n;i++){p.x+=2;publish();await page.waitForTimeout(90);}};
 await move(55);const seen=await page.evaluate(()=>[...window.seenWalkPoses||[]]);assert.equal(seen.length,8);
 await page.screenshot({path:out+'/game-lv2-right.png'});
 await page.waitForTimeout(400);assert.equal(await page.evaluate(()=>window.poseDraw),null);
 p.facingX=-1;publish();await move(23);await page.screenshot({path:out+'/game-lv2-left.png'});
 assert.equal(await page.locator('#world').getAttribute('data-self-facing-x'),'-1');
 await page.emulateMedia({reducedMotion:'reduce'});await move(5);assert.equal(await page.evaluate(()=>window.poseDraw),null);assert.deepEqual(errors,[]);
 await writeFile(out+'/runtime.json',JSON.stringify({runtime,seen,idle:true,left:true,reduced:true,errors},null,2));console.log('LV2 runtime: 8 poses / atomic / face unchanged / idle / left / reduced PASS');
 }
}finally{await browser?.close();await game.close();}
