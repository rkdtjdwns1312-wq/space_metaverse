// 실제 학생 데이터 없이 49개 원화의 얼굴/좌우/루프와 실제 world 이동 연결을 검증합니다.
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {chromium} from 'playwright';
import {createClassroomServer} from '../server/app.js';
import {fillNewClass} from './class-setup.mjs';
import {PLAZA_ID} from '../shared/config.js';
const game=createClassroomServer({teacherKey:'locomotion-local-test',studentHours:false});
let browser;const errors=[];
await mkdir('.local/644-walk',{recursive:true});
try{
  const {port}=await game.listen(),url=`http://127.0.0.1:${port}`;
  browser=await chromium.launch({headless:true,...(process.platform==='win32'?{channel:'msedge'}:{}),args:['--no-proxy-server']});
  const page=await browser.newPage({bypassCSP:true,viewport:{width:1100,height:920}});
  page.on('pageerror',e=>errors.push(e.message));
  await page.goto(url+'/__motion-inspect',{waitUntil:'domcontentloaded'});
  const result=await page.evaluate(async()=>{
    const {LOCOMOTION_PROFILES:general,constellationWalkFrame:generalFrame,prepareConstellationWalk:generalPrepare}=await import('/constellation-locomotion.js');
    const {motionFramesReady,MOTION_FACES}=await import('/locomotion-gait.js');
    const custom={},allProfiles={...general};
    const faces={aquarius:[[.50,.28,.16,.12]],capricorn:[[.52,.32,.17,.14]],taurus:[[.50,.29,.18,.15]],gemini:[[.38,.28,.12,.12],[.62,.28,.12,.12]],libra:[[.50,.32,.16,.14]],hercules:[[.50,.30,.16,.14]],corvus:[[.50,.33,.16,.14]],cetus:[[.65,.52,.13,.11]]};
    for(const id of Object.keys(faces)){
      custom[id]=(await import('/'+id+'-animation.js'))[id+'WalkFrames'];
      allProfiles[id]=Object.fromEntries([2,3,4].map(level=>[level,{faces:MOTION_FACES[id][level],ms:id==='cetus'?185*2/3:130}]));
    }
    const LOCOMOTION_PROFILES=allProfiles;
    const make=(im,id,level,index)=>custom[id]?(level===5?null:custom[id](im,level)?.[index]||null):generalFrame(im,id,level,index);
    const prepare=(im,id,level)=>custom[id]?motionFramesReady(custom[id](im,level)):generalPrepare(im,id,level);
    document.body.replaceChildren();document.body.style='margin:0;background:#26354b;color:white';
    window.motionSets=[];const results=[];
    for(const [id,levels] of Object.entries(LOCOMOTION_PROFILES)){
      const sheet=document.createElement('canvas');sheet.id='sheet-'+id;sheet.width=1080;sheet.height=870;document.body.append(sheet);const ctx=sheet.getContext('2d');
      for(const level of Object.keys(levels).map(Number)){
        const im=new Image();im.src=id==='teacher'?'/assets/avatars/teacher/star-sovereign.png':`/assets/avatars/${level===2?'':`lv${level}/`}${id==='hercules'&&level===2?'hercules-front':id}.png`;await im.decode();
        const started=performance.now(),fallback=make(im,id,level,4),coldCallMs=performance.now()-started;
        const fallbackIsOriginal=fallback===make(im,id,level,0);await prepare(im,id,level);
        const count=id==='cetus'?24:32;const frames=Array.from({length:count},(_,i)=>make(im,id,level,i));
        const elapsed=performance.now()-started,pixels=frames.map(c=>c.getContext('2d').getImageData(0,0,256,256).data),base=pixels[0];
        let faceChanged=0,changed=0,edgeAdded=0;const hashes=[];let maxStep=0,seam=0;
        for(let f=0;f<count;f++){
          let hash=0,step=0;const data=pixels[f],next=pixels[(f+1)%count];
          for(let y=0;y<256;y++)for(let x=0;x<256;x++){
            const i=(y*256+x)*4,u=(x+.5)/256,v=(y+.5)/256;
            const delta=Math.max(...[0,1,2,3].map(c=>Math.abs(data[i+c]-base[i+c])));
            if(delta>3&&base[i+3]>230){changed++;if(levels[level].faces.some(([cx,cy,rx,ry])=>((u-cx)/rx)**2+((v-cy)/ry)**2<.9))faceChanged++;}
            if((x===0||y===0||x===255||y===255)&&data[i+3]>base[i+3]+20)edgeAdded++;
            hash=(hash*31+data[i+3]+data[i])>>>0;step+=Math.abs(data[i+3]-next[i+3]);
          }
          hashes.push(hash);maxStep=Math.max(maxStep,step);if(f===count-1)seam=step;
        }
        const row=Math.max(0,level-2);ctx.fillStyle='white';ctx.font='17px sans-serif';ctx.fillText(`${id} Lv${level}   neutral / step A / step B / left`,12,row*290+22);
        for(const [col,f] of [0,count/4,count*3/4,count/4].entries()){ctx.save();ctx.translate(col*270,row*290+30);if(col===3){ctx.translate(256,0);ctx.scale(-1,1);}ctx.drawImage(frames[f],0,0);ctx.restore();}
        window.motionSets.push({id,level,frames,ms:(levels[level].ms||110)/2});
        results.push({id,level,general:!!general[id],distinct:new Set(hashes).size,faceChanged,changed,edgeAdded,maxStep,seam,elapsedMs:Math.round(elapsed),coldCallMs,fallbackIsOriginal,cached:make(im,id,level,4)===frames[4],unsupported:make(im,id,5,4)===null});
      }
    }
    const live=document.createElement('canvas');live.id='live';live.width=1100;live.height=Math.ceil(window.motionSets.length/6)*225;document.body.prepend(live);const c=live.getContext('2d');window.motionTicks=0;
    function play(t){c.fillStyle='#26354b';c.fillRect(0,0,1100,live.height);for(let i=0;i<window.motionSets.length;i++){const s=window.motionSets[i],x=(i%6)*180,y=Math.floor(i/6)*225;c.fillStyle='white';c.font='12px sans-serif';c.fillText(`${s.id} Lv${s.level}`,x+4,y+18);c.drawImage(s.frames[Math.floor(t/s.ms)%s.frames.length],x+4,y+30,170,170);}window.motionTicks++;requestAnimationFrame(play);}requestAnimationFrame(play);
    return results;
  });
  await writeFile('.local/644-walk/frame-results.json',JSON.stringify(result,null,2));
  for(const r of result){assert.equal(r.faceChanged,0,`${r.id}${r.level} face`);assert.ok(r.changed>100,`${r.id}${r.level} movement`);assert.ok(r.distinct>=8,`${r.id}${r.level} distinct frames`);assert.equal(r.edgeAdded,0,`${r.id}${r.level} clipped edge`);assert.ok(r.cached&&r.unsupported&&r.fallbackIsOriginal);assert.ok(r.seam<=r.maxStep*1.01);}
  for(const id of new Set(result.map(r=>r.id)))await page.locator('#sheet-'+id).screenshot({path:`.local/644-walk/${id}.png`});
  await page.waitForTimeout(2200);assert.ok(await page.evaluate(()=>window.motionTicks)>30);
  await page.locator('#live').screenshot({path:'.local/644-walk/live.png'});
  // 可搬 preview: runtime-generated frames only; no private game state.
  const preview=await page.evaluate(()=>{
    const sets=window.motionSets.map(s=>({...s,frames:s.frames.map(c=>c.toDataURL())}));
    return '<!doctype html><meta charset="utf-8"><title>별자리 이동 모션</title><style>body{background:#26354b;color:white;font:18px sans-serif}main{display:grid;grid-template-columns:repeat(6,180px)}canvas{width:170px;height:170px}label{display:block;font-size:13px}</style><h1>별자리 이동 모션 · Lv2~4</h1><p>얼굴은 고정하고 옷·발·꼬리·날개만 움직입니다.</p><main></main><script>const sets='+JSON.stringify(sets)+'; for(const s of sets){const box=document.createElement("div"),l=document.createElement("label"),c=document.createElement("canvas");l.textContent=s.id+" Lv"+s.level;c.width=c.height=256;box.append(l,c);document.querySelector("main").append(box);s.c=c.getContext("2d");s.images=s.frames.map(src=>{const i=new Image();i.src=src;return i;});}function draw(t){for(const s of sets){s.c.clearRect(0,0,256,256);const im=s.images[Math.floor(t/s.ms)%s.images.length];if(im.complete)s.c.drawImage(im,0,0);}requestAnimationFrame(draw)}requestAnimationFrame(draw);<\/script>';
  });
  await writeFile('.local/644-walk/preview.html',preview);

  const gamePage=await browser.newPage({viewport:{width:1200,height:800}});
  gamePage.on('pageerror',e=>errors.push(e.message));
  await gamePage.goto(url,{waitUntil:'domcontentloaded'});
  await gamePage.locator('#teacher-tab').click();await gamePage.locator('#teacher-key').fill('locomotion-local-test');await fillNewClass(gamePage,['연습학생']);
  await gamePage.locator('#teacher-form .submit').click();await gamePage.locator('#lobby').waitFor({state:'hidden'});
  const room=[...game.store.rooms.values()][0],p=[...room.players.values()].find(p=>p.role==='teacher');
  const publish=()=>{for(const who of room.players.values())game.io.to(who.socketId).emit('room:state',game.store.snapshot(room,who));};
  const integration=[];
  for(const id of new Set(result.filter(r=>r.id!=='teacher'&&r.general).map(r=>r.id)))for(const level of [2,3,4]){
    Object.assign(p,{mapId:PLAZA_ID,x:650,y:900,facingX:1});Object.assign(p.avatar,{level,constellationId:id,form:'constellation',teacherPreview:true});publish();
    await gamePage.waitForFunction(({id,level})=>{const d=document.querySelector('#world').dataset;return d.locomotionId===id&&d.locomotionLevel===String(level);},{id,level});
    for(let n=0;n<8;n++){p.x+=5;publish();await gamePage.waitForTimeout(90);}
    const moving=await gamePage.locator('#world').getAttribute('data-locomotion-moving');assert.equal(moving,'true',`${id}${level} moving in game`);
    await gamePage.waitForTimeout(450);assert.equal(await gamePage.locator('#world').getAttribute('data-locomotion-moving'),'false',`${id}${level} idle`);
    p.facingX=-1;publish();await gamePage.waitForFunction(()=>document.querySelector('#world').dataset.selfFacingX==='-1');
    integration.push({id,level,moving:true,idle:true,left:true});
  }
  Object.assign(p.avatar,{level:5,constellationId:'cygnus'});publish();
  await gamePage.waitForFunction(()=>document.querySelector('#world').dataset.locomotionLevel==='4');
  for(let n=0;n<5;n++){p.x+=4;publish();await gamePage.waitForTimeout(90);}
  assert.equal(await gamePage.locator('#world').getAttribute('data-locomotion-moving'),'true','LV5 평소 LV4 모션');
  await gamePage.emulateMedia({reducedMotion:'reduce'});
  for(let n=0;n<4;n++){p.x+=4;publish();await gamePage.waitForTimeout(90);}
  assert.equal(await gamePage.locator('#world').getAttribute('data-locomotion-moving'),'false','reduced motion');
  assert.equal(await gamePage.locator('#world').getAttribute('data-locomotion-frame'),'0');
  await gamePage.emulateMedia({reducedMotion:'no-preference'});
  const transformed=game.store.snapshot(room,p);
  transformed.players.find(who=>who.id===p.id).transformation={active:true};
  game.io.to(p.socketId).emit('room:state',transformed);
  await gamePage.waitForFunction(()=>document.querySelector('#world').dataset.selfSprite==='/assets/avatars/celestial/cygnus.png');
  assert.equal(await gamePage.locator('#world').getAttribute('data-locomotion-id'),null,'LV5 초월 원화에는 새 보행 미적용');
  assert.equal(errors.length,0);
  await writeFile('.local/644-walk/results.json',JSON.stringify({result,integration,reducedMotion:true,lv5Normal:true,lv5Transformed:true,errors},null,2));
  console.log(JSON.stringify({avatars:result.length,facesUnchanged:result.every(r=>r.faceChanged===0),noClipping:result.every(r=>!r.edgeAdded),integration:integration.length,reducedMotion:true,lv5Normal:true,lv5Transformed:true,errors,slowestColdCallMs:Math.max(...result.map(r=>r.coldCallMs))}));
}finally{await browser?.close();await game.close();}
