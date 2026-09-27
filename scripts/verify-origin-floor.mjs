// 요청 273: 세 별의 시작점 맵에서 실제 키보드 경계·게이트·미니맵과 배경 그림을 확인합니다.
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {chromium} from 'playwright';
import {createClassroomServer} from '../server/app.js';
import {fillNewClass} from './class-setup.mjs';
import {ORIGIN_MAPS,RULES,mapOf} from '../shared/config.js';
import {isParadise,onParadiseFloor} from '../shared/paradise-floor.js';
import {originFloor,onOriginFloor} from '../shared/origin-floor.js';

const checks=[],errors=[],failures=[];
const check=label=>{checks.push(label);console.log('통과:',label);};
const key='origin-floor-test-only-key';
const game=createClassroomServer({teacherKey:key,studentHours:false});
const address=await game.listen(),url=`http://127.0.0.1:${address.port}`;
const browser=await chromium.launch({headless:true,args:['--no-proxy-server'],...(process.platform==='win32'?{channel:'msedge'}:{})});
await mkdir('.local',{recursive:true});
try{
  const page=await browser.newPage({viewport:{width:1440,height:960},hasTouch:true});
  page.setDefaultTimeout(12000);page.on('pageerror',e=>errors.push(e.message));
  await page.goto(url,{waitUntil:'domcontentloaded',timeout:25000});
  await page.locator('#teacher-tab').click();await page.locator('#teacher-key').fill(key);
  await fillNewClass(page,['273']);await page.locator('#teacher-form .submit').click();
  await page.locator('#lobby').waitFor({state:'hidden'});
  const room=[...game.store.rooms.values()][0],p=[...room.players.values()].find(v=>v.role==='teacher')||[...room.players.values()][0];
  assert.ok(p?.socketId,'테스트 교실의 접속 플레이어가 필요합니다.');
  const publish=()=>game.io.to(p.socketId).emit('room:state',game.store.snapshot(room,p));
  await page.locator('#world').focus();
  // 별 배경과 게이트 원화 모두 실제 앱이 제공하는 이미지를 로드한 뒤 화면을 캡처합니다.
  const originArtLoaded=await page.evaluate(async()=>{
    const gate=await import('/gate-art.js');await gate.preloadGateArt();
    const image=new Image();image.src='/assets/maps/origin-starlight.png';
    try{await image.decode();return image.naturalWidth>0;}catch{return false;}
  });
  if(originArtLoaded)check('origin-starlight 배경과 gate-art 원화를 브라우저에서 불러옴');
  else console.warn('대기: origin-starlight.png가 아직 없어 배경 원화 확인과 스크린샷은 건너뜁니다.');

  async function showMap(map){
    Object.assign(p,{mapId:map.id,x:map.spawn.x,y:map.spawn.y});publish();
    await page.waitForFunction(id=>document.getElementById('minimap')?.dataset.mapId===id,map.id);
    await page.waitForTimeout(180);
  }
  // 같은 공용 미니맵 캔버스에서 중앙 마당과 바깥 우주 배경이 구별되어야 합니다.
  for(const map of ORIGIN_MAPS){
    assert.equal(isParadise(map.id),false);
    const floor=originFloor(map);assert.ok(floor);
    assert.ok(onParadiseFloor(map,map.spawn.x,map.spawn.y,RULES.radius),`${map.id} spawn`);
    for(const gate of map.objects.filter(o=>o.kind==='gate')){
      for(let i=0;i<=100;i++){
        const t=i/100,x=floor.cx+(gate.x-floor.cx)*t,y=floor.cy+(gate.y-floor.cy)*t;
        assert.ok(onOriginFloor(map,x,y,RULES.radius),`${map.id} ${gate.id} 길 ${i}%`);
      }
    }
    await showMap(map);
    const mini=await page.locator('#minimap').evaluate(canvas=>{
      const c=canvas.getContext('2d'),w=canvas.width,h=canvas.height;
      const center=[...c.getImageData(Math.floor(w/2),Math.floor(h/2),1,1).data];
      const corner=[...c.getImageData(2,2,1,1).data];return {center,corner,mapId:canvas.dataset.mapId};
    });
    assert.equal(mini.mapId,map.id);
    assert.ok(mini.center.slice(0,3).every((value,i)=>Math.abs(value-[210,207,228][i])<=3),`${map.id} 미니맵 바닥 중앙색 ${JSON.stringify(mini)}`);
    if(originArtLoaded)await page.screenshot({path:`.local/request273-${map.id}.png`});
    check(`${map.name}: 공용 바닥 경계·미니맵 마당/바깥 구분${originArtLoaded?'·실제 화면 저장':''}`);
  }

  // 화면에서 키보드로 북쪽 원형 경계에 접근합니다. 난간에서 더 나가지 않고 안정되어야 합니다.
  for(const map of ORIGIN_MAPS){
    const f=originFloor(map),x=f.cx+f.half+RULES.radius+34,y=f.cy-f.ry+110;
    assert.ok(onOriginFloor(map,x,y,RULES.radius),`${map.id} 키보드 경계 시작점`);
    await showMap(map);Object.assign(p,{x,y});publish();await page.waitForTimeout(120);
    await page.keyboard.down('w');await page.waitForTimeout(1700);await page.keyboard.up('w');
    await page.waitForTimeout(380);const stopped={x:p.x,y:p.y};await page.waitForTimeout(220);
    assert.ok(stopped.y<y,`${map.id} 키보드가 움직였음`);
    assert.ok(onOriginFloor(map,p.x,p.y,RULES.radius),`${map.id} 경계 안에서 정지`);
    assert.ok(Math.hypot(p.x-stopped.x,p.y-stopped.y)<1,`${map.id} 경계에서 멈춘 뒤 안정`);
    check(`${map.name}: 실제 W키 이동이 원형 외곽 난간에서 정지`);
  }

  // 각 출구로부터 중앙 쪽 150px에서 실제 키보드로 문에 다가가 F키를 눌러 이동합니다.
  for(const map of ORIGIN_MAPS){
    for(const gate of map.objects.filter(o=>o.kind==='gate')){
      const f=originFloor(map),vertical=Math.abs(gate.y-f.cy)>Math.abs(gate.x-f.cx);
      const horizontalKey=gate.x<f.cx?'a':'d',verticalKey=gate.y<f.cy?'w':'s';
      const approach={x:gate.x+(vertical?0:(gate.x<f.cx?150:-150)),y:gate.y+(vertical?(gate.y<f.cy?150:-150):0)};
      assert.ok(onOriginFloor(map,approach.x,approach.y,RULES.radius),`${map.id} ${gate.id} 접근 위치`);
      await showMap(map);Object.assign(p,approach);publish();await page.waitForTimeout(120);
      await page.keyboard.down(vertical?verticalKey:horizontalKey);await page.waitForTimeout(700);await page.keyboard.up(vertical?verticalKey:horizontalKey);
      await page.waitForFunction(name=>{const prompt=document.getElementById('interact-prompt'),caption=document.getElementById('interact-object');return !prompt.hidden&&caption.textContent===name;},gate.name,{timeout:12000});
      await page.keyboard.press('f');
      await page.waitForFunction(id=>document.getElementById('minimap')?.dataset.mapId===id,gate.target,{timeout:12000});
      const target=mapOf(gate.target);
      if(originFloor(target))assert.ok(onOriginFloor(target,p.x,p.y,RULES.radius),`${map.id} ${gate.id} 도착 바닥`);
      check(`${map.name}: 키보드로 ${gate.name}에 도달해 F키로 ${target.name} 이동`);
    }
  }
  assert.deepEqual(errors,[],'브라우저 런타임 오류가 없어야 합니다.');
  if(!originArtLoaded)throw new Error('키보드·게이트·미니맵 검사는 통과했지만 origin-starlight.png가 아직 없어 요청된 실제 원화 스크린샷은 저장하지 못했습니다. 이미지 복사 후 다시 실행하세요.');
  await writeFile('.local/request273-origin-floor-result.json',JSON.stringify({checks,errors,failures},null,2));
  console.log(`요청 273 브라우저 검증 ${checks.length}건 통과`);
}catch(error){
  failures.push({message:error.message,stack:error.stack});
  await writeFile('.local/request273-origin-floor-result.json',JSON.stringify({checks,errors,failures},null,2));
  throw error;
}finally{await browser.close();await game.close();}
