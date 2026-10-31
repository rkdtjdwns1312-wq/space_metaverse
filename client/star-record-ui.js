export function createStarRecordUI({request,onClose=()=>{}}){
 const dialog=document.getElementById('star-record-dialog'),yes=dialog.querySelector('[data-summon]'),no=dialog.querySelector('[data-cancel]'),message=dialog.querySelector('[data-message]');let pending=false;
 yes.onclick=async()=>{if(pending)return;pending=true;yes.disabled=true;try{await request('star-record:summon',{});dialog.close();}catch(error){message.textContent=error.message||'소환 요청을 처리하지 못했어요.';}finally{pending=false;yes.disabled=false;}};
 no.onclick=()=>{if(!pending)dialog.close();};dialog.addEventListener('cancel',event=>{if(pending)event.preventDefault();});dialog.addEventListener('close',onClose);
 return {open(){if(pending)return;message.textContent='별 기록의 근원을 소환할까요?';if(!dialog.open)dialog.showModal();no.focus();},update(state){if(state?.state!=='dormant'&&dialog.open&&!pending)dialog.close();}};
}
export function createStarRecordMathUI({request,onClose=()=>{}}){
 const dialog=document.getElementById('star-record-math-dialog'),equation=dialog.querySelector('[data-equation]'),message=dialog.querySelector('[data-message]');
 let star=null,pending=false;
 const buttons=[...dialog.querySelectorAll('[data-operator]')];
 async function choose(operator){
  if(pending||!star)return;
  pending=true;buttons.forEach(button=>button.disabled=true);
  try{const result=await request('star-record:math',{starId:star.id,operator});
    if(result.correct){dialog.close();}else{message.textContent='기호가 달라요. 별의 힘에 쓰러졌어요.';dialog.close();}
  }catch(error){message.textContent=error.message||'별의 기록을 확인하지 못했어요.';}
  finally{pending=false;buttons.forEach(button=>button.disabled=false);}
 }
 buttons.forEach(button=>button.onclick=()=>choose(button.dataset.operator));
 dialog.addEventListener('keydown',event=>{const operator={a:'+',s:'−',d:'×',f:'÷'}[event.key.toLowerCase()];
   if(operator){event.preventDefault();event.stopPropagation();choose(operator);}});
 dialog.querySelector('[data-close]').onclick=()=>dialog.close();dialog.addEventListener('close',onClose);
 return {open(value){star=value;equation.textContent=`${star.left} ○ ${star.right} = ${star.result}`;
   message.textContent='알맞은 기호를 골라 숫자 별을 지워요.';
   if(!dialog.open)dialog.showModal();buttons[0].focus();}};
}
