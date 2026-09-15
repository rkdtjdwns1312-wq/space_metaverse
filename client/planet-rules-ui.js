export function createPlanetRulesUI({request,stop,toast,isJoined}){
  const dialog=document.createElement('dialog');dialog.id='rules-edit-dialog';dialog.setAttribute('aria-labelledby','rules-edit-title');
  dialog.innerHTML='<h2 id="rules-edit-title">규칙 수정하기</h2><p id="rules-edit-planet"></p><label for="rules-edit-input">규칙을 한 줄에 하나씩 적어주세요. (1~8줄, 한 줄 40자)</label><textarea id="rules-edit-input" rows="8" maxlength="327"></textarea><p id="rules-edit-error" role="alert"></p><div class="dialog-actions"><button id="rules-edit-cancel" type="button" class="secondary">취소</button><button id="rules-edit-save" type="button" class="primary">완료</button></div>';
  document.body.append(dialog);const $=id=>dialog.querySelector('#rules-edit-'+id);let selected=null,revision=0,busy=false;
  $('cancel').onclick=()=>dialog.close();
  dialog.addEventListener('cancel',e=>{if(busy)e.preventDefault();});
  dialog.addEventListener('close',()=>{revision++;selected=null;$('input').value='';document.getElementById('world').focus();});
  $('save').onclick=async()=>{
    if(busy||!selected)return;busy=true;$('save').disabled=$('cancel').disabled=true;const version=revision;
    try{
      const rules=$('input').value.split(/\r?\n/).map(s=>s.trim()).filter(Boolean);
      await request('planet:rules:set',{planetId:selected.planetId,rules,expectedRules:selected.rules});
      if(version===revision){dialog.close();toast('규칙을 저장했어요.');}
    }catch(e){if(version===revision)$('error').textContent=e.message;}
    finally{busy=false;$('save').disabled=$('cancel').disabled=false;}
  };
  return {
    async open(planetId){
      stop();const version=++revision;
      try{
        const result=await request('planet:rules:open',{planetId});
        if(version!==revision||!isJoined()||document.querySelector('dialog[open]'))return;
        selected=result;$('planet').textContent=result.name;$('input').value=result.rules.join('\n');$('error').textContent='';dialog.showModal();
      }catch(e){if(version===revision&&isJoined())toast(e.message);}
    },
    reset(){revision++;if(dialog.open)dialog.close();}
  };
}
