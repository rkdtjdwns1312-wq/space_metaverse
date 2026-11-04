import {ART_LIMITS as L,ART_TEACHER_OWNER,ART_SHAPE_TOOLS,artDrawingPointCount,createArtFill,blankArtDrawing,normalizeArtDrawing,paintArtDrawing} from '/shared/art-studio.js';

export function createArtStudioUI({request,stop,getPlayer,toast}){
 const dialog=document.createElement('dialog');dialog.id='art-studio-dialog';dialog.setAttribute('aria-labelledby','art-studio-title');
 dialog.innerHTML=`<header class="art-studio-header"><div><span>상상하는 대로, 나만의 그림</span><h2 id="art-studio-title">별 예술 발전소</h2></div><button type="button" data-art="close" class="secondary">닫기</button></header>
 <p class="art-studio-intro">내 작품은 10개까지 보관해요. 저장한 작품은 같은 교실 친구들과 선생님이 감상하고 PNG 그림으로 내려받을 수 있어요.</p>
 <nav data-art="menu" class="art-studio-entry-menu" aria-label="예술 발전소 활동 선택"><button type="button" data-art-tab="friends"><strong>친구 작품 보기</strong><span>같은 교실의 작품을 감상해요</span></button><button type="button" data-art-tab="mine"><strong>작품 직접 만들기</strong><span>그림을 그리고 내 작품을 보관해요</span></button></nav><div data-art="workspace" hidden><button type="button" data-art="back" class="secondary art-studio-back">← 처음으로</button>
 <div class="art-studio-layout"><aside class="art-studio-gallery"><label data-art="friend-label" hidden>친구 고르기<select data-art="friend"></select></label><h3 data-art="gallery-title">내 작품</h3><button type="button" data-art="new" class="secondary">＋ 새 그림 그리기</button><div data-art="list" class="art-studio-list"></div></aside>
 <section class="art-studio-editor" aria-label="그림판"><label class="art-studio-title-field">작품 제목<input data-art="title" maxlength="40" placeholder="그림에 이름을 붙여주세요" autocomplete="off"></label>
 <div data-art="tools" class="art-studio-tools"><div role="group" aria-label="그리기 도구"><button type="button" data-art-tool="brush" aria-pressed="true">붓</button><button type="button" data-art-tool="eraser" aria-pressed="false">지우개</button><button type="button" data-art-tool="fill" aria-pressed="false">🪣 페인트통</button></div><div role="group" aria-label="도형 넣기"><button type="button" data-art-tool="rectangle" aria-pressed="false">□ 네모</button><button type="button" data-art-tool="ellipse" aria-pressed="false">○ 원</button><button type="button" data-art-tool="triangle" aria-pressed="false">△ 삼각형</button><button type="button" data-art-tool="star" aria-pressed="false">☆ 별</button></div><label>색상<input type="color" data-art="color" value="#7258a3"></label><label>굵기<input type="range" data-art="width" min="1" max="40" value="8"><output data-art="width-label">8</output></label><button type="button" data-art="undo">되돌리기</button><button type="button" data-art="clear">모두 지우기</button></div><p data-art="tool-hint" class="art-studio-capacity"></p>
 <p data-art="view-note" class="art-studio-view-note" hidden>친구의 작품을 감상하고 있어요.</p><canvas width="600" height="400" data-art="canvas" aria-label="600×400 그림판"></canvas><p data-art="capacity" class="art-studio-capacity"></p>
 <div class="art-studio-actions"><button type="button" data-art="save" class="primary">새 작품 저장</button><button type="button" data-art="delete" class="secondary" hidden>작품 삭제</button><button type="button" data-art="download" class="secondary">PNG 내려받기</button></div></section></div></div><p data-art="status" class="art-studio-status" role="status" aria-live="polite"></p>`;
 document.body.append(dialog);const $=name=>dialog.querySelector(`[data-art="${name}"]`),canvas=$('canvas'),ctx=canvas.getContext('2d');
 let epoch=0,busy=false,tab=null,ownerId=null,roster=[],list=[],work=null,drawing=blankArtDrawing(),dirty=false,tool='brush',history=[],stroke=null,pointerId=null,pointBudget=0,requestId=crypto.randomUUID(),paintFrame=null;
 const ownId=()=>getPlayer()?.role==='teacher'?ART_TEACHER_OWNER:getPlayer()?.id;
 const editable=()=>tab==='mine'&&['student','teacher'].includes(getPlayer()?.role);
 const message=text=>{$('status').textContent=text;};
 function discardOkay(){return !dirty||confirm('아직 저장하지 않은 그림이 있어요. 저장하지 않고 이동할까요?');}
 function renderPaint(){paintFrame=null;paintArtDrawing(ctx,stroke?{...drawing,strokes:[...drawing.strokes,stroke]}:drawing);}
 function paint(){if(paintFrame===null)paintFrame=requestAnimationFrame(renderPaint);}
 function cancelStroke(){stroke=null;pointerId=null;paint();}
 function blank(){cancelStroke();work=null;drawing=blankArtDrawing();$('title').value='';history=[];dirty=false;requestId=crypto.randomUUID();}
 function setWork(next){cancelStroke();work=next;drawing=normalizeArtDrawing(next.drawing)||blankArtDrawing();$('title').value=next.title;history=[];dirty=false;requestId=crypto.randomUUID();}
 function controls(){
  const edit=editable();$('menu').hidden=tab!==null;$('workspace').hidden=tab===null;$('tools').hidden=!edit;$('new').hidden=!edit;$('save').hidden=!edit;$('delete').hidden=!edit||!work;$('title').readOnly=!edit;$('view-note').hidden=edit;
  $('view-note').textContent=work?'감상 중인 작품이에요. PNG로 내려받아 간직할 수 있어요.':'작품 주인을 고르고 제목을 눌러 감상해보세요.';
  canvas.classList.toggle('readonly',!edit);$('save').textContent=work?'수정한 작품 저장':'새 작품 저장';
  $('tool-hint').hidden=!edit;$('tool-hint').textContent=tool==='fill'?'색을 고르고 눌러요. 같은 색으로 이어진 영역을 한 번에 칠해요.':ART_SHAPE_TOOLS.includes(tool)?'그림판을 눌러 도형을 넣거나, 끌어서 크기를 정해요.':'그림판에 마우스나 손가락으로 자유롭게 그려요.';
  for(const input of dialog.querySelectorAll('button,input,select'))input.disabled=busy;
  $('save').disabled=busy||!edit||(!work&&list.length>=L.works);$('delete').disabled=busy||!work;$('undo').disabled=busy||!history.length;$('clear').disabled=busy||!drawing.strokes.length;$('download').disabled=busy||(!edit&&!work);
  $('capacity').textContent=edit?(dirty?'아직 저장하지 않았어요':'저장한 그림을 불러오거나 새로 그려보세요'):'';
  for(const button of dialog.querySelectorAll('[data-art-tool]'))button.setAttribute('aria-pressed',String(button.dataset.artTool===tool));
 }
 function gallery(){
  for(const button of dialog.querySelectorAll('[data-art-tab]'))button.setAttribute('aria-pressed',String(button.dataset.artTab===tab));
  $('friend-label').hidden=tab==='mine';$('gallery-title').textContent=tab==='mine'?`내 작품 ${list.length} / ${L.works}`:'친구와 선생님 작품';
  $('friend').replaceChildren(...roster.filter(p=>p.id!==ownId()).map(p=>{const o=document.createElement('option');o.value=p.id;o.textContent=`${p.nickname} (${p.count})`;o.selected=p.id===ownerId;return o;}));
  $('list').replaceChildren(...list.map(w=>{const button=document.createElement('button');button.type='button';button.className='art-studio-work';button.dataset.artWork=w.id;button.textContent=w.title;button.setAttribute('aria-pressed',String(work?.id===w.id));button.onclick=()=>loadWork(w.id);return button;}));
  if(!list.length){const empty=document.createElement('p');empty.textContent=tab==='mine'?'아직 저장한 작품이 없어요. 첫 그림을 그려볼까요?':'아직 저장한 작품이 없어요.';$('list').append(empty);}controls();paint();
 }
 async function loadList(id){
  const ticket=++epoch;busy=true;blank();list=[];ownerId=id??null;gallery();message('작품 보관함을 열고 있어요…');controls();
  try{const result=await request('art:list',id?{ownerId:id}:{view:tab==='friends'?'friends':'mine'});if(ticket!==epoch)return;ownerId=result.ownerId;roster=result.roster;list=result.works;blank();message('');gallery();}
  catch(e){if(ticket===epoch)message(e.message||'작품을 불러오지 못했어요.');}
  finally{if(ticket===epoch){busy=false;controls();}}
 }
 async function loadWork(id){
  if(busy||!discardOkay())return;const ticket=++epoch;busy=true;controls();message('그림을 불러오고 있어요…');
  try{const result=await request('art:get',{ownerId,id});if(ticket!==epoch)return;setWork(result.work);message('');gallery();}
  catch(e){if(ticket===epoch)message(e.message||'그림을 불러오지 못했어요.');}finally{if(ticket===epoch){busy=false;controls();}}
 }
 function remember(){history.push(JSON.stringify(drawing));if(history.length>30)history.shift();}
 function commit(next){const valid=normalizeArtDrawing(next);if(!valid){message('그림이 꽉 찼어요. 되돌리거나 모두 지운 뒤 다시 그려주세요.');paint();return;}remember();drawing=valid;dirty=true;controls();paint();}
 const point=e=>{const b=canvas.getBoundingClientRect();return [Math.max(0,Math.min(600,Math.round((e.clientX-b.left)/b.width*600))),Math.max(0,Math.min(400,Math.round((e.clientY-b.top)/b.height*400)))];};
 function move(e){const p=point(e),last=stroke.points.at(-1);if(p[0]===last[0]&&p[1]===last[1])return;if(ART_SHAPE_TOOLS.includes(stroke.tool))stroke.points[1]=p;else if(stroke.points.length<pointBudget)stroke.points.push(p);else message('긴 선은 여기까지 그려져요. 손을 떼고 새 선을 그려주세요.');paint();}
 canvas.addEventListener('pointerdown',e=>{
  if(busy||!editable()||pointerId!==null||e.button!==0)return;
  pointBudget=Math.min(L.strokePoints,L.points-artDrawingPointCount(drawing));
  if(pointBudget<(ART_SHAPE_TOOLS.includes(tool)?2:1)){message('그림이 꽉 찼어요. 되돌리거나 모두 지운 뒤 다시 그려주세요.');return;}
  e.preventDefault();message('');const p=point(e);
  if(tool==='fill'){
   if(paintFrame!==null){cancelAnimationFrame(paintFrame);paintFrame=null;}renderPaint();
   try{
    const filled=createArtFill(ctx.getImageData(0,0,L.width,L.height),Math.min(L.width-1,p[0]),Math.min(L.height-1,p[1]),$('color').value,{maxSpans:L.points-artDrawingPointCount(drawing)});
    if(filled)commit({...drawing,strokes:[...drawing.strokes,filled]});else message('이미 같은 색으로 칠해져 있어요.');
   }catch(error){message(error instanceof RangeError?'그림이 꽉 찼어요. 되돌리거나 모두 지운 뒤 다시 그려주세요.':'이 영역을 채우지 못했어요. 다른 곳을 눌러주세요.');}
   return;
  }
  pointerId=e.pointerId;stroke={tool,color:$('color').value,width:Number($('width').value),points:ART_SHAPE_TOOLS.includes(tool)?[p,[...p]]:[p]};canvas.setPointerCapture(pointerId);paint();
 });
 canvas.addEventListener('pointermove',e=>{if(e.pointerId===pointerId&&stroke)move(e);});
 canvas.addEventListener('pointerup',e=>{if(e.pointerId!==pointerId||!stroke)return;move(e);const next=stroke;
  if(ART_SHAPE_TOOLS.includes(next.tool)&&Math.abs(next.points[1][0]-next.points[0][0])<2&&Math.abs(next.points[1][1]-next.points[0][1])<2){const [x,y]=next.points[0].map((v,i)=>Math.min(v,(i?L.height:L.width)-80));next.points=[[x,y],[x+80,y+80]];}
  stroke=null;pointerId=null;if(canvas.hasPointerCapture(e.pointerId))canvas.releasePointerCapture(e.pointerId);commit({...drawing,strokes:[...drawing.strokes,next]});});
 canvas.addEventListener('pointercancel',e=>{if(e.pointerId===pointerId)cancelStroke();});canvas.addEventListener('lostpointercapture',()=>{if(stroke)cancelStroke();});
 $('title').oninput=()=>{if(editable()){dirty=true;controls();}};$('width').oninput=()=>{$('width-label').value=$('width').value;};
 for(const b of dialog.querySelectorAll('[data-art-tool]'))b.onclick=()=>{tool=b.dataset.artTool;controls();};
 $('undo').onclick=()=>{if(!history.length||busy)return;drawing=JSON.parse(history.pop());dirty=true;controls();paint();};
 $('clear').onclick=()=>{if(!busy&&confirm('그림판을 모두 지울까요? 되돌리기로 복구할 수 있어요.'))commit({...drawing,strokes:[]});};
 $('new').onclick=()=>{if(!busy&&discardOkay()){blank();message('');gallery();$('title').focus();}};
 for(const b of dialog.querySelectorAll('[data-art-tab]'))b.onclick=async()=>{if(busy||!discardOkay())return;tab=b.dataset.artTab;await loadList(tab==='mine'?ownId():undefined);};
 $('back').onclick=()=>{if(busy||!discardOkay())return;epoch++;tab=null;blank();list=[];ownerId=null;message('');gallery();dialog.querySelector('[data-art-tab=friends]').focus();};
 $('friend').onchange=()=>{if(!discardOkay()){$('friend').value=ownerId;return;}loadList($('friend').value);};
 $('save').onclick=async()=>{
  if(busy||!editable())return;if(!$('title').value.trim()){message('작품 제목을 적어주세요.');$('title').focus();return;}
  const ticket=epoch;busy=true;controls();message('그림을 저장하고 있어요…');
  try{const result=await request('art:save',{...(work?{id:work.id,revision:work.revision}:{}),requestId,title:$('title').value,drawing});if(ticket!==epoch)return;const retained=result.replayed&&(result.work.title!==$('title').value||JSON.stringify(result.work.drawing)!==JSON.stringify(drawing));if(retained){work=result.work;dirty=true;}else setWork(result.work);const summary={id:work.id,title:work.title,revision:work.revision,createdAt:work.createdAt,updatedAt:work.updatedAt};list=[summary,...list.filter(w=>w.id!==work.id)];const me=roster.find(p=>p.id===ownId());if(me)me.count=list.length;message(retained?'이전에 저장된 작품을 확인했어요. 그 뒤에 고친 그림은 그대로 남아 있어요. 수정한 작품 저장을 한 번 더 눌러주세요.':'작품을 저장했어요.');if(!retained)toast?.('작품을 저장했어요.');gallery();}
  catch(e){if(ticket===epoch)message(e.message||'저장하지 못했어요. 그림은 그대로 있으니 다시 시도해주세요.');}finally{if(ticket===epoch){busy=false;controls();}}
 };
 $('delete').onclick=async()=>{if(busy||!editable()||!work||!confirm(`“${work.title}” 작품을 삭제할까요? 삭제한 작품은 되돌릴 수 없어요.`))return;const ticket=epoch;busy=true;controls();try{await request('art:delete',{id:work.id,revision:work.revision});if(ticket!==epoch)return;list=list.filter(w=>w.id!==work.id);blank();message('작품을 삭제했어요.');gallery();}catch(e){if(ticket===epoch)message(e.message);}finally{if(ticket===epoch){busy=false;controls();}}};
 $('download').onclick=()=>{const output=document.createElement('canvas');output.width=L.width;output.height=L.height;paintArtDrawing(output.getContext('2d'),drawing);output.toBlob(blob=>{if(!blob)return;const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=($('title').value.trim()||'나의 별 그림').replace(/[\\/:*?"<>|\x00-\x1f]/g,'_')+'.png';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);},'image/png');};
 function close(){if(busy||!discardOkay())return;epoch++;dialog.close();cancelStroke();stop();}
 $('close').onclick=close;dialog.addEventListener('cancel',e=>{e.preventDefault();close();});for(const name of ['keydown','keyup'])dialog.addEventListener(name,e=>e.stopPropagation());
 return {async open(){if(dialog.open)return;stop();tab=null;blank();list=[];ownerId=null;roster=[];gallery();dialog.showModal();},reset(){epoch++;busy=false;dirty=false;tab=null;blank();dialog.close();},destroy(){epoch++;if(paintFrame!==null)cancelAnimationFrame(paintFrame);dialog.remove();}};
}
