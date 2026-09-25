import {itemOf} from '/shared/config.js';
import {formatShards,hasUnlimitedShards,shardCost} from '/shared/economy.js';

// 선택한 재료는 화면에서만 예약합니다. 닫기/실패/연결 종료 때 아이템을 잃지 않습니다.
export function createCraftingUI({getPlayer,request,stop,toast}) {
  const dialog=document.createElement('dialog');dialog.id='crafting-dialog';dialog.setAttribute('aria-labelledby','crafting-title');
  dialog.innerHTML=`<header><h2 id="crafting-title">별빛 조합기</h2><button id="crafting-close" type="button" class="secondary">닫기</button></header>
    <button id="crafting-recipes-open" type="button" class="secondary" hidden>선생님 조합법 보기</button>
    <section id="crafting-recipes-panel" hidden aria-label="선생님 전용 조합법">
      <h3>선생님 전용 조합법</h3><div id="crafting-recipe-tabs" role="tablist" aria-label="완성 아이템 레벨">
      <button type="button" role="tab" data-recipe-level="2" aria-selected="true">LV2</button>
      <button type="button" role="tab" data-recipe-level="3" aria-selected="false">LV3</button>
      <button type="button" role="tab" data-recipe-level="4" aria-selected="false">LV4</button></div>
      <p id="crafting-recipes-status" role="status"></p><ul id="crafting-recipes-list"></ul>
      <button id="crafting-recipes-close" type="button" class="secondary">조합법 닫기</button>
    </section>
    <p>가방의 아이템을 누르면 재료 칸에 하나씩 들어가요. 재료 칸을 누르면 하나씩 빼요.</p>
    <div class="crafting-columns"><section><h3>조합 재료 <small>4 × 4</small></h3><div id="crafting-grid" aria-label="조합 재료 16칸"></div></section>
    <section><h3>내 인벤토리</h3><div id="crafting-bag" aria-label="조합에 넣을 아이템"></div><p id="crafting-bag-empty" hidden>가방이 비었어요.</p></section></div>
    <p id="crafting-wallet"></p><p id="crafting-note" role="status"></p><footer><button id="crafting-clear" type="button" class="secondary">재료 모두 빼기</button><button id="crafting-submit" type="button" class="primary">조합</button></footer>`;
  document.body.append(dialog);const $=id=>dialog.querySelector('#'+id);
  let selected=new Map(),busy=false,enabled=false,fee=0;
  let recipeRequest=0;
  function clearRecipes(){
    recipeRequest++;$('crafting-recipes-panel').hidden=true;
    $('crafting-recipes-list').replaceChildren();$('crafting-recipes-status').textContent='';
  }
  async function showRecipes(level){
    if(getPlayer()?.role!=='teacher')return;
    const ticket=++recipeRequest;
    $('crafting-recipes-panel').hidden=false;$('crafting-recipes-list').replaceChildren();
    $('crafting-recipes-status').textContent='조합법을 불러오는 중이에요.';
    for(const tab of dialog.querySelectorAll('[data-recipe-level]'))tab.setAttribute('aria-selected',String(Number(tab.dataset.recipeLevel)===level));
    try{
      const info=await request('crafting:recipes',{level});
      // 늦은 응답은 닫힌 창이나 이후 학생 세션에 비공개 내용을 남기지 않습니다.
      if(ticket!==recipeRequest||!dialog.open||getPlayer()?.role!=='teacher')return;
      for(const recipe of info.recipes){
        const li=document.createElement('li'),output=itemOf(recipe.output.id);
        const title=document.createElement('strong');title.textContent=output.name+' × '+recipe.output.quantity;
        const image=document.createElement('span');image.className='recipe-output';icon(image,output);image.append(title);
        const parts=document.createElement('p');parts.textContent=recipe.ingredients.map(p=>itemOf(p.id).name+' × '+p.quantity).join(' + ');
        li.append(image,parts);$('crafting-recipes-list').append(li);
      }
      const player=getPlayer(),cost=shardCost(player,fee);
      $('crafting-recipes-status').textContent=info.recipes.length?'LV'+level+' 조합법 '+info.recipes.length+'개 · 조합 비용 '+(hasUnlimitedShards(player)?'교사 무료 (합계 0)':'별 파편 '+cost+'개'):'등록된 조합법이 없습니다.';
    }catch(e){if(ticket===recipeRequest)$('crafting-recipes-status').textContent=e.message;}
  }
  $('crafting-recipes-open').onclick=()=>showRecipes(2);
  $('crafting-recipes-close').onclick=clearRecipes;
  for(const tab of dialog.querySelectorAll('[data-recipe-level]'))tab.onclick=()=>showRecipes(Number(tab.dataset.recipeLevel));
  function icon(button,item){
    if(item.art){const img=document.createElement('img');img.src=item.art;img.alt='';button.append(img);}
    else{const span=document.createElement('span');span.textContent=item.icon;button.append(span);}
  }
  function render(){
    const player=getPlayer();if(!player){dialog.close();return;}
    $('crafting-recipes-open').hidden=player.role!=='teacher';
    if(player.role!=='teacher')clearRecipes();
    const inventory=player.inventory||[];
    // 지급/사용으로 가방이 바뀌어도 실제 보유량보다 많이 예약하지 않습니다.
    for(const [id,count] of selected){const own=inventory.find(i=>i.id===id)?.quantity||0;if(!own)selected.delete(id);else selected.set(id,Math.min(count,own));}
    $('crafting-grid').replaceChildren();const materials=[...selected];
    for(let i=0;i<16;i++){
      const button=document.createElement('button');button.type='button';button.className='crafting-slot';
      const entry=materials[i];
      if(entry){const [id,quantity]=entry,item=itemOf(id);button.dataset.itemId=id;icon(button,item);button.append(Object.assign(document.createElement('small'),{textContent:'× '+quantity}));button.setAttribute('aria-label',item.name+' 재료 '+quantity+'개, 하나 빼기');button.disabled=busy;button.onclick=()=>{quantity===1?selected.delete(id):selected.set(id,quantity-1);render();};}
      else{button.disabled=true;button.setAttribute('aria-label','빈 재료 칸 '+(i+1));button.textContent='+';}
      $('crafting-grid').append(button);
    }
    $('crafting-bag').replaceChildren();$('crafting-bag-empty').hidden=inventory.length>0;
    for(const entry of inventory){
      const item=itemOf(entry.id);if(!item)continue;const count=selected.get(entry.id)||0,available=entry.quantity-count;
      const button=document.createElement('button');button.type='button';button.dataset.itemId=entry.id;icon(button,item);
      button.append(Object.assign(document.createElement('span'),{textContent:item.name+' · '+available+'개'}));button.setAttribute('aria-label',item.name+' 넣기, 남은 '+available+'개');button.disabled=busy||available===0;
      button.onclick=()=>{if(!selected.has(entry.id)&&selected.size>=16){toast('재료는 16종류까지 넣을 수 있어요.');return;}selected.set(entry.id,count+1);render();};$('crafting-bag').append(button);
    }
    const cost=shardCost(player,fee),teacher=hasUnlimitedShards(player);
    $('crafting-wallet').textContent='내 별 파편 ★ '+formatShards(player);
    $('crafting-submit').textContent=teacher?'조합 · 교사 무료':'조합 · 별 파편 '+cost+'개';
    $('crafting-submit').disabled=busy||!enabled||!selected.size||(player.starShards||0)<cost;
    $('crafting-clear').disabled=busy||!selected.size;
  }
  $('crafting-close').onclick=()=>dialog.close();$('crafting-clear').onclick=()=>{selected.clear();render();};
  dialog.addEventListener('close',()=>{selected.clear();clearRecipes();});
  $('crafting-submit').onclick=async()=>{
    if(busy)return;busy=true;render();
    const ingredients=[...selected].map(([id,quantity])=>({id,quantity}));
    try{
      const result=await request('crafting:combine',{ingredients});selected.clear();
      const player=getPlayer(),charge=shardCost(player,fee);
      $('crafting-note').textContent=result.success?'조합 성공! '+itemOf(result.itemId)?.name+'을 얻었어요.':`조합에 실패했어요. 재료는 모두 가방으로 돌아왔어요. ${hasUnlimitedShards(player)?'교사는 무료예요.':'별 파편 '+charge+'개를 사용했어요.'}`;
    }catch(e){$('crafting-note').textContent=e.message;}finally{busy=false;render();}
  };
  return {
    async open(){
      try{const info=await request('crafting:open',{});enabled=info.enabled;fee=info.fee;selected.clear();const player=getPlayer();$('crafting-note').textContent=enabled?(hasUnlimitedShards(player)?'선생님은 무료로 조합할 수 있어요. 실패하면 재료는 그대로 남아요.':'조합할 때 별 파편 '+shardCost(player,fee)+'개가 사용돼요. 실패하면 재료는 그대로 남아요.'):'조합법과 상위 레벨 아이템을 준비 중이에요. 재료를 미리 담아 볼 수 있고 별 파편은 소모되지 않아요.';render();stop();if(!dialog.open)dialog.showModal();}
      catch(e){toast(e.message);}
    },
    update(){if(dialog.open)render();},
    reset(){dialog.close();selected.clear();clearRecipes();}
  };
}
