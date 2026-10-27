import {createBlankPlanetDesign,drawPlanetDesign,normalizePlanetDesign,PLANET_DESIGN_LIMITS} from '/shared/planet-design.js';

/** Opens a temporary editor. Saving returns structured data; cancelling changes nothing. */
export function openPlanetDesigner({design=null,onSave=()=>{},onCancel=()=>{}}={}){
  const previousFocus=document.activeElement,dialog=document.createElement('dialog');
  dialog.className='planet-designer';dialog.id='planet-designer-dialog';dialog.setAttribute('aria-labelledby','planet-designer-title');
  dialog.innerHTML=`<h2 id="planet-designer-title">나만의 행성 그리기</h2>
    <p class="planet-designer-hint" id="planet-designer-help">붓으로 그리거나, 도형을 골라 행성 위에서 끌어 보세요.</p>
    <div class="planet-designer-tools" role="group" aria-label="그리기 도구">
      <button type="button" data-tool="brush" aria-pressed="true">✎ 붓</button><button type="button" data-tool="circle" aria-pressed="false">○ 동그라미</button><button type="button" data-tool="rect" aria-pressed="false">□ 네모</button><button type="button" data-tool="star" aria-pressed="false">☆ 별</button>
    </div>
    <div class="planet-designer-options"><label>그림 색 <input type="color" data-field="color" value="#7258a3"></label><label>행성 색 <input type="color" data-field="background"></label><label>굵기 <input type="range" data-field="width" min="2" max="32" value="10" aria-label="붓과 테두리 굵기"></label><label class="planet-designer-fill"><input type="checkbox" data-field="fill" checked> 도형 채우기</label></div>
    <canvas width="512" height="512" aria-label="행성 그림판" aria-describedby="planet-designer-help"></canvas>
    <div class="planet-designer-history"><button type="button" data-action="undo">↶ 되돌리기</button><button type="button" data-action="clear">그림 지우기</button><span data-field="count"></span></div>
    <p class="planet-designer-status" role="status" aria-live="polite"></p>
    <div class="planet-designer-actions"><button type="button" data-action="cancel" class="secondary">취소</button><button type="button" data-action="save" class="primary">이 디자인 사용하기</button></div>`;
  document.body.append(dialog);
  const $=selector=>dialog.querySelector(selector),canvas=$('canvas'),ctx=canvas.getContext('2d'),status=$('[role="status"]');
  let current=normalizePlanetDesign(design)||createBlankPlanetDesign(),tool='brush',draft=null,pointerId=null,start=null,saved=false,busy=false;
  const history=[];
  $('[data-field="background"]').value=current.background;
  function remember(){history.push(JSON.stringify(current));if(history.length>50)history.shift();}
  function paint(){
    ctx.clearRect(0,0,512,512);drawPlanetDesign(ctx,draft?{...current,marks:[...current.marks,draft]}:current,0,0,512);
    $('[data-action="undo"]').disabled=!history.length;
    $('[data-action="clear"]').disabled=!current.marks.length;
    $('[data-field="count"]').textContent=`${current.marks.length} / ${PLANET_DESIGN_LIMITS.marks}`;
  }
  function commit(next){
    const valid=normalizePlanetDesign(next);
    if(!valid){status.textContent='그림이 꽉 찼어요. 되돌리거나 그림을 지운 뒤 다시 그려 주세요.';paint();return false;}
    remember();current=valid;status.textContent='';paint();return true;
  }
  function point(event){const box=canvas.getBoundingClientRect();return [Math.max(0,Math.min(256,Math.round((event.clientX-box.left)/box.width*256))),Math.max(0,Math.min(256,Math.round((event.clientY-box.top)/box.height*256)))];}
  function updateDraft(event){
    const p=point(event);
    if(draft.tool==='brush'){
      const last=draft.points.at(-1);
      if(Math.hypot(p[0]-last[0],p[1]-last[1])<1)return;
      const existing=current.marks.reduce((sum,mark)=>sum+(mark.points?.length||0),0);
      if(draft.points.length<PLANET_DESIGN_LIMITS.strokePoints&&existing+draft.points.length<PLANET_DESIGN_LIMITS.totalPoints)draft.points.push(p);
      else{draft.points[draft.points.length-1]=p;status.textContent='긴 선은 여기까지 그려져요. 손을 떼고 새 선을 그려 주세요.';}
    }else{
      draft.x=Math.min(start[0],p[0]);draft.y=Math.min(start[1],p[1]);draft.w=Math.max(1,Math.abs(start[0]-p[0]));draft.h=Math.max(1,Math.abs(start[1]-p[1]));
      draft.x=Math.min(draft.x,256-draft.w);draft.y=Math.min(draft.y,256-draft.h);
    }
    paint();
  }
  canvas.addEventListener('pointerdown',event=>{
    if(busy||pointerId!==null||event.button!==0)return;
    status.textContent='';
    if(current.marks.length>=PLANET_DESIGN_LIMITS.marks||current.marks.reduce((n,m)=>n+(m.points?.length||0),0)>=PLANET_DESIGN_LIMITS.totalPoints&&tool==='brush'){status.textContent='그림이 꽉 찼어요. 되돌리거나 그림을 지워 주세요.';return;}
    start=point(event);pointerId=event.pointerId;canvas.setPointerCapture(pointerId);
    const base={tool,color:$('[data-field="color"]').value,width:Number($('[data-field="width"]').value)};
    draft=tool==='brush'?{...base,points:[start]}:{...base,fill:$('[data-field="fill"]').checked,x:Math.min(start[0],255),y:Math.min(start[1],255),w:1,h:1};paint();
  });
  canvas.addEventListener('pointermove',event=>{if(event.pointerId===pointerId&&draft)updateDraft(event);});
  canvas.addEventListener('pointerup',event=>{
    if(event.pointerId!==pointerId||!draft)return;
    updateDraft(event);const mark=draft;draft=null;pointerId=null;
    if(canvas.hasPointerCapture(event.pointerId))canvas.releasePointerCapture(event.pointerId);
    commit({...current,marks:[...current.marks,mark]});
  });
  const discardStroke=()=>{draft=null;pointerId=null;paint();};
  canvas.addEventListener('pointercancel',event=>{if(event.pointerId===pointerId)discardStroke();});
  canvas.addEventListener('lostpointercapture',()=>{if(draft)discardStroke();});
  for(const button of dialog.querySelectorAll('[data-tool]'))button.addEventListener('click',()=>{
    tool=button.dataset.tool;for(const item of dialog.querySelectorAll('[data-tool]'))item.setAttribute('aria-pressed',String(item===button));
    $('[data-field="fill"]').disabled=tool==='brush';
  });
  $('[data-field="fill"]').disabled=true;
  $('[data-field="background"]').addEventListener('change',event=>{commit({...current,background:event.target.value});});
  $('[data-action="undo"]').onclick=()=>{if(!history.length)return;current=JSON.parse(history.pop());$('[data-field="background"]').value=current.background;status.textContent='';paint();};
  $('[data-action="clear"]').onclick=()=>{commit({...current,marks:[]});};
  $('[data-action="cancel"]').onclick=()=>dialog.close();
  dialog.addEventListener('cancel',event=>{if(busy)event.preventDefault();});
  // Native dialog manages focus, Escape and Tab; keep game shortcuts out of the editor.
  for(const name of ['keydown','keyup'])dialog.addEventListener(name,event=>event.stopPropagation());
  $('[data-action="save"]').onclick=async()=>{
    if(busy)return;const result=normalizePlanetDesign(current);if(!result)return;
    busy=true;for(const input of dialog.querySelectorAll('button,input'))input.disabled=true;
    try{await onSave(result);saved=true;dialog.close();}
    catch(error){status.textContent=error?.message||'디자인을 적용하지 못했어요. 다시 시도해 주세요.';}
    finally{busy=false;for(const input of dialog.querySelectorAll('button,input'))input.disabled=false;$('[data-field="fill"]').disabled=tool==='brush';paint();}
  };
  dialog.addEventListener('close',()=>{dialog.remove();if(previousFocus?.isConnected)previousFocus.focus();if(!saved)onCancel();},{once:true});
  paint();dialog.showModal();
  return {dialog,close(){dialog.close();},getDesign(){return normalizePlanetDesign(current);}};
}
