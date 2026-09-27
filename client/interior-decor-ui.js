import {INTERIOR_DECOR_COLORS,INTERIOR_DECOR_TARGETS,interiorDecorObject,interiorDecorStyle} from '/shared/interior-decor.js';

export function createInteriorDecorUI({request,stop,toast,getRoom,getPlayer}){
  const dialog=document.createElement('dialog');dialog.id='interior-decor-dialog';dialog.setAttribute('aria-labelledby','interior-decor-title');
  dialog.innerHTML='<h2 id="interior-decor-title">부서행성 제어장치</h2><p id="interior-decor-description"></p><div id="interior-decor-targets" role="tablist" aria-label="꾸밀 대상" aria-orientation="vertical"></div><section id="interior-decor-panel" role="tabpanel"><h3 id="interior-decor-selected"></h3><fieldset><legend>색상</legend><div id="interior-decor-colors" class="interior-decor-options"></div></fieldset><fieldset><legend>모양</legend><div id="interior-decor-shapes" class="interior-decor-options"></div></fieldset></section><p id="interior-decor-error" role="alert"></p><div class="dialog-actions"><button id="interior-decor-leave" class="secondary danger" type="button" hidden>부서 탈퇴하기</button><button id="interior-decor-cancel" class="secondary" type="button">취소</button><button id="interior-decor-save" class="primary" type="button">꾸미기 저장</button></div>';
  const leaveDialog=document.createElement('dialog');leaveDialog.id='department-leave-dialog';
  leaveDialog.setAttribute('aria-labelledby','department-leave-title');
  leaveDialog.innerHTML='<h2 id="department-leave-title">부서 탈퇴하기</h2><p id="department-leave-message"></p><p id="department-leave-error" role="alert"></p><div class="dialog-actions"><button id="department-leave-cancel" class="secondary" type="button">취소</button><button id="department-leave-confirm" class="primary" type="button">탈퇴하기</button></div>';
  document.body.append(dialog,leaveDialog);
  const $=id=>dialog.querySelector('#interior-decor-'+id);let selected=null,busy=false;
  const choices=(container,name,options,value)=>{
    container.replaceChildren();
    for(const option of options){
      const label=document.createElement('label');label.className='interior-decor-choice';
      const input=document.createElement('input');input.type='radio';input.name='interior-decor-'+name;input.value=option.id;input.checked=option.id===value;
      if(option.hex){const swatch=document.createElement('span');swatch.className='interior-decor-swatch';swatch.style.backgroundColor=option.hex;label.append(input,swatch);}else label.append(input);
      label.append(document.createTextNode(option.name));container.append(label);
    }
  };
  const renderChoices=()=>{
    if(!selected)return;
    const planet=getRoom()?.planets.find(item=>item.id===selected.planetId),object=interiorDecorObject(selected.objectId);if(!planet||!object)return;
    const style=interiorDecorStyle(planet.interiorDecor,selected.objectId);
    choices($('colors'),'color',INTERIOR_DECOR_COLORS,style.colorId);choices($('shapes'),'shape',object.shapes,style.shapeId);
    $('description').textContent=planet.name+'에서 꾸밀 곳을 골라주세요.';
    $('selected').textContent=object.name+' 꾸미기';
    $('panel').setAttribute('aria-labelledby','interior-decor-tab-'+object.id);
    for(const button of $('targets').children){const active=button.dataset.target===object.id;button.setAttribute('aria-selected',String(active));button.tabIndex=active?0:-1;}
  };
  for(const object of INTERIOR_DECOR_TARGETS.map(interiorDecorObject)){
    const button=document.createElement('button');button.type='button';button.id='interior-decor-tab-'+object.id;button.dataset.target=object.id;button.textContent=object.name;button.setAttribute('role','tab');button.setAttribute('aria-controls','interior-decor-panel');
    button.onclick=()=>{if(!selected||busy)return;selected.objectId=object.id;renderChoices();};
    button.onkeydown=event=>{const buttons=[...$('targets').children],index=buttons.indexOf(button);let next;
      if(event.key==='ArrowDown')next=(index+1)%buttons.length;else if(event.key==='ArrowUp')next=(index+buttons.length-1)%buttons.length;else if(event.key==='Home')next=0;else if(event.key==='End')next=buttons.length-1;else return;
      event.preventDefault();buttons[next].focus();buttons[next].click();};
    $('targets').append(button);
  }
  const leaveCancel=leaveDialog.querySelector('#department-leave-cancel'),leaveConfirm=leaveDialog.querySelector('#department-leave-confirm'),leaveError=leaveDialog.querySelector('#department-leave-error');
  let leavingPlanetId=null;
  $('leave').onclick=()=>{
    if(!selected||busy)return;
    const player=getPlayer(),planet=getRoom()?.planets.find(p=>p.id===selected.planetId);
    if(!planet||player?.role!=='student'||player.departmentId!==planet.id)return;
    leavingPlanetId=planet.id;leaveError.textContent='';
    leaveDialog.querySelector('#department-leave-message').textContent=planet.name+'에서 탈퇴할까요? 탈퇴하면 광장으로 나가며 다른 부서에 가입할 수 있어요.';
    leaveDialog.showModal();leaveCancel.focus();
  };
  leaveCancel.onclick=()=>leaveDialog.close();
  leaveDialog.addEventListener('cancel',event=>{if(busy)event.preventDefault();});
  leaveDialog.addEventListener('close',()=>{leavingPlanetId=null;if(dialog.open)$('leave').focus();});
  leaveConfirm.onclick=async()=>{
    if(!leavingPlanetId||busy)return;
    const planetId=leavingPlanetId;busy=true;leaveCancel.disabled=leaveConfirm.disabled=true;
    try{await request('planet:leave',{planetId});leaveDialog.close();dialog.close();toast('부서에서 탈퇴했어요. 이제 다른 행성에 가입할 수 있어요.');}
    catch(error){leaveError.textContent=error.message;}
    finally{busy=false;leaveCancel.disabled=leaveConfirm.disabled=false;}
  };
  $('cancel').onclick=()=>dialog.close();
  dialog.addEventListener('cancel',event=>{if(busy)event.preventDefault();});
  dialog.addEventListener('close',()=>{selected=null;leaveDialog.close();$('error').textContent='';document.getElementById('world').focus();});
  $('save').onclick=async()=>{
    if(!selected||busy)return;busy=true;$('save').disabled=$('cancel').disabled=$('leave').disabled=true;$('error').textContent='';
    const {planetId,objectId}=selected;
    try{
      await request('planet:interior-decor:set',{planetId,objectId,
        controlId:'department-control-machine',
        colorId:dialog.querySelector('input[name="interior-decor-color"]:checked')?.value,
        shapeId:dialog.querySelector('input[name="interior-decor-shape"]:checked')?.value});
      dialog.close();toast('부서행성을 꾸몄어요.');
    }catch(error){$('error').textContent=error.message;}
    finally{busy=false;$('save').disabled=$('cancel').disabled=$('leave').disabled=false;}
  };
  return {
    open(planetId,objectId){
      const planet=getRoom()?.planets.find(item=>item.id===planetId);
      if(!planet||objectId!=='department-control-machine')return;
      stop();selected={planetId,objectId:'room'};
      const player=getPlayer();$('leave').hidden=player?.role!=='student'||player.departmentId!==planetId;
      renderChoices();
      $('error').textContent='';dialog.showModal();
    },
    reset(){if(dialog.open)dialog.close();}
  };
}
