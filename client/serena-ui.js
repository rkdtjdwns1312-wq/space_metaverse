// Server contract confirmed in shared/serena.js and server/serena.js:
// room.serena/world:positions.serena state, serena:summon {}, eligibility error.
export function createSerenaUI({document=globalThis.document,request,onClose=()=>{}}={}){
  const dialog=document.getElementById('serena-dialog');
  if(!dialog)return {open(){},update(){},dispose(){}};
  const yes=document.getElementById('serena-yes'),no=document.getElementById('serena-no');
  let pending=false;
  const finish=()=>{pending=false;yes.disabled=false;onClose();};
  const cancel=()=>{if(pending)return;close();};
  const close=()=>{if(dialog.open)dialog.close();};
  const show=()=>{document.getElementById('serena-message').textContent='보스를 소환하시겠습니까?';if(!dialog.open)dialog.showModal();yes.focus();};
  const summon=async()=>{
    if(pending)return;
    pending=true;yes.disabled=true;
    try{await request('serena:summon',{});close();}
    catch(error){
      const message=error?.message||'';
      if(message==='자격이 충분하지 않습니다'){
        document.getElementById('serena-message').textContent='자격이 충분하지 않습니다';
      }else document.getElementById('serena-message').textContent=message||'소환 요청을 처리하지 못했어요.';
    }finally{pending=false;yes.disabled=false;}
  };
  yes.addEventListener('click',summon);
  no.addEventListener('click',cancel);
  dialog.addEventListener('close',finish);
  return {open:show,update(){},dispose(){yes.removeEventListener('click',summon);no.removeEventListener('click',cancel);dialog.removeEventListener('close',finish);}};
}
