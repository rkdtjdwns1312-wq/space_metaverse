import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {chromium} from 'playwright';

// 실제 원화와 Canvas 렌더러만 격리해서 확인합니다. 게임 서버나 교실 자료는 쓰지 않습니다.
const names=[['math','수학'],['history','역사'],['science','과학'],['culture','교양'],['english','영어']];
const browser=await chromium.launch({headless:true,...(process.platform==='win32'?{channel:'msedge'}:{})});
try{
  const page=await browser.newPage({viewport:{width:1900,height:530}});
  await page.route('**/*',async route=>{
    const path=new URL(route.request().url()).pathname;
    if(path==='/')return route.fulfill({contentType:'text/html',body:'<html><head><meta charset="utf-8"></head><body></body></html>'});
    if(path==='/painted-props.js')return route.fulfill({contentType:'text/javascript',body:await readFile(new URL('../client/painted-props.js',import.meta.url))});
    if(/^\/assets\/maps\/[a-z-]+\.png$/.test(path)){
      return route.fulfill({contentType:'image/png',body:await readFile(new URL(`../client${path}`,import.meta.url))});
    }
    return route.fulfill({status:404,body:'not found'});
  });
  await page.goto('http://station.preview/');
  const result=await page.evaluate(async names=>{
    const {drawPaintedProp,preloadPaintedProps}=await import('/painted-props.js');
    await preloadPaintedProps();
    document.body.style.cssText='margin:0;padding:16px;background:#243353;color:#fff3d4;font:18px "Malgun Gothic",sans-serif;display:flex;gap:12px';
    const rows=[];
    for(const [name,label] of names){
      const cell=document.createElement('div');cell.style.cssText='width:355px;text-align:center';
      const canvas=document.createElement('canvas');canvas.width=355;canvas.height=430;
      const ctx=canvas.getContext('2d',{willReadFrequently:true});
      let imageArgs,signY,panels=0;
      const draw=ctx.drawImage.bind(ctx),fillText=ctx.fillText.bind(ctx),roundRect=ctx.roundRect.bind(ctx);
      ctx.drawImage=(...args)=>{imageArgs=args.slice(1);return draw(...args)};
      ctx.fillText=(...args)=>{signY=args[2];return fillText(...args)};
      ctx.roundRect=(...args)=>{panels++;return roundRect(...args)};
      const rendered=drawPaintedProp(ctx,{kind:`${name}-station`,name:`별 ${label} 발전소`,x:177.5,y:340});
      const pixels=ctx.getImageData(0,0,355,430).data;
      let left=355,top=430,right=0,bottom=0;
      for(let y=0;y<430;y++)for(let x=0;x<355;x++)if(pixels[(y*355+x)*4+3]>16){
        left=Math.min(left,x);top=Math.min(top,y);right=Math.max(right,x);bottom=Math.max(bottom,y);
      }
      const title=document.createElement('div');title.textContent=label;
      cell.append(canvas,title);document.body.append(cell);
      rows.push({name,rendered,source:imageArgs.slice(0,4),destination:imageArgs.slice(4),signY,panels,bounds:{left,top,right,bottom}});
    }
    return rows;
  },names);
  for(const row of result){
    assert.equal(row.rendered,true,`${row.name} 원화가 로드되어야 합니다`);
    assert.equal(row.panels,0,`${row.name} 원화의 고유한 곡선 간판이 드러나야 합니다`);
    assert.ok(row.bounds.right-row.bounds.left>=300,`${row.name} 건물이 화면에서 충분히 커야 합니다`);
    assert.ok(row.bounds.bottom-row.bounds.top>=295,`${row.name} 건물 높이가 유지되어야 합니다`);
    assert.ok(row.bounds.bottom<=420,`${row.name} 건물 바닥이 렌더 상자 안에 있어야 합니다`);
  }
  for(const name of ['history','science','culture']){
    const row=result.find(entry=>entry.name===name);
    assert.ok(row.source[0]>0&&row.source[1]>0,`${name} 원화의 투명 여백을 잘라야 합니다`);
    assert.ok(row.signY>=225&&row.signY<=255,`${name} 글씨가 원화 간판 중앙에 있어야 합니다`);
  }
  const screenshot=join(tmpdir(),'codex-learning-stations-preview.png');
  await page.screenshot({path:screenshot});
  console.log(JSON.stringify({screenshot,result},null,2));
}finally{await browser.close()}
