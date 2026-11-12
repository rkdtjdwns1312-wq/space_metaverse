import assert from 'node:assert/strict';
import {readFile,mkdir} from 'node:fs/promises';
import {chromium} from 'playwright';
const names=[['math-station','별 수학 제작소'],['history-station','별 역사 제작소'],['science-station','별 과학 제작소'],['culture-station','별 교양 제작소'],['english-station','별 영어 제작소'],['art-station','별 예술 제작소'],['shop','별 상점'],['energy-shop','우주에너지 상점'],['crafting','별빛 조합기']];
const browser=await chromium.launch({headless:true,...(process.platform==='win32'?{channel:'msedge'}:{})});
try{
 const page=await browser.newPage({viewport:{width:1140,height:1320}});
 await page.route('**/*',async route=>{
  const path=new URL(route.request().url()).pathname;
  if(path==='/')return route.fulfill({contentType:'text/html',body:'<html><head><meta charset="utf-8"></head><body></body></html>'});
  if(['/painted-props.js','/map-image.js','/street-prop-cache.js','/duel-arcade-art.js'].includes(path))return route.fulfill({contentType:'text/javascript',body:await readFile(new URL('../client'+path,import.meta.url))});
  if(/^\/assets\/maps\/[a-z-]+\.(png|webp)$/.test(path))return route.fulfill({contentType:path.endsWith('webp')?'image/webp':'image/png',body:await readFile(new URL('../client'+path,import.meta.url))});
  return route.fulfill({status:404,body:'not found'});
 });
 await page.goto('http://station.preview/');
 const result=await page.evaluate(async names=>{
  const {drawPaintedProp,preloadPaintedProps,PAINTED_PROPS}=await import('/painted-props.js');
  const {drawCachedStreetProp,streetPropCacheStats}=await import('/street-prop-cache.js');
  await preloadPaintedProps(names.map(([kind])=>kind));
  document.body.style.cssText='margin:0;background:#ded8e5;display:grid;grid-template-columns:repeat(3,380px)';
  const rows=[];
  for(const [kind,name] of names){
   const canvas=document.createElement('canvas');canvas.width=380;canvas.height=440;
   const ctx=canvas.getContext('2d',{willReadFrequently:true}),o={kind,name,x:190,y:300};
   let textCalls=[],panels=0;const fill=ctx.fillText.bind(ctx),round=ctx.roundRect.bind(ctx);
   ctx.fillText=(text,x,y,...rest)=>{textCalls.push({text,x,y});return fill(text,x,y,...rest);};ctx.roundRect=(...args)=>{panels++;return round(...args);};
   const rendered=drawPaintedProp(ctx,o);document.body.append(canvas);
   const comparisons=[];
   for(const scale of [1,2]){
    const pair=[document.createElement('canvas'),document.createElement('canvas')];
    pair.forEach(c=>{c.width=380*scale;c.height=440*scale;c.getContext('2d').scale(scale,scale);});
    drawPaintedProp(pair[0].getContext('2d'),o);const cached=drawCachedStreetProp(pair[1].getContext('2d'),o,true);
    const [a,b]=pair.map(c=>c.getContext('2d').getImageData(0,0,c.width,c.height).data);let changed=0,alphaA=0,alphaB=0;
    for(let i=0;i<a.length;i+=4){if(Math.max(...[0,1,2,3].map(n=>Math.abs(a[i+n]-b[i+n])))>24)changed++;if(a[i+3]>20)alphaA++;if(b[i+3]>20)alphaB++;}
    const first=streetPropCacheStats().builds;drawCachedStreetProp(pair[1].getContext('2d'),o,true);
    comparisons.push({scale,cached,changed:changed/(a.length/4),alphaA,alphaB,rebuild:streetPropCacheStats().builds-first});
   }
   rows.push({kind,rendered,textCalls,panels,foot:300+PAINTED_PROPS[kind].foot,comparisons});
  }
  return rows;
 },names);
 for(const row of result){assert(row.rendered);assert.equal(row.panels,0);assert.equal(row.textCalls.length,1);assert(row.textCalls[0].y>row.foot+15);for(const c of row.comparisons){assert(c.cached);assert(c.changed<.018);assert(Math.abs(c.alphaA-c.alphaB)/c.alphaA<.03);assert.equal(c.rebuild,0);}}
 await mkdir('.local/workshops-1112',{recursive:true});await page.screenshot({path:'.local/workshops-1112/buildings-gallery.png'});console.log(JSON.stringify({checks:result.length,cacheComparisons:result.length*2,result}));
}finally{await browser.close();}
