import assert from 'node:assert/strict';
import {mkdirSync,writeFileSync} from 'node:fs';
import {chromium} from 'playwright';
import {createClassroomServer} from '../server/app.js';
const out='.local/street-performance';mkdirSync(out,{recursive:true});
const game=createClassroomServer({teacherKey:'cache-test-only-key',studentHours:false});const {port}=await game.listen();
const browser=await chromium.launch({headless:true,args:['--no-proxy-server'],...(process.platform==='win32'?{channel:'msedge'}:{})});
try{
  const page=await browser.newPage({viewport:{width:1200,height:760}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/cache-test',route=>route.fulfill({contentType:'text/html',body:'<body style="margin:0"></body>'}));
  await page.goto(`http://127.0.0.1:${port}/cache-test`);
  const results=await page.evaluate(async()=>{
    const {STREET}=await import('/shared/config.js'),{prepareMapArt}=await import('/map-art-ready.js'),{drawPaintedProp,PAINTED_PROPS}=await import('/painted-props.js'),{drawDuelArcade}=await import('/duel-arcade-art.js'),{drawCachedStreetProp,streetPropCacheStats}=await import('/street-prop-cache.js'),{drawStreetGround}=await import('/street-art.js');
    await prepareMapArt(STREET).promise;await document.fonts.ready;
    const objects=STREET.objects.filter(o=>PAINTED_PROPS[o.kind]||o.kind==='duel-arcade'),results=[];
    for(const scale of [1,2,.23])for(const y of [320,1310,2430]){
      const visible=objects.filter(o=>o.x+300>=300&&o.x-300<=1500&&o.y+150>=y&&o.y-360<=y+760);
      const canvases=[document.createElement('canvas'),document.createElement('canvas')];
      for(const [index,canvas] of canvases.entries()){
        canvas.width=1200*scale;canvas.height=760*scale;
        const c=canvas.getContext('2d',{willReadFrequently:true});c.scale(scale,scale);c.translate(-300,-y);
        for(const o of index?visible:objects){if(index&&drawCachedStreetProp(c,o,true))continue;if(o.kind==='duel-arcade')drawDuelArcade(c,o);else drawPaintedProp(c,o);}
      }
      const [before,after]=canvases.map(c=>c.getContext('2d').getImageData(0,0,c.width,c.height).data);
      let changed=0,alphaBefore=0,alphaAfter=0;for(let i=0;i<before.length;i+=4){if(Math.max(...[0,1,2,3].map(n=>Math.abs(before[i+n]-after[i+n])))>24)changed++;if(before[i+3]>20)alphaBefore++;if(after[i+3]>20)alphaAfter++;}
      const first=streetPropCacheStats();for(const o of visible)drawCachedStreetProp(canvases[1].getContext('2d'),o,true);const second=streetPropCacheStats();
      results.push({scale,y,changedFraction:changed/(before.length/4),alphaBefore,alphaAfter,cache:second,repeatedBuilds:second.builds-first.builds});
    }
    const canvas=document.createElement('canvas');canvas.width=1200;canvas.height=760;document.body.append(canvas);const c=canvas.getContext('2d');c.translate(-300,-2430);drawStreetGround(c,STREET);for(const o of objects)drawCachedStreetProp(c,o,true);
    return results;
  });
  for(const r of results){assert(r.changedFraction<.018,`Visual difference ${JSON.stringify(r)}`);assert(Math.abs(r.alphaAfter-r.alphaBefore)/Math.max(1,r.alphaBefore)<.03);assert.equal(r.repeatedBuilds,0);assert(r.cache.bytes<=r.cache.limit);}
  assert.deepEqual(errors,[]);await page.screenshot({path:out+'/cached-arcades.png'});writeFileSync(out+'/visual-cache.json',JSON.stringify(results,null,2));console.log(JSON.stringify(results,null,2));
}finally{await browser.close();await game.close();}
