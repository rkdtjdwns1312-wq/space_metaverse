import {itemOf} from '/shared/config.js';
import {equipmentOf,equipmentStatText,enhancementInfo} from '/shared/equipment.js';
import {renderEffectText} from './effect-text-ui.js';
import {pinDialogHeader} from './dialog-layout.js';

export function createEnhancementUI({getPlayer,request,stop,toast}){
  const dialog=document.createElement('dialog');dialog.id='enhancement-dialog';dialog.setAttribute('aria-labelledby','enhancement-title');
  dialog.innerHTML=`<header><h2 id="enhancement-title">장비 강화하기</h2><button id="enhancement-close" class="secondary" type="button">닫기</button></header>
    <p>가방의 장비 1개와 해당 보스 재료 1개를 넣어요. 장착 중인 장비는 먼저 가방에서 해제해 주세요.</p>
    <label for="enhancement-item">강화할 장비</label><select id="enhancement-item"></select>
    <p id="enhancement-empty" hidden>가방에 강화할 장비가 없어요.</p>
    <div id="enhancement-preview"><img id="enhancement-art" alt=""><div><strong id="enhancement-name"></strong><p id="enhancement-current"></p><h3>다음 단계</h3><p id="enhancement-next"></p></div></div>
    <label for="enhancement-material">넣을 보스 재료 · 1개</label><select id="enhancement-material"></select>
    <p id="enhancement-chance"></p><p>실패해도 장비와 강화 단계는 유지돼요. 시도할 때마다 선택한 보스 재료 1개만 사용해요. 최대 +9까지 강화할 수 있어요.</p>
    <p id="enhancement-result" role="status" aria-live="polite"></p>
    <div class="dialog-actions"><button id="enhancement-refresh" class="secondary" type="button">다시 확인</button><button id="enhancement-submit" class="primary" type="button">강화하기</button></div>`;
  pinDialogHeader(dialog);document.body.append(dialog);
  const $=name=>dialog.querySelector('#enhancement-'+name);
  let token=null,busy=false,revision=0,actorId=null;
  function render(){
    const player=getPlayer();if(!player||player.id!==actorId){if(dialog.open)dialog.close();return;}
    const previous=$('item').value,material=$('material').value;
    const entries=(player.inventory||[]).filter(entry=>entry.quantity>0&&enhancementInfo(entry.id));
    $('item').replaceChildren(...entries.map(entry=>new Option(equipmentOf(entry.id).name+' · '+entry.quantity+'개',entry.id)));
    if(entries.some(entry=>entry.id===previous))$('item').value=previous;
    const info=enhancementInfo($('item').value),item=equipmentOf($('item').value);
    $('empty').hidden=!!info;$('preview').hidden=!info;$('item').disabled=busy||!entries.length;
    $('material').replaceChildren();$('material').disabled=busy||!info||info.nextStage===null;
    if(info){
      $('art').src=item.art;$('name').textContent=item.name;
      renderEffectText($('current'),equipmentStatText(item));
      if(info.nextItemId)renderEffectText($('next'),equipmentStatText(equipmentOf(info.nextItemId)));else $('next').textContent='최대 강화 단계에 도달했어요.';
      for(const id of info.materialIds){const count=(player.inventory||[]).find(entry=>entry.id===id)?.quantity||0;const option=new Option(itemOf(id).name+' · 가진 수 '+count+'개',id);option.disabled=count<1;$('material').append(option);}
      if([...$('material').options].some(option=>option.value===material&&!option.disabled))$('material').value=material;
      else $('material').value=[...$('material').options].find(option=>!option.disabled)?.value||'';
      $('chance').textContent=info.nextStage===null?'최대 +9':`+${info.stage} → +${info.nextStage} · 성공 확률 ${Math.round(info.chance*100)}%`;
    }else $('chance').textContent='';
    $('refresh').disabled=busy;
    $('submit').disabled=busy||!token||!info?.nextItemId||!$('material').value;
    $('submit').textContent=busy?'강화 중…':info?.nextStage?`+${info.nextStage} 강화하기`:'강화하기';
  }
  async function refresh(){
    if(busy)return;const ticket=++revision;busy=true;token=null;render();
    try{const info=await request('crafting:open',{});if(ticket!==revision||getPlayer()?.id!==actorId)return;token=info.enhancementToken;$('result').textContent='';}
    catch(error){if(ticket===revision)$('result').textContent=error.message;}
    finally{if(ticket===revision){busy=false;render();}}
  }
  $('item').onchange=()=>{$('result').textContent='';render();};$('material').onchange=render;$('refresh').onclick=refresh;
  $('close').onclick=()=>dialog.close();
  dialog.addEventListener('cancel',event=>{if(busy)event.preventDefault();});
  dialog.addEventListener('close',()=>{revision++;token=null;busy=false;actorId=null;});
  $('submit').onclick=async()=>{
    if(busy||$('submit').disabled)return;
    const ticket=revision,id=actorId,payload={itemId:$('item').value,materialId:$('material').value,enhancementToken:token};
    busy=true;token=null;$('result').textContent='강화 결과를 확인하고 있어요…';render();
    try{
      const result=await request('crafting:enhance',payload);
      if(ticket!==revision||!dialog.open||getPlayer()?.id!==id)return;
      token=result.enhancementToken;
      // The authoritative reply may arrive before the next room snapshot.
      const player=getPlayer();player.inventory=result.inventory;player.equipmentSlots=result.equipmentSlots;
      const target=result.success?result.itemId:payload.itemId;
      render();$('item').value=target;render();
      $('result').textContent=result.success?`강화 성공! ${equipmentOf(target).name}`:'강화에 실패했어요. 재료 1개만 사용했고 장비와 강화 단계는 그대로예요.';
    }catch(error){if(ticket===revision&&dialog.open)$('result').textContent=error.message+' 다시 확인을 눌러 현재 가방을 확인해 주세요.';}
    finally{if(ticket===revision){busy=false;render();}}
  };
  return {async open(){const player=getPlayer();if(!player)return;actorId=player.id;stop();if(!dialog.open)dialog.showModal();await refresh();},update(){if(dialog.open&&!busy)render();},reset(){revision++;dialog.close();token=null;busy=false;actorId=null;}};
}
