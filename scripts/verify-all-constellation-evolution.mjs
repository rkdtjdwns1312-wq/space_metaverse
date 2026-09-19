// 요청123: 별도 메모리 교실에서 16명 모두 실제 UI로 XP를 구매하고 Lv1→4 진화합니다.
// 운영의 9999 보유 한도는 변경하지 않습니다. 50000은 이 시험의 초기 잔액뿐이며
// 실제 학급/저장 파일과 연결되지 않습니다. 레벨·경험치는 직접 수정하지 않습니다.
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {chromium} from 'playwright';
import {createClassroomServer} from '../server/app.js';
import {fillNewClass} from './class-setup.mjs';
import {VALLEY_ID,VALLEY,RULES} from '../shared/config.js';

// 실제 요구한 이름을 별도 기대값으로 두어 데이터 자체를 그대로 정답으로 쓰지 않습니다.
const allExpected=[['gemini','쌍둥이자리'],['corvus','까마귀자리'],['aquarius','물병자리'],
  ['capricorn','염소자리'],['taurus','황소자리'],['hercules','헤라클레스자리'],
  ['libra','천칭자리'],['cetus','고래자리'],['leo','사자자리'],['ophiuchus','뱀주인자리'],
  ['sagittarius','사수자리'],['corona-borealis','왕관자리'],['cancer','게자리'],
  ['cygnus','백조자리'],['aries','양자리'],['pisces','물고기자리']];
