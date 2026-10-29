export function createDarkStarUI({request,onClose=()=>{}}){
 const dialog=document.getElementById('dark-star-dialog'),yes=dialog.querySelector('[data-summon]'),no=dialog.querySelector('[data-cancel]'),message=dialog.querySelector('[data-message]');let pending=false;
 yes.onclick=async()=>{if(pending)return;pending=true;yes.disabled=true;try{await request('dark-star:summon',{});dialog.close();}catch(error){message.textContent=error.message||'소환 요청을 처리하지 못했어요.';}finally{pending=false;yes.disabled=false;}};
 no.onclick=()=>{if(!pending)dialog.close();};dialog.addEventListener('cancel',e=>{if(pending)e.preventDefault();});dialog.addEventListener('close',onClose);
 return {open(){if(pending)return;message.textContent='소환합니까?';if(!dialog.open)dialog.showModal();no.focus();},update(state){if(state?.state!=='dormant'&&dialog.open&&!pending)dialog.close();}};
}
