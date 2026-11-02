export function createTruthCreatorUI({request,onClose=()=>{}}){
  const dialog=document.createElement('dialog');dialog.id='truth-creator-dialog';
  dialog.setAttribute('aria-labelledby','truth-creator-title');
  dialog.innerHTML='<h2 id="truth-creator-title">진리의 별 석상</h2><p data-message></p><div class="dialog-actions"><button type="button" class="secondary" data-cancel>아니오</button><button type="button" class="primary" data-summon>예</button></div>';
  document.body.append(dialog);
  const yes=dialog.querySelector('[data-summon]'),no=dialog.querySelector('[data-cancel]'),message=dialog.querySelector('[data-message]');let pending=false;
  yes.onclick=async()=>{if(pending)return;pending=true;yes.disabled=true;try{await request('truth-creator:summon',{});dialog.close();}catch(error){message.textContent=error.message||'소환 요청을 처리하지 못했어요.';}finally{pending=false;yes.disabled=false;}};
  no.onclick=()=>{if(!pending)dialog.close();};dialog.addEventListener('cancel',event=>{if(pending)event.preventDefault();});dialog.addEventListener('close',onClose);
  return {open(){if(pending)return;message.textContent='진리의 창조자를 소환할까요?';if(!dialog.open)dialog.showModal();no.focus();},update(state){if(state?.state!=='dormant'&&dialog.open&&!pending)dialog.close();}};
}
