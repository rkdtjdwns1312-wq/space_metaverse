// 저장된 교실을 읽지 않는 등록 시트/전용 모션/실제 게임 통합 검사.
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {chromium} from 'playwright';
import {createClassroomServer} from '../server/app.js';
import {fillNewClass} from './class-setup.mjs';
import {WALK_POSE_REGISTRATION} from '../client/walk-pose-sheet.js';
const out='.local/669-pose',entries=Object.keys(WALK_POSE_REGISTRATION),errors=[],results=[];
assert.ok(entries.length>=24);assert.ok(Object.values(WALK_POSE_REGISTRATION).every(r=>r.enabled));
const only=process.argv.find(a=>a.startsWith('--only='))?.slice(7),selected=only?entries.filter(k=>k===only):entries;
assert.ok(selected.length);const report=out+(only?'/runtime-'+only.replace(':','-')+'.json':'/runtime-all.json');
const game=createClassroomServer({teacherKey:'pose-runtime-synthetic',studentHours:false});let browser;
try{
 await mkdir(out,{recursive:true});const url=`http://127.0.0.1:${(await game.listen()).port}`;
 browser=await chromium.launch({headless:true,channel:'msedge',args:['--no-proxy-server']});
 const page=await browser.newPage({bypassCSP:true,viewport:{width:1100,height:800}});page.on('pageerror',e=>errors.push(e.message));
 await page.goto(url+'/__pose-runtime');
 for(const key of selected){const [id,lv]=key.split(':'),level=Number(lv);
  const result=await page.evaluate(async({id,level})=>{
   const {walkPoseRegistration}=await import('/walk-pose-sheet.js');
   const {gaitRig,motionFramesReady}=await import('/locomotion-gait.js');
   const {constellationWalkFrame,prepareConstellationWalk}=await import('/constellation-locomotion.js');
   const im=new Image();im.src=id==='teacher'?'/assets/avatars/teacher/star-sovereign.png':`/assets/avatars/${level===2?'':`lv${level}/`}${id==='hercules'&&level===2?'hercules-front-v2':id}.png`;await im.decode();
   let original,frames,atomic;
   if(['taurus','capricorn','gemini','hercules','corvus'].includes(id)){
    const mod=await import('/'+id+'-animation.js');frames=mod[id+'WalkFrames'](im,level);original=frames[0];atomic=frames.every(f=>f===original);await motionFramesReady(frames);
   }else{
    original=constellationWalkFrame(im,id,level,0);atomic=constellationWalkFrame(im,id,level,17)===original;await prepareConstellationWalk(im,id,level);frames=Array.from({length:32},(_,i)=>constellationWalkFrame(im,id,level,i));
   }
   const r=walkPoseRegistration(id,level),fixedRows=Math.floor(Math.min(...(r.regions||[r]).map(r=>r.top))*256),base=original.getContext('2d').getImageData(0,0,256,fixedRows).data;
   let fixedChanged=0;const hashes=[];
   for(const f of frames){const d=f.getContext('2d').getImageData(0,0,256,256).data;for(let i=0;i<base.length;i++)if(d[i]!==base[i])fixedChanged++;let hash=0;for(let i=base.length;i<d.length;i++)hash=(hash*31+d[i])>>>0;hashes.push(hash);}
   const c=document.createElement('canvas');c.width=256*4;c.height=256;const ctx=c.getContext('2d');ctx.fillStyle='#33485c';ctx.fillRect(0,0,c.width,c.height);[original,frames[4],frames[16],frames[28]].forEach((f,i)=>ctx.drawImage(f,i*256,0));
   return {id,level,atomic,fixedRows,fixedChanged,gaitDisabled:gaitRig(id,level)===null,poses:[...new Set(frames.map(f=>f.dataset.walkPose))],distinctLower:new Set(hashes).size,png:c.toDataURL().split(',')[1]};
  },{id,level});
  await writeFile(`${out}/runtime-${id}-lv${level}.png`,Buffer.from(result.png,'base64'));delete result.png;
  assert.ok(result.atomic&&result.gaitDisabled, key);assert.equal(result.fixedChanged,0,key+' fixed upper RGBA');assert.equal(result.poses.length,8,key+' 8 poses');assert.ok(result.distinctLower>=8,key+' lower motion');results.push(result);console.log('FRAME PASS '+key);
 }
 await page.addInitScript(()=>{const draw=CanvasRenderingContext2D.prototype.drawImage;CanvasRenderingContext2D.prototype.drawImage=function(source,...args){if(this.canvas.id==='world'&&args.length===4&&args[0]===-args[2]/2&&args[1]===-args[3]/2&&(source instanceof HTMLCanvasElement&&source.width===256||source instanceof HTMLImageElement&&source.src.includes('/avatars/'))){window.poseDraw=source?.dataset?.walkPose??null;window.avatarDrawKind=source instanceof HTMLCanvasElement?'frame':'original';if(window.poseDraw!==null)(window.seenWalkPoses??=new Set()).add(window.poseDraw);}return draw.call(this,source,...args);};});
 await page.goto(url);await page.locator('#teacher-tab').click();await page.locator('#teacher-key').fill('pose-runtime-synthetic');await fillNewClass(page,['합성검사']);await page.locator('#teacher-form .submit').click();await page.locator('#lobby').waitFor({state:'hidden'});
 const room=[...game.store.rooms.values()][0],p=[...room.players.values()].find(p=>p.role==='teacher');
 const publish=()=>game.io.to(p.socketId).emit('room:state',game.store.snapshot(room,p));
 const move=async n=>{for(let i=0;i<n;i++){p.x+=p.facingX*2;publish();await page.waitForTimeout(90);}};
 for(const result of results){const {id,level}=result;
  Object.assign(p,{x:650,y:900,facingX:1});Object.assign(p.avatar,{level,constellationId:id==='teacher'?'aquarius':id,form:'constellation',teacherPreview:id!=='teacher'});publish();
  await page.waitForFunction(id=>document.querySelector('#world').dataset.selfSprite.includes(id==='teacher'?'star-sovereign':id),id);
  await page.evaluate(()=>{window.seenWalkPoses=new Set();});
  // 최초 비동기 32프레임 생성과 최소 두 주기의 8포즈를 기다립니다.
  await move(70);const seen=await page.evaluate(()=>[...window.seenWalkPoses]);assert.equal(seen.length,8,`${id}${level} moving right`);
  assert.equal(await page.locator('#world').getAttribute('data-self-facing-x'),'1');
  await page.waitForTimeout(500);assert.equal(await page.evaluate(()=>window.avatarDrawKind),'original',`${id}${level} idle`);
  p.facingX=-1;await page.evaluate(()=>{window.seenWalkPoses=new Set();});await move(25);
  assert.equal(await page.locator('#world').getAttribute('data-self-facing-x'),'-1');assert.ok((await page.evaluate(()=>window.seenWalkPoses.size))>=7,`${id}${level} left poses`);
  await page.emulateMedia({reducedMotion:'reduce'});await move(4);assert.equal(await page.evaluate(()=>window.avatarDrawKind),'original',`${id}${level} reduced`);await page.emulateMedia({reducedMotion:'no-preference'});
  Object.assign(result,{actualRight:true,idle:true,actualLeft:true,reduced:true,seen});
  await writeFile(report,JSON.stringify({results,errors,complete:false},null,2));console.log('GAME PASS '+id+':'+level);
 }
 // 시트 로드 실패 시 부분 포즈가 노출되지 않고 원본이 유지되는지 별도 브라우저 문서에서 검사.
 const failed=await browser.newPage({bypassCSP:true});await failed.route('**/walk-poses/sagittarius-lv2.png',r=>r.abort());await failed.goto(url+'/__pose-failed');
 const failure=await failed.evaluate(async()=>{const m=await import('/constellation-locomotion.js');const im=new Image();im.src='/assets/avatars/sagittarius.png';await im.decode();const original=m.constellationWalkFrame(im,'sagittarius',2,0);let rejected=false;try{await m.prepareConstellationWalk(im,'sagittarius',2);}catch{rejected=true;}return rejected&&Array.from({length:32},(_,i)=>m.constellationWalkFrame(im,'sagittarius',2,i)).every(f=>f===original);});assert.ok(failure);await failed.close();
 assert.deepEqual(errors,[]);await writeFile(report,JSON.stringify({results,errors,failureFallback:failure,complete:true},null,2));console.log(results.length+' runtime / fixed upper RGBA / 8 poses / idle / right-left / reduced / failure fallback PASS');
}finally{await browser?.close();await game.close();}