const only=process.argv.find(arg=>arg.startsWith('--only='))?.slice(7).split(',');
if(only)assert.ok(only.every(id=>allExpected.some(([known])=>known===id)),'알 수 없는 별자리 필터');
const expected=only?allExpected.filter(([id])=>only.includes(id)):allExpected;
const out='.local/all-constellation-evolution'+(only?'-targeted':'');
await mkdir(out,{recursive:true});
const game=createClassroomServer({teacherKey:'all-evolution-test-key',studentHours:false});
const address=await game.listen(),url=`http://127.0.0.1:${address.port}`;
const browser=await chromium.launch({headless:true,...(process.platform==='win32'?{channel:'msedge'}:{})});
const results=[],errors=[];
let active='setup';
const growth=VALLEY.objects.find(o=>o.id==='growth-star');
const evolve=VALLEY.objects.find(o=>o.id==='evolution-star');
const growthX=growth.x-growth.radius-RULES.radius-12;
const evolveX=evolve.x+evolve.radius+RULES.radius+12;
const instrument=()=>{
  window.draws={};window.motion=[];window.watchPath=null;
  const original=CanvasRenderingContext2D.prototype.drawImage;
  CanvasRenderingContext2D.prototype.drawImage=function(img,...args){
    if(this.canvas.id==='world'&&img?.src?.includes('/assets/avatars/')){
      const path=new URL(img.src).pathname,mat=this.getTransform();
      const value={time:performance.now(),x:mat.e/(devicePixelRatio*Number(this.canvas.dataset.viewScale))+Number(this.canvas.dataset.viewX)};
      window.draws[path]=value;
      if(path===window.watchPath&&window.motion.length<500)window.motion.push(value);
    }
    return original.call(this,img,...args);
  };
};
async function join(nickname){
  const page=await browser.newPage({viewport:{width:1280,height:960}});
  page.setDefaultTimeout(12000);page.on('pageerror',e=>errors.push({active,message:e.message}));
  await page.addInitScript(instrument);await page.goto(url);
  await page.locator('#join-code').fill(room.code);await page.locator('#nickname').fill(nickname);
  await page.locator('#student-pin').fill('1234');await page.locator('#student-form .submit').click();
  await page.locator('#lobby').waitFor({state:'hidden'});return page;
}
let room;
const publish=()=>{for(const p of room.players.values())if(p.connected)game.io.to(p.socketId).emit('room:state',game.store.snapshot(room,p));};
async function walk(page,player,targetX){
  await page.locator('#world').focus();
  const dir=Math.sign(targetX-player.x),key=dir>0?'ArrowRight':'ArrowLeft';
  await page.keyboard.down(key);
  try{
    const deadline=Date.now()+6000;
    while(dir*(targetX-player.x)>20&&Date.now()<deadline)await new Promise(r=>setTimeout(r,15));
    assert.ok(Math.abs(player.x-targetX)<45,`실제 방향키 이동 실패: ${player.x} → ${targetX}`);
  }finally{await page.keyboard.up(key);}
}
async function interact(page,name){
  await page.locator('#interact-object').filter({hasText:name}).waitFor();
  await page.keyboard.press('KeyE');
}
try {
  const teacher=await browser.newPage();await teacher.goto(url);await teacher.locator('#teacher-tab').click();
  await teacher.locator('#teacher-key').fill('all-evolution-test-key');
  const names=expected.map((_,i)=>'검증'+String(i+1).padStart(2,'0'));
  await fillNewClass(teacher,[...names,'관찰자']);await teacher.locator('#teacher-form .submit').click();
  await teacher.locator('#lobby').waitFor({state:'hidden'});room=[...game.store.rooms.values()][0];
  const friend=await join('관찰자');const observer=[...room.players.values()].find(p=>p.nickname==='관찰자');
  Object.assign(observer,{mapId:VALLEY_ID,x:600,y:650});
  for(const [index,[id,name]] of expected.entries()){
    active=id;const page=await join(names[index]);const p=[...room.players.values()].find(p=>p.nickname===names[index]);
    Object.assign(p,{starShards:50000,mapId:VALLEY_ID,x:600,y:480});publish();
    const row={id,name,initialShards:50000,stages:[],evolutions:[],movement:[]};results.push(row);
    assert.deepEqual({level:p.avatar.level,xp:p.avatar.xp,id:p.avatar.constellationId},{level:1,xp:0,id:null});
    for(let level=1;level<=4;level++){
      const art=level===2?`/assets/constellation-cards/${id}.png`:`/assets/constellation-cards/lv${level}/${id}.png`;
      const sprite=level===2?`/assets/avatars/${id}.png`:`/assets/avatars/lv${level}/${id}.png`;
      if(level>=2){
        for(const view of [page,friend])await view.waitForFunction(path=>Boolean(window.draws[path]),sprite);
      }
      await page.locator('#dock-avatar').click();await page.locator('#avatar-dialog').waitFor({state:'visible'});
      assert.match(await page.locator('#self-level').textContent(),new RegExp('LV '+level));
      assert.equal(await page.locator('#self-shards').textContent(),String(50000-[0,0,15,35,60][level]));
      const description=await page.locator('#self-description').textContent();
      if(level===1){assert.match(description,/이름 없는 작은 소행성/);assert.ok(await page.locator('#self-ability-panel').isHidden());}
      else{
        assert.match(description,new RegExp(`Lv${level} ${name}`));
        assert.match(await page.locator('#self-ability-name').textContent(),new RegExp(`Lv${level} ${name}`));
        await page.waitForFunction(path=>{const i=document.querySelector('#self-ability-art');return i.getAttribute('src')===path&&i.complete&&i.naturalWidth>0;},art);
        assert.equal(await page.locator('#self-ability-art').getAttribute('alt'),`Lv${level} ${name} 카드 그림`);
      }
      // 단계가 바뀌어도 카드의 분류 태그에 소행성이 남아 있으면 잡아냅니다.
      assert.equal(await page.locator('.card-attr .attr-tag').first().textContent(),level===1?'소행성':name);
      await page.locator('#avatar-portrait').screenshot({path:`${out}/${id}-lv${level}.png`});
      if(index===0)await page.screenshot({path:`${out}/info-lv${level}.png`});
      row.stages.push({level,displayName:level===1?'이름 없는 작은 소행성':name,art:level===1?null:art,sprite:level===1?null:sprite,shards:p.starShards});
      await page.locator('[data-close="avatar-dialog"]').click();
      if(level===4)break;
      if(level>=2)await page.evaluate(path=>{window.watchPath=path;window.motion=[];},sprite);
      const oldX=level>=2?await friend.evaluate(path=>window.draws[path].x,sprite):null;
      await walk(page,p,growthX);
      if(level>=2){
        await friend.waitForFunction(({path,x})=>Math.abs(window.draws[path].x-x)>100,{path:sprite,x:oldX});
        const points=await page.evaluate(()=>{window.watchPath=null;return window.motion;});
        assert.ok(points.length>=4);const backwards=points.slice(1).filter((v,i)=>v.x<points[i].x-2);
        assert.equal(backwards.length,0,'직선 이동 중 캐릭터가 뒤로 튀어서는 안 됨');
        row.movement.push({level,samples:points.length,backwards:backwards.length});
      }
      await interact(page,'성장의 별');await page.locator('#growth-dialog').waitFor({state:'visible'});
      await page.locator('#growth-max').click();const xp=[15,20,25][level-1];
      assert.equal(await page.locator('#growth-amount').inputValue(),String(xp));
      const before=p.starShards;await page.locator('#growth-buy').click();
      await page.locator('#growth-error').filter({hasText:'진화의 별'}).waitFor();
      assert.equal(p.avatar.xp,xp);assert.equal(p.avatar.level,level);assert.equal(p.starShards,before-xp);
      await page.locator('#growth-close').click();await walk(page,p,evolveX);
      await interact(page,'진화의 별');await page.locator('#evolution-evolve').click();
      if(level===1){
        const choice=page.locator(`[data-constellation-id="${id}"]`);
        assert.equal(await choice.locator('.constellation-name').textContent(),name);
        assert.equal(await choice.locator('img').getAttribute('src'),`/assets/constellation-cards/${id}.png`);
        await choice.click();
      }
      await page.locator('#evolution-confirm').waitFor({state:'visible'});
      assert.match(await page.locator('#evolution-confirm-text').textContent(),new RegExp(name));
      // 취소 시 레벨과 구매 XP 유지, 이어서 동일 UI로 실제 진화합니다.
      await page.locator('#evolution-no').click();assert.equal(p.avatar.level,level);assert.equal(p.avatar.xp,xp);
      await page.locator('#evolution-evolve').click();
      if(level===1)await page.locator(`[data-constellation-id="${id}"]`).click();
      const started=Date.now();await page.locator('#evolution-yes').click();
      await page.locator('#evolution-summary').filter({hasText:`LV${level+1}`}).waitFor();
      assert.equal(p.avatar.level,level+1);assert.equal(p.avatar.xp,0);assert.equal(p.avatar.constellationId,id);
      row.evolutions.push({from:level,to:level+1,xpCost:xp,elapsedMs:Date.now()-started});
      await page.locator('#evolution-header-close').click();
    }
    // Lv4도 같은 실제 이동 경로와 친구 화면을 검증합니다.
    const sprite=`/assets/avatars/lv4/${id}.png`;
    await page.evaluate(path=>{window.watchPath=path;window.motion=[];},sprite);
    await walk(page,p,growthX);
    const points=await page.evaluate(()=>{window.watchPath=null;return window.motion;});
    assert.ok(points.length>=4);assert.equal(points.slice(1).filter((v,i)=>v.x<points[i].x-2).length,0);
    row.movement.push({level:4,samples:points.length,backwards:0});
    assert.equal(p.starShards,49940);row.finalShards=p.starShards;
    await page.close();p.away=true;publish();
    await writeFile(`${out}/result.json`,JSON.stringify({url,results,errors},null,2));
    console.log(`${index+1}/${expected.length} ${name}: Lv1→2→3→4, 이름·카드·맵 파일 경로 일치, 50000→49940, 이동 통과`);
  }
  assert.deepEqual(errors,[]);
  console.log(`PASS: ${expected.length}계보 · ${expected.length*4}단계 표시 · XP구매/진화/취소/이동 각각${expected.length*3}`);
}catch(error){errors.push({active,message:error.message});throw error;}
finally{await writeFile(`${out}/result.json`,JSON.stringify({url,results,errors},null,2));await browser.close();await game.close();}
