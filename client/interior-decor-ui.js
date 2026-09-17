import {INTERIOR_DECOR_COLORS,interiorDecorObject,interiorDecorStyle} from '/shared/interior-decor.js';

export function createInteriorDecorUI({request,stop,toast,getRoom}){
  const dialog=document.createElement('dialog');dialog.id='interior-decor-dialog';dialog.setAttribute('aria-labelledby','interior-decor-title');
  dialog.innerHTML='<h2 id="interior-decor-title">오브젝트 꾸미기</h2><p id="interior-decor-description"></p><fieldset><legend>색상</legend><div id="interior-decor-colors" class="interior-decor-options"></div></fieldset><fieldset><legend>모양</legend><div id="interior-decor-shapes" class="interior-decor-options"></div></fieldset><p id="interior-decor-error" role="alert"></p><div class="dialog-actions"><button id="interior-decor-cancel" class="secondary" type="button">취소</button><button id="interior-decor-save" class="primary" type="button">꾸미기 저장</button></div>';
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
  $('cancel').onclick=()=>dialog.close();
  dialog.addEventListener('cancel',event=>{if(busy)event.preventDefault();});
  dialog.addEventListener('close',()=>{selected=null;$('error').textContent='';document.getElementById('world').focus();});
  $('save').onclick=async()=>{
    if(!selected||busy)return;busy=true;$('save').disabled=$('cancel').disabled=true;$('error').textContent='';
    const {planetId,objectId}=selected;
    try{
      await request('planet:interior-decor:set',{planetId,objectId,
        colorId:dialog.querySelector('input[name="interior-decor-color"]:checked')?.value,
        shapeId:dialog.querySelector('input[name="interior-decor-shape"]:checked')?.value});
      dialog.close();toast('부서행성 오브젝트를 꾸몄어요.');
    }catch(error){$('error').textContent=error.message;}
    finally{busy=false;$('save').disabled=$('cancel').disabled=false;}
  };
  return {
    open(planetId,objectId){
      const planet=getRoom()?.planets.find(item=>item.id===planetId),object=interiorDecorObject(objectId);
      if(!planet||!object)return;
      stop();selected={planetId,objectId};$('title').textContent=object.name+' 꾸미기';
      $('description').textContent=planet.name+' 안에서 이 오브젝트의 색과 모양을 골라요.';
      const style=interiorDecorStyle(planet.interiorDecor,objectId);
      choices($('colors'),'color',INTERIOR_DECOR_COLORS,style.colorId);
      choices($('shapes'),'shape',object.shapes,style.shapeId);
      $('error').textContent='';dialog.showModal();
    },
    reset(){if(dialog.open)dialog.close();}
  };
}
