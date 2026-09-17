// 공동 초안의 version으로 동시 수정을 감지합니다. 부원 알림이 미저장 글을 덮어쓰지 않습니다.
// 화면 상태만 관리하며 지급·확인·잔액 계산은 모두 서버가 검증합니다.
export function createDepartmentWorkUI({request,stop,toast}) {
  const dialog=document.createElement('dialog');dialog.id='department-work-dialog';
  dialog.innerHTML=`<header class="department-heading"><h2 id="department-work-title">부서실적</h2><button id="department-work-close" class="secondary" type="button">닫기</button></header>
    <p id="department-balance"></p><nav class="department-tabs" aria-label="부서 활동"><button data-tab="report">부서실적 작성하기</button><button data-tab="distribution">분배하기</button><button data-tab="history">분배결과</button></nav>
    <p id="department-message" role="status"></p><button id="department-refresh" class="small secondary">새로 보기</button>
    <section data-panel="report"><p id="department-report-status"></p><label for="department-text">우리 부서가 한 일</label><textarea id="department-text" rows="7" maxlength="4000" placeholder="함께 어떤 일을 했나요?"></textarea>
    <div class="dialog-actions"><button id="department-save" class="secondary">저장하기</button><button id="department-submit" class="primary">제출하기</button></div>
    <div id="department-award-row"><label>부서에 줄 별 파편 <input id="department-award-amount" type="number" min="1" max="999" value="10" step="1"></label><button id="department-award" class="primary">실적 확인하고 별 파편 지급</button></div></section>
    <section data-panel="distribution" hidden><p>0개도 정할 수 있어요. 소속 부원 모두가 확인해야 지급돼요. 남은 별 파편은 부서에 보관돼요.</p><div id="department-allocations"></div><p id="department-total"></p><p id="department-confirmations"></p>
    <div class="dialog-actions"><button id="department-propose" class="primary">분배하기</button><button id="department-confirm" class="primary">확인</button><button id="department-cancel" class="secondary">분배 제안 취소</button></div></section>
    <section data-panel="history" hidden><p>지급이 끝난 분배 결과를 5일간 볼 수 있어요.</p><div id="department-history"></div></section>`;
  document.body.append(dialog);
  const $=id=>dialog.querySelector('#department-'+id);
  let planetId=null,data=null,dirty=false,acting=false,generation=0,tab='report';
  const select=value=>{tab=value;for(const b of dialog.querySelectorAll('[data-tab]')){b.classList.toggle('selected',b.dataset.tab===tab);b.setAttribute('aria-pressed',String(b.dataset.tab===tab));}for(const panel of dialog.querySelectorAll('[data-panel]'))panel.hidden=panel.dataset.panel!==tab;};
  for(const button of dialog.querySelectorAll('[data-tab]'))button.onclick=()=>select(button.dataset.tab);
  $('work-close').onclick=()=>dialog.close();
  dialog.addEventListener('close',()=>{planetId=null;data=null;dirty=false;acting=false;generation++;});
  $('text').oninput=()=>{dirty=true;};
  const amountInputs=()=>[...$('allocations').querySelectorAll('input')];
  const updateTotal=()=>{$('total').textContent='분배 합계 '+amountInputs().reduce((sum,i)=>sum+(Number(i.value)||0),0)+'개';};
  function render(value) {
    data=value;dirty=false;$('message').textContent='';
    const {work,members,teacher,selfId,canWrite}=data,pending=work.distribution;
    $('work-title').textContent=data.name+' · 부서 활동';$('balance').textContent='✦ 부서 별 파편 '+work.balance+'개';
    $('text').value=work.report.text;$('text').readOnly=teacher||!canWrite||work.report.status==='submitted';
    $('report-status').textContent=work.report.status==='submitted'?'실적제출확인요함 · 선생님의 확인을 기다리고 있어요.':work.report.text?'저장된 실적이에요. 이어서 작성하거나 제출하세요.':'새 실적을 작성해주세요.';
    if(!teacher&&!canWrite&&work.report.status==='draft')$('report-status').textContent+=' 작성하려면 행성 안의 문서에 가까이 가주세요.';
    $('save').hidden=$('submit').hidden=teacher||!canWrite||work.report.status==='submitted';
    $('award-row').hidden=!teacher||work.report.status!=='submitted';
    $('allocations').replaceChildren(...members.map(m=>{
      const row=document.createElement('label');row.className='department-allocation';
      const name=document.createElement('span');name.textContent=m.nickname+(m.connected?'':' · 접속 안 함');
      const input=document.createElement('input');input.type='number';input.min='0';input.max='9999';input.step='1';input.value=String(pending?.allocations.find(a=>a.playerId===m.playerId)?.quantity||0);input.dataset.playerId=m.playerId;input.setAttribute('aria-label',m.nickname+' 분배 개수');input.disabled=teacher||!!pending;input.oninput=updateTotal;
      const status=document.createElement('span');status.textContent=pending?(pending.confirmedIds.includes(m.playerId)?'확인 완료':'확인 대기'):'';
      row.append(name,input,status);return row;
    }));updateTotal();
    $('confirmations').textContent=pending?'확인 '+pending.confirmedIds.length+' / '+members.length+'명 · 제안한 친구도 확인을 눌러주세요.':'새 분배 금액을 정해주세요.';
    $('propose').hidden=teacher||!!pending||!members.length;$('confirm').hidden=teacher||!pending;
    $('confirm').disabled=!!pending?.confirmedIds.includes(selfId);$('confirm').textContent=$('confirm').disabled?'확인 완료':'확인';$('cancel').hidden=!pending;
    $('history').replaceChildren();
    for(const result of [...work.history].reverse()){
      const article=document.createElement('article'),date=document.createElement('h3'),list=document.createElement('ul');
      date.textContent=new Date(result.at).toLocaleString('ko-KR',{timeZone:'Asia/Seoul'});
      for(const a of result.allocations){const li=document.createElement('li');li.textContent=a.nickname+' · 별 파편 '+a.quantity+'개';list.append(li);}article.append(date,list);$('history').append(article);
    }
    if(!work.history.length)$('history').textContent='최근 5일 동안 완료된 분배가 없어요.';
    select(tab);
  }
  async function refresh() {
    if(!planetId||acting)return;const id=planetId,revision=++generation;
    try{const value=await request('department:get',{planetId:id});if(planetId===id&&revision===generation)render(value);}
    catch(error){if(revision===generation)$('message').textContent=error.message;}
  }
  $('refresh').onclick=()=>{if(!dirty||confirm('저장하지 않은 글 대신 서버에 저장된 글을 불러올까요?'))refresh();};
  async function act(event,payload,success) {
    if(acting||!data)return;acting=true;$('message').textContent='';const id=planetId,revision=++generation;
    for(const b of dialog.querySelectorAll('button:not(#department-work-close)'))b.disabled=true;
    // 열린 부서 창 안에 결과를 표시해 모달 뒤의 토스트가 가려져도 확인할 수 있습니다.
    try{const value=await request('department:'+event,{planetId:id,...payload});if(id===planetId&&revision===generation){render(value);$('message').textContent=success;toast(success);}}
    catch(error){if(id===planetId)$('message').textContent=error.message;}
    finally{if(revision===generation){acting=false;for(const b of dialog.querySelectorAll('button'))b.disabled=false;if(data)$('confirm').disabled=!!data.work.distribution?.confirmedIds.includes(data.selfId);}}
  }
  $('save').onclick=()=>act('save',{text:$('text').value,version:data.work.report.version},'실적을 저장했어요.');
  $('submit').onclick=()=>act('submit',{text:$('text').value,version:data.work.report.version},'선생님께 실적을 제출했어요.');
  $('award').onclick=()=>act('award',{amount:Number($('award-amount').value),version:data.work.report.version},'지급완료되었습니다');
  $('propose').onclick=()=>act('propose',{allocations:amountInputs().map(i=>({playerId:i.dataset.playerId,quantity:Number(i.value)}))},'분배 제안을 만들었어요. 부원 모두 확인해주세요.');
  $('confirm').onclick=()=>act('confirm',{proposalId:data.work.distribution.id},'분배 금액을 확인했어요.');
  $('cancel').onclick=()=>act('cancel',{},'분배 제안을 취소했어요.');
  return {
    open(id,section='report'){stop();planetId=id;data=null;dirty=false;tab=section;for(const b of dialog.querySelectorAll('button'))b.disabled=false;$('message').textContent='불러오는 중…';for(const panel of dialog.querySelectorAll('[data-panel]'))panel.hidden=true;if(!dialog.open)dialog.showModal();refresh();},
    changed(event){if(event.planetId!==planetId||acting)return;if(dirty)$('message').textContent='부서 내용이 바뀌었어요. 작성 중인 글은 유지했어요. 새로 보기를 눌러 확인하세요.';else refresh();},
    reset(){if(dialog.open)dialog.close();}
  };
}
