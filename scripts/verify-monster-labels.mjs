import assert from 'node:assert/strict';
import {mkdirSync,writeFileSync} from 'node:fs';
import {chromium} from 'playwright';
import {createClassroomServer} from '../server/app.js';
const out='.local/monster-labels';mkdirSync(out,{recursive:true});
const game=createClassroomServer({teacherKey:'monster-label-test-key',studentHours:false});const {port}=await game.listen();
const browser=await chromium.launch({headless:true,args:['--no-proxy-server'],...(process.platform==='win32'?{channel:'msedge'}:{})});
const results=[],errors=[];
try{
  const page=await browser.newPage({viewport:{width:1200,height:760}});page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/monster-test',route=>route.fulfill({contentType:'text/html',body:'<body class="joined" style="margin:0"><canvas style="width:1200px;height:760px"></canvas>'}));
  await page.goto(`http://127.0.0.1:${port}/monster-test`);
  await page.evaluate(async()=>{
    window.testImages=[];const NativeImage=Image;window.Image=function(...args){const image=new NativeImage(...args);testImages.push(image);return image;};
    const {createWorld}=await import('/world.js');window.world=createWorld(document.querySelector('canvas'));
  });
  for(const id of ['star-crab','star-scorpion','star-guardian','leoon','noksera','spirit-king','serena']){
    await page.evaluate(async id=>{
      const {monsterType}=await import('/shared/monsters.js'),{mapOf}=await import('/shared/config.js');const type=monsterType(id),map=mapOf(type.mapId);
      window.monster={...type,id:'m0',typeId:id,mapId:map.id,x:map.width/2,y:map.height/2+30,radius:type.radius||(type.boss?120:32),hp:250,maxHp:1000,mp:65,maxMp:100,alive:true};
      window.player={id:'p0',mapId:map.id,x:monster.x-180,y:monster.y-60,role:'student',nickname:'검사',avatar:{level:1},effects:[]};
      world.setRoom({players:[player],monsters:[monster],planets:[],serena:{state:'awake'}},player.id);
    },id);
    await page.waitForTimeout(100);
    await page.waitForFunction(()=>document.querySelector('canvas').dataset.artStatus==='ready');
    await page.waitForFunction(()=>testImages.filter(i=>i.src).every(i=>i.complete&&i.naturalWidth));
    const record=await page.evaluate(async()=>{
      const c=document.querySelector('canvas').getContext('2d'),text=c.fillText.bind(c),rect=c.roundRect.bind(c),labels=[],bars=[];
      c.fillText=(value,x,y,...args)=>{if(value===monster.name||value==='250 / 1000'||value==='MP 65 / 100')labels.push({value,x,y});return text(value,x,y,...args);};
      c.roundRect=(x,y,w,h,...args)=>{if((w===64&&h===9)||(w===200&&[14,12].includes(h)))bars.push({x,y,w,h});return rect(x,y,w,h,...args);};
      await new Promise(resolve=>requestAnimationFrame(()=>resolve()));c.fillText=text;c.roundRect=rect;
      const {bossMonsterBounds}=await import('/boss-monster-art.js');return {id:monster.typeId,boss:!!monster.boss,labels,bars,bounds:monster.boss?bossMonsterBounds(monster):null};
    });
    const name=record.labels.find(l=>l.value!=='250 / 1000'&&!l.value.startsWith('MP')),hp=record.bars.find(b=>b.h!==12);assert(name&&hp,id);
    assert(hp.y>name.y&&hp.y-name.y<25,`${id}: bar directly under name`);
    if(record.boss){assert(hp.y+hp.h<record.bounds.top);const mp=record.bars.find(b=>b.h===12);assert(mp.y>hp.y+hp.h&&mp.y+mp.h<record.bounds.top);}
    results.push(record);await page.screenshot({path:`${out}/${id}.png`});
  }
  const guardian=await page.evaluate(async()=>{
    const {drawGuardianMonster,preloadGuardianArt}=await import('/guardian-monster-art.js');await preloadGuardianArt();
    return [120,30].map(radius=>{const c=document.createElement('canvas').getContext('2d'),draw=c.drawImage.bind(c);let dimensions;c.drawImage=(...args)=>{dimensions=args.slice(-2);return draw(...args);};drawGuardianMonster(c,{shape:'star-guardian',radius,x:500,y:500},0);return {radius,width:dimensions[0],height:dimensions[1]};});
  });
  assert.equal(guardian[1].width/guardian[0].width,.25);assert.equal(guardian[1].height/guardian[0].height,.25);assert.deepEqual(errors,[]);
  writeFileSync(out+'/report.json',JSON.stringify({results,guardian,errors},null,2));console.log(JSON.stringify({results,guardian,errors},null,2));
}finally{await browser.close();await game.close();}
