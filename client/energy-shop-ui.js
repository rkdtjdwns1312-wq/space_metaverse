import {renderWallet} from './wallet-ui.js';
import {EQUIPMENT_ITEMS} from '/shared/equipment.js';

// 원화는 프레임·배경 없이 보여 줍니다. 가격과 능력치는 서버/공유 목록의 한 값만 사용합니다.
export function createEnergyShopUI({request,getPlayer,stop,toast}){
  const dialog=document.createElement('dialog');dialog.id='energy-shop-dialog';
  dialog.setAttribute('aria-labelledby','energy-shop-title');
  dialog.innerHTML='<header><h2 id="energy-shop-title">우주에너지 상점</h2><button id="energy-shop-close" class="secondary" type="button">닫기</button></header><div id="energy-shop-wallet"></div><p class="energy-shop-hint">모은 우주에너지로 장비를 골라 보세요. 장비는 내 정보의 세 칸에 장착할 수 있어요.</p><div id="energy-shop-list" class="energy-shop-list"></div>';
  document.body.append(dialog);
  const wallet=dialog.querySelector('#energy-shop-wallet'),list=dialog.querySelector('#energy-shop-list');let revision=0;
  dialog.querySelector('#energy-shop-close').onclick=()=>dialog.close();
  dialog.addEventListener('close',()=>{revision++;document.getElementById('world')?.focus();});
  const bonusText=bonus=>[
    bonus.attack&&'공격력 +'+bonus.attack,bonus.defense&&'방어력 +'+bonus.defense,
    bonus.hp&&'체력 +'+bonus.hp,bonus.mp&&'마나 +'+bonus.mp,
    bonus.speed&&'이동속도 +'+Math.round(bonus.speed*100)+'%',
    bonus.regen&&'10초 회복 +'+Math.round(bonus.regen*100)+'%'
  ].filter(Boolean).join(' · ');
  function render(items=EQUIPMENT_ITEMS){
    const player=getPlayer();if(!player)return;
    renderWallet(wallet,player);
    const level=player.role==='teacher'?5:player.avatar?.level||1;
    list.replaceChildren(...items.map(item=>{
      const row=document.createElement('article');row.className='energy-shop-item';row.dataset.itemId=item.id;
      const picture=document.createElement('img');picture.src=item.art;picture.alt='';picture.className='energy-shop-picture';
      const details=document.createElement('div');details.className='energy-shop-details';
      const title=document.createElement('strong');title.textContent=item.name+' · LV'+item.level;
      const flavor=document.createElement('p');flavor.textContent=item.description;
      const bonus=document.createElement('small');bonus.textContent=bonusText(item.bonus);
      details.append(title,flavor,bonus);
      const actions=document.createElement('div');actions.className='energy-shop-actions';
      const price=document.createElement('span');price.textContent=player.role==='teacher'?'교사 무료':'우주에너지 '+item.price;
      const buy=document.createElement('button');buy.type='button';buy.className='primary small';buy.textContent=level<item.level?'LV'+item.level+'부터':'사기';
      buy.disabled=level<item.level||(player.role!=='teacher'&&(player.cosmicEnergy||0)<item.price);
      buy.onclick=async()=>{buy.disabled=true;try{await request('shop:energy:buy',{itemId:item.id});toast(item.name+'을 샀어요. 가방에서 장착해 보세요.');render(items);}catch(error){toast(error.message);buy.disabled=false;}};
      actions.append(price,buy);row.append(picture,details,actions);return row;
    }));
  }
  return {
    async open(){const ticket=++revision;try{
      const result=await request('shop:energy:open',{});
      if(ticket!==revision||!getPlayer())return;
      stop();render(result.items||[]);if(!dialog.open)dialog.showModal();
    }catch(e){toast(e.message);}},
    update(){if(dialog.open)render();},
    reset(){revision++;if(dialog.open)dialog.close();}
  };
}
