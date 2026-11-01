import {itemOf} from '/shared/config.js';
export function createTeacherInventoryUI({request,getPlayer,stop=()=>{},toast=()=>{}}){
  const stylesheet=document.createElement('link');stylesheet.rel='stylesheet';stylesheet.href='/teacher-inventory.css';document.head.append(stylesheet);
  const dialog=document.createElement('dialog');dialog.id='teacher-inventory-dialog';dialog.setAttribute('aria-labelledby','teacher-inventory-title');
  dialog.innerHTML=`<h2 id="teacher-inventory-title">학생 인벤토리 조정</h2>
    <label for="teacher-inventory-student">학생 선택</label><select id="teacher-inventory-student" aria-label="인벤토리를 조정할 학생"></select>
    <p id="teacher-inventory-status" role="status" aria-live="polite"></p>
    <h3 id="teacher-inventory-owner">보유 아이템</h3><div id="teacher-inventory-grid" role="group" aria-label="학생 보유 아이템"></div>
    <div id="teacher-inventory-balances"><button id="teacher-inventory-shards" type="button" class="secondary"></button><button id="teacher-inventory-energy" type="button" class="secondary"></button></div>
    <div id="teacher-inventory-currency-editor" hidden><label id="teacher-inventory-currency-label" for="teacher-inventory-currency-amount"></label><input id="teacher-inventory-currency-amount" type="number" min="0" step="1" inputmode="numeric"><button id="teacher-inventory-currency-save" type="button" class="primary">저장</button><button id="teacher-inventory-currency-cancel" type="button" class="secondary">취소</button></div>
    <p id="teacher-inventory-selection" class="muted">제거할 아이템을 선택하세요.</p>
    <div class="teacher-inventory-actions"><button id="teacher-inventory-remove" class="danger" type="button">선택 아이템 1개 제거</button><button id="teacher-inventory-add" class="secondary" type="button" aria-expanded="false" aria-controls="teacher-inventory-picker">아이템 추가</button></div>
    <section id="teacher-inventory-picker" hidden><h3>추가할 아이템 선택</h3><div id="teacher-inventory-tabs" role="tablist" aria-label="아이템 레벨"></div>
      <div id="teacher-inventory-catalog" role="tabpanel" aria-label="추가할 아이템"></div>
      <p id="teacher-inventory-count" class="muted" aria-live="polite"></p><button id="teacher-inventory-give" class="primary" type="button">선택한 아이템 각 1개 주기</button></section>
    <div class="dialog-actions"><button id="teacher-inventory-refresh" class="secondary" type="button">새로 보기</button><button id="teacher-inventory-close" class="secondary" type="button">닫기</button></div>`;
  document.body.append(dialog);const $=id=>dialog.querySelector('#teacher-inventory-'+id);
  let state={students:[],inventory:[],catalog:[],playerId:null,starShards:0,cosmicEnergy:0},selected=null,level=1,busy=false,revision=0,loaded=false,currency=null;
  const gifts=new Set(),teacher=()=>getPlayer()?.role==='teacher';
  function visual(item){
    const node=document.createElement(item.art?'img':'span');node.className='teacher-inventory-art';
    if(item.art){node.src=item.art;node.alt='';node.loading='lazy';}else{node.textContent=item.icon||'✦';node.setAttribute('aria-hidden','true');}return node;
  }
  function availability(){
    $('student').disabled=busy||!state.students.length;$('refresh').disabled=busy;
    $('remove').disabled=busy||!state.playerId||!selected;
    $('add').disabled=busy||!state.playerId;$('give').disabled=busy||!state.playerId||!gifts.size;
    for(const id of ['shards','energy','currency-amount','currency-save','currency-cancel'])$(id).disabled=busy||!state.playerId;
    $('count').textContent=`선택한 ${gifts.size}/40종 · 레벨 탭을 바꿔도 선택은 유지돼요. 각 1개씩 지급해요.`;
    for(const control of dialog.querySelectorAll('#teacher-inventory-grid button,#teacher-inventory-tabs button,#teacher-inventory-catalog input'))control.disabled=busy||(control.type==='checkbox'&&!control.checked&&gifts.size>=40);
  }
  function renderCatalog(){
    for(const tab of $('tabs').children){const active=Number(tab.dataset.level)===level;tab.setAttribute('aria-selected',String(active));tab.tabIndex=active?0:-1;}
    const items=state.catalog.filter(item=>item.level===level);$('catalog').replaceChildren();$('catalog').setAttribute('aria-labelledby',`teacher-inventory-level-${level}`);
    for(const item of items){
      const label=document.createElement('label');label.className='teacher-inventory-option';
      const box=document.createElement('input');box.type='checkbox';box.value=item.id;box.checked=gifts.has(item.id);box.setAttribute('aria-label',item.name);
      const text=document.createElement('span');text.textContent=item.name;
      box.onchange=()=>{box.checked?gifts.add(item.id):gifts.delete(item.id);availability();};label.append(box,visual(item),text);$('catalog').append(label);
    }
    if(!items.length){const empty=document.createElement('p');empty.textContent='이 레벨의 아이템이 없어요.';$('catalog').append(empty);}availability();
  }
  for(let value=1;value<=5;value++){
    const tab=document.createElement('button');tab.type='button';tab.id=`teacher-inventory-level-${value}`;tab.dataset.level=String(value);tab.textContent='LV'+value;tab.setAttribute('role','tab');tab.setAttribute('aria-controls','teacher-inventory-catalog');
    tab.onclick=()=>{if(busy)return;level=value;renderCatalog();};
    tab.onkeydown=event=>{if(!['ArrowLeft','ArrowRight','Home','End'].includes(event.key)||busy)return;event.preventDefault();level=event.key==='Home'?1:event.key==='End'?5:((value-1+(event.key==='ArrowRight'?1:4))%5)+1;renderCatalog();$('tabs').children[level-1].focus();};$('tabs').append(tab);
  }
  function render(){
    $('student').replaceChildren(...state.students.map(student=>{const option=document.createElement('option');option.value=student.id;option.textContent=student.nickname+(student.connected?'':' (미접속)');return option;}));
    if(!state.students.length)$('student').append(new Option('등록된 학생이 없어요.',''));
    $('student').value=state.playerId||'';
    const owner=state.students.find(p=>p.id===state.playerId);$('owner').textContent=owner?`${owner.nickname}의 보유 아이템`:'보유 아이템';
    if(!state.inventory.some(entry=>entry.id===selected))selected=null;
    const byId=new Map(state.catalog.map(item=>[item.id,item]));$('grid').replaceChildren();
    for(const entry of state.inventory){
      const item=byId.get(entry.id)||itemOf(entry.id)||{id:entry.id,name:entry.id,icon:'✦'},button=document.createElement('button');button.type='button';button.className='teacher-inventory-slot';button.dataset.itemId=entry.id;button.setAttribute('aria-pressed',String(selected===entry.id));button.setAttribute('aria-label',`${item.name} ${entry.quantity}개`);
      const name=document.createElement('span');name.textContent=item.name;
      const count=document.createElement('small');count.textContent='×'+entry.quantity;button.append(visual(item),name,count);
      button.onclick=()=>{if(busy)return;selected=selected===entry.id?null:entry.id;render();};$('grid').append(button);
    }
    if(!state.inventory.length){const empty=document.createElement('p');empty.className='teacher-inventory-empty';empty.textContent=loaded?'보유한 아이템이 없어요.':'학생 인벤토리를 불러와 주세요.';$('grid').append(empty);}
    $('shards').textContent=`별 파편 ${state.starShards.toLocaleString()}개 · 조정`;
    $('energy').textContent=`우주에너지 ${state.cosmicEnergy.toLocaleString()}개 · 조정`;
    $('selection').textContent=selected?`${byId.get(selected)?.name||itemOf(selected)?.name||selected} · 1개를 제거해요.`:'제거할 아이템을 선택하세요.';
    for(const id of gifts)if(!byId.has(id))gifts.delete(id);
    renderCatalog();
  }
  async function perform(event,data,message){
    if(busy||!teacher()||!dialog.open)return;
    const rev=++revision;busy=true;$('status').textContent='불러오는 중…';availability();
    try{
      const response=await request(event,data);if(rev!==revision||!dialog.open||!teacher())return;
      state={students:response.students||[],playerId:response.playerId||null,inventory:response.inventory||[],catalog:response.catalog||[],starShards:response.starShards??0,cosmicEnergy:response.cosmicEnergy??0};loaded=true;
      if(event==='teacher:inventory:give')gifts.clear();
      const notice=response.message||message||'';$('status').textContent=notice;render();if(message)toast(notice);
    }catch(error){if(rev===revision&&dialog.open){$('status').textContent=error.message;$('student').value=state.playerId||'';}}
    finally{if(rev===revision){busy=false;availability();}}
  }
  function picker(open){$('picker').hidden=!open;$('add').setAttribute('aria-expanded',String(open));$('add').textContent=open?'추가 목록 닫기':'아이템 추가';}
  $('student').onchange=()=>{selected=null;currency=null;$('currency-editor').hidden=true;gifts.clear();picker(false);perform('teacher:inventory:read',{playerId:$('student').value});};
  function editCurrency(kind){if(busy||!state.playerId)return;currency=kind;$('currency-label').textContent=kind==='starShards'?'별 파편 수량':'우주에너지 수량';$('currency-amount').max=kind==='starShards'?'9999':String(Number.MAX_SAFE_INTEGER);$('currency-amount').value=String(state[kind]);$('currency-editor').hidden=false;$('currency-amount').focus();$('currency-amount').select();}
  $('shards').onclick=()=>editCurrency('starShards');$('energy').onclick=()=>editCurrency('cosmicEnergy');
  $('currency-cancel').onclick=()=>{currency=null;$('currency-editor').hidden=true;};
  $('currency-save').onclick=()=>{const amount=Number($('currency-amount').value);if(!currency||!$('currency-amount').value.trim()||!Number.isSafeInteger(amount)||amount<0||amount>Number($('currency-amount').max)){$('status').textContent='재화 수량을 확인해주세요.';return;}const kind=currency;currency=null;$('currency-editor').hidden=true;perform('teacher:inventory:currency:set',{playerId:state.playerId,currency:kind,amount});};
  $('refresh').onclick=()=>perform('teacher:inventory:read',state.playerId?{playerId:state.playerId}:{});
  $('remove').onclick=()=>{if(selected)perform('teacher:inventory:remove',{playerId:state.playerId,itemId:selected},'선택한 아이템 1개를 제거했어요.');};
  $('add').onclick=()=>{if(!busy)picker($('picker').hidden);};
  $('give').onclick=()=>{if(gifts.size)perform('teacher:inventory:give',{playerId:state.playerId,itemIds:[...gifts]},`선택한 ${gifts.size}종을 각 1개씩 주었어요.`);};
  function close(){revision++;busy=false;if(dialog.open)dialog.close();stop();}
  $('close').onclick=close;dialog.addEventListener('cancel',event=>{event.preventDefault();close();});dialog.addEventListener('close',()=>{revision++;busy=false;});
  const trigger=document.getElementById('teacher-inventory-open');trigger.onclick=()=>{
    if(!teacher())return;stop();state={students:[],inventory:[],catalog:[],playerId:null,starShards:0,cosmicEnergy:0};selected=null;currency=null;$('currency-editor').hidden=true;gifts.clear();level=1;loaded=false;picker(false);render();dialog.showModal();perform('teacher:inventory:read',{});
  };
  return {update(){const allowed=teacher();trigger.hidden=!allowed;document.getElementById('teacher-inventory-tools').hidden=!allowed;if(!allowed&&(dialog.open||busy))close();}};
}
