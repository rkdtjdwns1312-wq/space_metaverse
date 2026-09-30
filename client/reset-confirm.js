export function createResetConfirmation({root,title,message,submit,onSuccess=()=>{}}){
  const dialog=document.createElement('dialog');dialog.className='ranking-reset-confirm';dialog.setAttribute('aria-label',title);
  const text=document.createElement('p');text.textContent=message;
  const cancel=document.createElement('button');cancel.type='button';cancel.textContent='취소';
  const accept=document.createElement('button');accept.type='button';accept.textContent='초기화하기';
  const error=document.createElement('p');error.setAttribute('role','status');
  dialog.append(text,cancel,accept,error);root.append(dialog);
  let active=true,pending=false;
  cancel.onclick=()=>{if(!pending)dialog.close();};
  dialog.addEventListener('cancel',event=>{event.stopPropagation();if(pending)event.preventDefault();});
  accept.onclick=async()=>{
    if(pending||!active)return;pending=true;accept.disabled=cancel.disabled=true;
    try{const result=await submit();if(active){dialog.close();onSuccess(result);}}
    catch(e){if(active)error.textContent=e.message;}
    finally{pending=false;if(active)accept.disabled=cancel.disabled=false;}
  };
  return {open(){if(active&&!pending){error.textContent='';dialog.showModal();}},close(){dialog.close();},destroy(){active=false;dialog.remove();}};
}
