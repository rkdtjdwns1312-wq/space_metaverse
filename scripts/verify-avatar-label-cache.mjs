import assert from 'node:assert/strict';
import {mkdirSync,writeFileSync} from 'node:fs';
import {chromium} from 'playwright';
import {createClassroomServer} from '../server/app.js';
const out='.local/performance',game=createClassroomServer({teacherKey:'labels-isolated-check-only',studentHours:false});
mkdirSync(out,{recursive:true});let browser;
try{
  const {port}=await game.listen();browser=await chromium.launch({headless:true,channel:'msedge',args:['--no-proxy-server']});
  const page=await browser.newPage({viewport:{width:1280,height:800},deviceScaleFactor:2}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/label-test',route=>route.fulfill({contentType:'text/html',body:'<style>@font-face{font-family:Jua;src:url(/assets/fonts/Jua-Regular.ttf)}body{margin:0;background:#272744}canvas{display:block}</style><body></body>'}));
  await page.goto(`http://127.0.0.1:${port}/label-test`);
  const pixels=await page.evaluate(async()=>{
    const {createAvatarLabelCache,drawAvatarLabelDirect}=await import('/avatar-label-cache.js');
    await document.fonts.load('14px Jua');await document.fonts.ready;
    const results=[];
    for(const scale of [.35,1,1.0666666667,2,2.1333333333])for(const alpha of [1,.45]){
      const cache=createAvatarLabelCache(),canvases=[document.createElement('canvas'),document.createElement('canvas')];
      cache.beginFrame();
      for(const [index,canvas] of canvases.entries()){
        canvas.width=Math.ceil(640*scale);canvas.height=Math.ceil(230*scale);
        const ctx=canvas.getContext('2d',{willReadFrequently:true});ctx.scale(scale,scale);ctx.globalAlpha=alpha;
        for(const [i,label] of [{name:'선생님',detail:'LV6 별의수호자'},{name:'별빛 여행자 🌟',detail:'LV4 쌍둥이자리'},{name:'이름과 진화 단계 변경',detail:'LV5 황소자리 · 초월체'}].entries()){
          const x=320.35,y=12.2+i*68;
          if(index)cache.draw(ctx,label,i===0,x,y);else drawAvatarLabelDirect(ctx,label,i===0,x,y);
        }
      }
      const [before,after]=canvases.map(c=>c.getContext('2d').getImageData(0,0,c.width,c.height).data);
      let changed=0,delta=0,alphaBefore=0,alphaAfter=0;
      for(let i=0;i<before.length;i+=4){let peak=0;for(let k=0;k<4;k++){const d=Math.abs(before[i+k]-after[i+k]);peak=Math.max(peak,d);delta+=d;}if(peak>24)changed++;if(before[i+3]>20)alphaBefore++;if(after[i+3]>20)alphaAfter++;}
      results.push({scale,alpha,changedFraction:changed/(before.length/4),meanChannelDifference:delta/before.length,alphaBefore,alphaAfter,cache:cache.stats()});
      if(scale===2&&alpha===1){for(const [index,canvas] of canvases.entries()){const heading=document.createElement('h3');heading.style='color:white;font:20px Jua;margin:8px';heading.textContent=index?'캐시 재사용':'기존 직접 그리기';document.body.append(heading);canvas.style='width:640px;height:230px';document.body.append(canvas);}}
      cache.dispose();
    }
    return results;
  });
  for(const row of pixels){
    assert.ok(row.changedFraction<.025,JSON.stringify(row));assert.ok(row.meanChannelDifference<3,JSON.stringify(row));
    assert.ok(Math.abs(row.alphaAfter-row.alphaBefore)/Math.max(1,row.alphaBefore)<.025,JSON.stringify(row));assert.ok(row.cache.bytes<=row.cache.limit);
    if(row.alpha<1||row.scale<1)assert.equal(row.changedFraction,0);
  }
  await page.screenshot({path:out+'/avatar-label-cache-comparison.png'});
  await page.evaluate(async()=>{
    document.body.replaceChildren();
    const {createWorld}=await import('/world.js'),{mapOf}=await import('/shared/config.js');
    const map=mapOf('star-paradise'),x=map.width/2,y=map.height/2;
    const canvas=document.createElement('canvas');canvas.id='boss-label-fixture';canvas.style='width:100vw;height:100vh';document.body.append(canvas);
    const ctx=canvas.getContext('2d'),fillText=ctx.fillText,labels=new Map();ctx.fillText=function(text,x,y,...rest){labels.set(String(text),{x,y});return fillText.call(this,text,x,y,...rest);};
    const setTransform=ctx.setTransform,drawImage=ctx.drawImage;window.__sunmoonDraws=0;
    ctx.setTransform=function(...args){if(args.length===6&&args[0]===1&&args[3]===1&&args[4]===0&&args[5]===0)window.__sunmoonDraws=0;return setTransform.apply(this,args);};
    ctx.drawImage=function(...args){if(args[0]?.src?.endsWith('/spirit-sunmoon-orb.webp'))window.__sunmoonDraws++;return drawImage.apply(this,args);};
    window.__bossLabels=labels;window.__bossLabelWorld=createWorld(canvas);
    window.__bossLabelMonsters=[{id:'king-fixture',typeId:'spirit-king',alive:true,mapId:map.id,x:x-20,y:y+15,radius:150,hp:10000,maxHp:10000,mp:100,maxMp:100},{id:'guardian-fixture',typeId:'star-guardian',alive:true,mapId:map.id,x:x+100,y:y+230,radius:30,hp:300,maxHp:300,mp:10,maxMp:10}];
    window.__bossLabelSelf={id:'fixture-self',role:'teacher',nickname:'검사',connected:true,away:true,mapId:map.id,x,y,avatar:{level:1},inventory:[],equipment:[]};
    const now=Date.now(),spiritOrbs=[200,300].map((offset,i)=>({id:'orb-'+i,mapId:map.id,x:x-110,y:y+offset,radius:32,startsAt:now,endsAt:now+30000}));
    window.__bossLabelWorld.setRoom({players:[window.__bossLabelSelf],planets:[],monsters:window.__bossLabelMonsters,spiritOrbs},'fixture-self');
  });
  await page.waitForFunction(()=>document.querySelector('#boss-label-fixture').dataset.artStatus==='ready'&&window.__bossLabels.has('MP 10 / 10'));
  await page.waitForFunction(()=>window.__sunmoonDraws===2);
  const layouts=[];
  for(const [width,height] of [[1280,800],[390,844],[844,390]]){
    await page.setViewportSize({width,height});await page.waitForTimeout(250);
    const layout=await page.evaluate(async()=>{
      const {spiritKingLabelTop,monsterManaLayout}=await import('/boss-label-layout.js');
      const [boss]=window.__bossLabelMonsters,top=spiritKingLabelTop(boss,performance.now());
      const labels=Object.fromEntries(window.__bossLabels),world=window.__bossLabelWorld;
      return {top,labels,mana:monsterManaLayout(true,top-48,14),bossPoint:world.screenPoint(boss),stats:world.labelCacheStats(),sunmoonDraws:window.__sunmoonDraws};
    });
    assert.equal(layout.labels['성령의 왕'].y,layout.top-64);
    assert.equal(layout.labels['10000 / 10000'].y,layout.top-37);
    assert.equal(layout.labels['MP 100 / 100'].y,layout.mana.textY);
    assert.ok(layout.labels['MP 10 / 10'].y>layout.labels['300 / 300'].y+20);
    assert.equal(layout.sunmoonDraws,2,'both new painted sun/moon orbs are drawn in the same frame');
    layouts.push({width,height,...layout});await page.screenshot({path:`${out}/spirit-guardian-labels-${width}.png`});
  }
  await page.setViewportSize({width:1280,height:800});
  await page.evaluate(()=>{window.__bossLabelMonsters[1].mp=5;window.__bossLabelWorld.monsters({mapId:'star-paradise',monsters:window.__bossLabelMonsters});window.__bossLabelWorld.monsterHit({mapId:'star-paradise',monsterId:'king-fixture',dx:1,dy:0,noEffect:true});});
  await page.waitForFunction(()=>window.__bossLabels.has('MP 5 / 10'));await page.waitForTimeout(350);
  await page.screenshot({path:out+'/spirit-guardian-labels-attack.png'});
  await page.evaluate(()=>window.__bossLabelWorld.setQuality('low'));await page.waitForFunction(()=>document.querySelector('#boss-label-fixture').dataset.renderQuality==='low'&&window.__sunmoonDraws===2);
  await page.screenshot({path:out+'/spirit-guardian-labels-low.png'});
  assert.deepEqual(errors,[]);writeFileSync(out+'/avatar-label-cache-verification.json',JSON.stringify({pixels,layouts,errors},null,2));
  console.log(JSON.stringify({pixelChecks:pixels.length,maxChangedFraction:Math.max(...pixels.map(p=>p.changedFraction)),layouts:layouts.map(l=>({width:l.width,height:l.height,kingNameY:l.labels['성령의 왕'].y,kingArtTop:l.top,guardianMpY:l.labels['MP 10 / 10'].y})),errors},null,2));
}finally{await browser?.close();await game.close();}
