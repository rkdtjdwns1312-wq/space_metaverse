import {INTERIOR_DECOR_COLORS,interiorDecorObject,interiorDecorStyle} from '/shared/interior-decor.js';

export function createInteriorDecorUI({request,stop,toast,getRoom}){
  const dialog=document.createElement('dialog');dialog.id='interior-decor-dialog';dialog.setAttribute('aria-labelledby','interior-decor-title');
  dialog.innerHTML='<h2 id="interior-decor-title">오브젝트 꾸미기</h2><p id="interior-decor-description"></p><label id="interior-decor-target-label" hidden for="interior-decor-target">꾸밀 대상</label><select id="interior-decor-target" hidden></select><fieldset><legend>색상</legend><div id="interior-decor-colors" class="interior-decor-options"></div></fieldset><fieldset><legend>모양</legend><div id="interior-decor-shapes" class="interior-decor-options"></div></fieldset><p id="interior-decor-error" role="alert"></p><div class="dialog-actions"><button id="interior-decor-cancel" class="secondary" type="button">취소</button><button id="interior-decor-save" class="primary" type="button">꾸미기 저장</button></div>';
  document.body.append(dialog);
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
    $('description').textContent=selected.fromControl?planet.name+' 안에서 게시판·실적판·경고 제어돌·문을 꾸며요.':planet.name+' 안에서 이 오브젝트의 색과 모양을 골라요.';
  };
  $('target').onchange=()=>{if(selected?.fromControl){selected.objectId=$('target').value;renderChoices();}};
  $('cancel').onclick=()=>dialog.close();
  dialog.addEventListener('cancel',event=>{if(busy)event.preventDefault();});
  dialog.addEventListener('close',()=>{selected=null;$('error').textContent='';document.getElementById('world').focus();});
  $('save').onclick=async()=>{
    if(!selected||busy)return;busy=true;$('save').disabled=$('cancel').disabled=true;$('error').textContent='';
    const {planetId,objectId,fromControl}=selected;
    try{
      await request('planet:interior-decor:set',{planetId,objectId,
        ...(fromControl?{controlId:'department-control-machine'}:{}),
        colorId:dialog.querySelector('input[name="interior-decor-color"]:checked')?.value,
        shapeId:dialog.querySelector('input[name="interior-decor-shape"]:checked')?.value});
      dialog.close();toast('부서행성 오브젝트를 꾸몄어요.');
    }catch(error){$('error').textContent=error.message;}
    finally{busy=false;$('save').disabled=$('cancel').disabled=false;}
  };
  return {
    open(planetId,objectId){
      const planet=getRoom()?.planets.find(item=>item.id===planetId),fromControl=objectId==='department-control-machine';
      const initialId=fromControl?'board':objectId,object=interiorDecorObject(initialId);
      if(!planet||!object)return;
      stop();selected={planetId,objectId:initialId,fromControl};
      $('title').textContent=fromControl?'공간 꾸미기':object.name+' 꾸미기';
      const target=$('target'),targetLabel=$('target-label');target.hidden=targetLabel.hidden=!fromControl;
      if(fromControl){target.replaceChildren(...['board','report-board','warning-rock','door'].map(id=>{const item=interiorDecorObject(id),option=document.createElement('option');option.value=id;option.textContent=item.name;return option;}));target.value=initialId;}
      renderChoices();
      $('error').textContent='';dialog.showModal();
    },
    reset(){if(dialog.open)dialog.close();}
  };
}
