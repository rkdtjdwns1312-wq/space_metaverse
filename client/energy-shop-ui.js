import {renderWallet} from './wallet-ui.js';
import {EQUIPMENT_ITEMS,equipmentStatText} from '/shared/equipment.js';
import {hasUnlimitedShards} from '/shared/economy.js';
import {STAT_GROWTH_KEYS,statGrowthRule} from '/shared/stat-growth.js';

// 원화는 프레임·배경 없이 보여 줍니다. 가격과 능력치는 서버/공유 목록의 한 값만 사용합니다.
export function createEnergyShopUI({request,getPlayer,stop,toast}){
  const dialog=document.createElement('dialog');dialog.id='energy-shop-dialog';
  dialog.setAttribute('aria-labelledby','energy-shop-title');
  dialog.innerHTML='<header><h2 id="energy-shop-title">우주에너지 상점</h2><button id="energy-shop-close" class="secondary" type="button">닫기</button></header><div id="energy-shop-wallet"></div><p class="energy-shop-hint">모은 우주에너지로 장비를 골라 보세요. 가방에서 장비 → 장착하기를 누르고 1·2·3번 칸을 골라요.</p><button id="energy-shop-catalog-open" class="secondary teacher-equipment-catalog-trigger" type="button" hidden>모든 아이템 보기</button><div id="energy-shop-level-tabs" class="shop-level-tabs" role="tablist" aria-label="장비 레벨"></div><div id="energy-shop-list" class="energy-shop-list"></div><p id="energy-shop-empty" class="energy-shop-hint" hidden>이 레벨의 장비는 준비 중이에요.</p>';
  const catalogDialog=document.createElement('dialog');catalogDialog.id='teacher-equipment-catalog-dialog';catalogDialog.setAttribute('aria-labelledby','teacher-equipment-catalog-title');
  catalogDialog.innerHTML='<header><h2 id="teacher-equipment-catalog-title">장착 가능한 모든 아이템</h2><button id="teacher-equipment-catalog-close" class="secondary" type="button">닫기</button></header><p class="energy-shop-hint">현재 등록된 장비 목록이에요. 여기서는 구매할 수 없어요.</p><div id="teacher-equipment-catalog-list" class="energy-shop-list"></div>';
  document.body.append(catalogDialog);
  document.body.append(dialog);
  const statPanel=document.createElement('section');statPanel.className='energy-stat-purchase';statPanel.innerHTML='<h3>하루 한 번 · 영구 능력치</h3><p id="energy-stat-description"></p><p id="energy-stat-chances"></p><button id="energy-stat-buy" type="button" class="primary">능력치 구매</button><p id="energy-stat-summary" class="muted"></p><p id="energy-stat-result" class="energy-stat-result" role="status"></p>';dialog.querySelector('#energy-shop-level-tabs').before(statPanel);
  const statBuy=statPanel.querySelector('button'),statSummary=statPanel.querySelector('#energy-stat-summary'),statResult=statPanel.querySelector('#energy-stat-result');let statInfo=null,statBusy=false;
  function renderStat(){const player=getPlayer();statPanel.hidden=player?.role!=='student';if(statPanel.hidden)return;const state=player.statGrowth,day=statInfo?.dayKey;const bought=!!day&&(statInfo.purchasedToday||(state?.lastPurchaseDay||'')>=day);
    const level=player.avatar?.level??1,rule=statGrowthRule(level),cost=rule?(hasUnlimitedShards(player)?0:rule.cost):0;
    statPanel.querySelector('#energy-stat-description').textContent=rule?`현재 Lv${level} · ${hasUnlimitedShards(player)?'마스터 무료':`우주에너지 ${cost}개`}로 능력치 하나가 영구히 올라요.`:'Lv2로 진화한 뒤 영구 능력치를 구매할 수 있어요.';
    const names={hp:'최대 체력',mp:'최대 마나',attack:'공격력',defense:'방어력'};statPanel.querySelector('#energy-stat-chances').textContent=rule?STAT_GROWTH_KEYS.map(key=>`${names[key]} +${rule.amounts[key]} (${rule.weights[key]}%)`).join(' · '):'';
    statBuy.disabled=statBusy||!statInfo||!rule||bought||(player.cosmicEnergy||0)<cost;statBuy.textContent=!rule?'Lv2부터 구매 가능':bought?'오늘 구매 완료':hasUnlimitedShards(player)?'능력치 구매 · 마스터 무료':`능력치 구매 · ${cost}`;const bonuses=state?.bonuses||statInfo?.bonuses||{};statSummary.textContent=`누적: 체력 +${bonuses.hp||0} · 마나 +${bonuses.mp||0} · 공격력 +${bonuses.attack||0} · 방어력 +${bonuses.defense||0} · 계정당 하루 한 번 · 한국시간 자정 초기화 · 진화해도 당일 재구매 불가`;
  }
  statBuy.onclick=async()=>{if(statBusy||statBuy.disabled)return;const ticket=revision;statBusy=true;statResult.textContent='별빛으로 능력치를 정하는 중…';renderStat();try{const result=await request('shop:energy:stat-buy',{});if(ticket!==revision||!dialog.open)return;statInfo=result;const p=getPlayer();if(p){p.cosmicEnergy=result.cosmicEnergy;p.statGrowth={bonuses:result.bonuses,lastPurchaseDay:result.dayKey};}statResult.textContent=result.message;toast(result.message);render();}catch(error){if(ticket===revision)statResult.textContent=error.message;}finally{statBusy=false;if(ticket===revision)renderStat();}};
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
  function render(){
    const player=getPlayer();if(!player)return;
    renderStat();
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
      const bonus=document.createElement('small');bonus.textContent=equipmentStatText(item);
      details.append(title,flavor,bonus);
      const actions=document.createElement('div');actions.className='energy-shop-actions';
      if(item.craftOnly&&player.role!=='teacher'){
        const notice=document.createElement('span');notice.className='energy-shop-craft-notice';
        notice.textContent='이 아이템은 조합을 통해서만\n획득할 수 있습니다';
        const unavailable=document.createElement('button');unavailable.type='button';unavailable.className='small secondary';unavailable.textContent='구입 불가';unavailable.disabled=true;
        actions.append(notice,unavailable);row.append(picture,details,actions);return row;
      }
      const price=document.createElement('span');price.textContent=hasUnlimitedShards(player)?(player.role==='teacher'?'교사 무료':'마스터 무제한 · 비용 0'):'우주에너지 '+item.price;
      const buy=document.createElement('button');buy.type='button';buy.className='primary small';buy.textContent=level<item.level?'LV'+item.level+'부터':'사기';
      buy.disabled=level<item.level||(!hasUnlimitedShards(player)&&(player.cosmicEnergy||0)<item.price);
      buy.onclick=async()=>{buy.disabled=true;try{await request('shop:energy:buy',{itemId:item.id});toast(item.name+'를 구매했습니다');render();}catch(error){toast(error.message);buy.disabled=false;}};
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
      const bonus=document.createElement('small');bonus.textContent=equipmentStatText(item);
      details.append(title,flavor,bonus);row.append(picture,details);return row;
    }));
  }
  return {
    async open(){const ticket=++revision;try{
      const result=await request('shop:energy:open',{});
      if(ticket!==revision||!getPlayer())return;
      statInfo=null;statResult.textContent='';
      if(getPlayer().role==='student')statInfo=await request('shop:energy:stat-info',{});
      if(ticket!==revision||!getPlayer())return;
      catalogItems=EQUIPMENT_ITEMS;
      selectedLevel=1;stop();render();if(!dialog.open)dialog.showModal();
    }catch(e){toast(e.message);}},
    update(){if(dialog.open)render();},
    reset(){revision++;if(dialog.open)dialog.close();if(catalogDialog.open)catalogDialog.close();}
  };
}
