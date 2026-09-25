const $=id=>document.getElementById(id);
export function createMailboxUI({request,stop,toast}){
 let planetId=null,busy=false;const dialog=$('mailbox-dialog');
 function render(data){
  $('mailbox-title').textContent=data.name+' · 우체통';
  $('mailbox-empty').hidden=!!data.requests.length;
  $('mailbox-requests').replaceChildren(...data.requests.map(entry=>{
   const row=document.createElement('li'),name=document.createElement('strong'),actions=document.createElement('div');name.textContent=entry.nickname;
   for(const [accept,label] of [[true,'가입 승인'],[false,'거절']]){
    const button=document.createElement('button');button.type='button';button.className=accept?'primary small':'secondary small';button.textContent=label;
    button.onclick=async()=>{if(busy)return;busy=true;const id=planetId;for(const b of dialog.querySelectorAll('li button'))b.disabled=true;
     try{const result=await request('planet:mailbox:decide',{planetId:id,playerId:entry.playerId,accept});if(planetId===id)render(result);toast(result.message);}
     catch(e){$('mailbox-error').textContent=e.message;}
     finally{busy=false;for(const b of dialog.querySelectorAll('li button'))b.disabled=false;}
    };actions.append(button);
   }row.append(name,actions);return row;
  }));
 }
 async function open(id){planetId=id;$('mailbox-error').textContent='';try{const data=await request('planet:mailbox:get',{planetId:id});render(data);stop();dialog.showModal();}catch(e){toast(e.message);}}
 $('mailbox-close').onclick=()=>dialog.close();dialog.addEventListener('close',()=>{planetId=null;$('world').focus();});
 return {open,reset(){planetId=null;dialog.close();},refresh(){if(planetId&&!busy)request('planet:mailbox:get',{planetId}).then(data=>{if(planetId===data.planetId)render(data);}).catch(()=>dialog.close());}};
}
