import {HOLDING_ITEMS} from '/shared/holding-abilities.js';

// 보유능력은 아이템 소모와 별도입니다. 실제 주간 제한·보상 판정은 서버가 담당합니다.
export function createHoldingUI({request,toast,onChanged,onDraw}){
  const cache=new Map(),pending=new Map();let busy=false,revision=0;
  const dialog=document.createElement('dialog');dialog.className='holding-dialog';
  document.body.append(dialog);
  const el=(tag,text,className)=>Object.assign(document.createElement(tag),{textContent:text||'',className:className||''});
  const load=async itemId=>{
    if(pending.has(itemId))return pending.get(itemId);
    const rev=revision;
    const promise=request('holding:status',{itemId}).then(reply=>{
      const value={...reply.items[0],resetAt:reply.resetAt};
      if(rev===revision)cache.set(itemId,{value,at:Date.now()});return value;
    }).finally(()=>pending.delete(itemId));pending.set(itemId,promise);return promise;
  };
  function paint(button,state){
    button.textContent=state.used?'(이번주 사용)':'보유능력 사용하기';
    button.disabled=state.used;button.title=state.reason||'월요일 0시(한국 시간)에 다시 사용할 수 있어요.';
  }
  function button(item){
    if(!HOLDING_ITEMS.some(def=>def.itemId===item.id))return null;
    const result=el('button','보유능력 확인 중','small secondary holding-use');result.type='button';result.disabled=true;
    const saved=cache.get(item.id);
    if(saved&&Date.now()-saved.at<2000&&Date.now()<saved.value.resetAt)paint(result,saved.value);
    else load(item.id).then(state=>paint(result,state)).catch(error=>{result.textContent='보유능력 다시 확인';result.disabled=false;result.title=error.message;});
    result.onclick=()=>open(item);return result;
  }
  async function open(item){
    if(busy)return;busy=true;
    try{
      const state=await load(item.id),def=HOLDING_ITEMS.find(def=>def.itemId===item.id);
      if(!state.canUse){toast(state.reason);return;}
      const title=el('h2',item.name+' 보유능력'),description=el('p',item.special),note=el('p','월요일 0시(한국 시간)에 다시 사용할 수 있어요.','muted');
      let choice;
      const controls=el('div','','holding-choices');
      if(def.choice==='planet'){
        choice=el('select');choice.setAttribute('aria-label','경고를 지울 부서');
        for(const planet of state.planets)choice.append(Object.assign(el('option',planet.name+' · 경고 '+planet.count+'개'),{value:planet.id}));
        controls.append(choice);if(!state.planets.length)controls.append(el('p','지울 수 있는 내 경고가 없어요.'));
      }
      if(def.choice==='reward'){
        controls.append(el('p','은하수의 기운: '+state.stacks));choice=el('select');choice.setAttribute('aria-label','보유능력 보상');
        for(const [value,text,cost] of [['shards','기운 1 → 별 파편 4개',1],['card','기운 2 → 별 카드 1장',2]])choice.append(Object.assign(el('option',text),{value,disabled:state.stacks<cost}));
        controls.append(choice);
      }
      const actions=el('div','','dialog-actions'),close=el('button','닫기','secondary'),use=el('button','보유능력 사용하기','primary');
      close.type=use.type='button';close.onclick=()=>dialog.close();
      use.disabled=!!choice&&!Array.from(choice.options).some(option=>!option.disabled);
      use.onclick=async()=>{
        if(busy)return;busy=true;use.disabled=true;close.disabled=true;
        try{
          const reply=await request('holding:use',{itemId:item.id,...(def.choice==='planet'?{planetId:choice.value}:{}),...(def.choice==='reward'?{reward:choice.value}:{})});
          cache.clear();dialog.close();toast(reply.message);onChanged();if(reply.draw)await onDraw();
        }catch(error){toast(error.message);use.disabled=false;}finally{busy=false;close.disabled=false;}
      };
      actions.append(close,use);dialog.replaceChildren(title,description,controls,note,actions);if(!dialog.open)dialog.showModal();
    }catch(error){toast(error.message);}finally{busy=false;}
  }
  return {button,reset(){revision++;cache.clear();pending.clear();busy=false;dialog.close();}};
}
