import {renderWallet} from './wallet-ui.js';
import {EQUIPMENT_ITEMS} from '/shared/equipment.js';

// 원화는 프레임·배경 없이 보여 줍니다. 가격과 능력치는 서버/공유 목록의 한 값만 사용합니다.
export function createEnergyShopUI({request,getPlayer,stop,toast}){
  const dialog=document.createElement('dialog');dialog.id='energy-shop-dialog';
  dialog.setAttribute('aria-labelledby','energy-shop-title');
  dialog.innerHTML='<header><h2 id="energy-shop-title">우주에너지 상점</h2><button id="energy-shop-close" class="secondary" type="button">닫기</button></header><div id="energy-shop-wallet"></div><p class="energy-shop-hint">모은 우주에너지로 장비를 골라 보세요. 장비는 내 정보의 세 칸에 장착할 수 있어요.</p><button id="energy-shop-catalog-open" class="secondary teacher-equipment-catalog-trigger" type="button" hidden>모든 아이템 보기</button><div id="energy-shop-level-tabs" class="shop-level-tabs" role="tablist" aria-label="장비 레벨"></div><div id="energy-shop-list" class="energy-shop-list"></div><p id="energy-shop-empty" class="energy-shop-hint" hidden>이 레벨의 장비는 준비 중이에요.</p>';
  const catalogDialog=document.createElement('dialog');catalogDialog.id='teacher-equipment-catalog-dialog';catalogDialog.setAttribute('aria-labelledby','teacher-equipment-catalog-title');
  catalogDialog.innerHTML='<header><h2 id="teacher-equipment-catalog-title">장착 가능한 모든 아이템</h2><button id="teacher-equipment-catalog-close" class="secondary" type="button">닫기</button></header><p class="energy-shop-hint">현재 등록된 장비 목록이에요. 여기서는 구매할 수 없어요.</p><div id="teacher-equipment-catalog-list" class="energy-shop-list"></div>';
  document.body.append(catalogDialog);
  document.body.append(dialog);
  const wallet=dialog.querySelector('#energy-shop-wallet'),list=dialog.querySelector('#energy-shop-list'),catalogList=catalogDialog.querySelector('#teacher-equipment-catalog-list');let revision=0,catalogItems=EQUIPMENT_ITEMS,selectedLevel=1;
  const levelTabs=dialog.querySelector('#energy-shop-level-tabs');
  for(let level=1;level<=5;level++){
    const button=document.createElement('button');button.type='button';button.setAttribute('role','tab');button.textContent='LV'+level;button.dataset.level=String(level);
    button.setAttribute('aria-controls','energy-shop-list');button.onclick=()=>{selectedLevel=level;render();};
    button.onkeydown=event=>{const enabled=[...levelTabs.children].filter(tab=>!tab.disabled),index=enabled.indexOf(button);
      const next=event.key==='ArrowRight'||event.key==='ArrowDown'?enabled[(index+1)%enabled.length]
        :event.key==='ArrowLeft'||event.key==='ArrowUp'?enabled[(index+enabled.length-1)%enabled.length]
        :event.key==='Home'?enabled[0]:event.key==='End'?enabled.at(-1):null;
      if(next){event.preventDefault();selectedLevel=Number(next.dataset.level);render();next.focus();}
    };
    levelTabs.append(button);
  }
  dialog.querySelector('#energy-shop-close').onclick=()=>dialog.close();
  dialog.querySelector('#energy-shop-catalog-open').onclick=()=>{if(getPlayer()?.role!=='teacher')return;renderCatalog();catalogDialog.showModal();};
  catalogDialog.querySelector('#teacher-equipment-catalog-close').onclick=()=>catalogDialog.close();
  dialog.addEventListener('close',()=>{revision++;if(catalogDialog.open)catalogDialog.close();document.getElementById('world')?.focus();});
  catalogDialog.addEventListener('close',()=>{if(dialog.open)dialog.querySelector('#energy-shop-catalog-open').focus();});
  const bonusText=bonus=>[
    bonus.attack&&'공격력 +'+bonus.attack,bonus.defense&&'방어력 +'+bonus.defense,
    bonus.hp&&'체력 +'+bonus.hp,bonus.mp&&'마나 +'+bonus.mp,
    bonus.speed&&'이동속도 +'+Math.round(bonus.speed*100)+'%',
    bonus.regen&&'10초 회복 +'+Math.round(bonus.regen*100)+'%'
  ].filter(Boolean).join(' · ');
  function render(){
    const player=getPlayer();if(!player)return;
    const catalogButton=dialog.querySelector('#energy-shop-catalog-open');catalogButton.hidden=player.role!=='teacher';
    renderWallet(wallet,player);
    const level=player.role==='teacher'?5:player.avatar?.level||1;
    if(selectedLevel>level)selectedLevel=1;
    for(const button of levelTabs.children){const tabLevel=Number(button.dataset.level),selected=tabLevel===selectedLevel;
      button.disabled=tabLevel>level;button.title=button.disabled?'LV'+tabLevel+'부터 열려요.':'';
      button.classList.toggle('selected',selected);button.setAttribute('aria-selected',String(selected));button.tabIndex=selected?0:-1;
    }
    const items=catalogItems.filter(item=>item.level===selectedLevel);
    dialog.querySelector('#energy-shop-empty').hidden=items.length>0;
    list.replaceChildren(...items.map(item=>{
      const row=document.createElement('article');row.className='energy-shop-item';row.dataset.itemId=item.id;
      const picture=document.createElement('img');picture.src=item.art;picture.alt='';picture.className='energy-shop-picture';
      const details=document.createElement('div');details.className='energy-shop-details';
      const title=document.createElement('strong');title.textContent=item.name+' · LV'+item.level;
      const flavor=document.createElement('p');flavor.textContent=item.description;
      const bonus=document.createElement('small');bonus.textContent=bonusText(item.bonus);
      details.append(title,flavor,bonus);
      const actions=document.createElement('div');actions.className='energy-shop-actions';
      if(item.craftOnly){
        const notice=document.createElement('span');notice.className='energy-shop-craft-notice';
        notice.textContent='이 아이템은 조합을 통해서만\n획득할 수 있습니다';
        const unavailable=document.createElement('button');unavailable.type='button';unavailable.className='small secondary';unavailable.textContent='구입 불가';unavailable.disabled=true;
        actions.append(notice,unavailable);row.append(picture,details,actions);return row;
      }
      const price=document.createElement('span');price.textContent=player.role==='teacher'?'교사 무료':'우주에너지 '+item.price;
      const buy=document.createElement('button');buy.type='button';buy.className='primary small';buy.textContent=level<item.level?'LV'+item.level+'부터':'사기';
      buy.disabled=level<item.level||(player.role!=='teacher'&&(player.cosmicEnergy||0)<item.price);
      buy.onclick=async()=>{buy.disabled=true;try{await request('shop:energy:buy',{itemId:item.id});toast(item.name+'을 샀어요. 가방에서 장착해 보세요.');render();}catch(error){toast(error.message);buy.disabled=false;}};
      actions.append(price,buy);row.append(picture,details,actions);return row;
    }));
  }
  function renderCatalog(){
    if(getPlayer()?.role!=='teacher')return;
    catalogList.replaceChildren(...catalogItems.map(item=>{
      const row=document.createElement('article');row.className='energy-shop-item';row.dataset.itemId=item.id;
      const picture=document.createElement('img');picture.src=item.art;picture.alt='';picture.className='energy-shop-picture';
      const details=document.createElement('div');details.className='energy-shop-details';
      const title=document.createElement('strong');title.textContent=item.name+' · LV'+item.level;
      const flavor=document.createElement('p');flavor.textContent=item.description;
      const bonus=document.createElement('small');bonus.textContent=bonusText(item.bonus);
      details.append(title,flavor,bonus);row.append(picture,details);return row;
    }));
  }
  return {
    async open(){const ticket=++revision;try{
      const result=await request('shop:energy:open',{});
      if(ticket!==revision||!getPlayer())return;
      catalogItems=EQUIPMENT_ITEMS;
      selectedLevel=1;stop();render();if(!dialog.open)dialog.showModal();
    }catch(e){toast(e.message);}},
    update(){if(dialog.open)render();},
    reset(){revision++;if(dialog.open)dialog.close();if(catalogDialog.open)catalogDialog.close();}
  };
}
