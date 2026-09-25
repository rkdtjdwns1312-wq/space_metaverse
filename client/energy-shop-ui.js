import {renderWallet} from './wallet-ui.js';

export function createEnergyShopUI({request,getPlayer,stop,toast}){
  const dialog=document.createElement('dialog');dialog.id='energy-shop-dialog';
  dialog.setAttribute('aria-labelledby','energy-shop-title');
  dialog.innerHTML='<h2 id="energy-shop-title">우주에너지 상점</h2><div id="energy-shop-wallet"></div><p class="energy-shop-empty">새로운 물품을 준비하고 있어요.</p><p>이곳은 우주에너지로 이용하는 상점이에요.<br>기존 아이템은 옆 별상점에서 별 파편으로 살 수 있어요.</p><button id="energy-shop-close" class="secondary" type="button">닫기</button>';
  document.body.append(dialog);
  const wallet=dialog.querySelector('#energy-shop-wallet');let revision=0;
  dialog.querySelector('#energy-shop-close').onclick=()=>dialog.close();
  dialog.addEventListener('close',()=>{revision++;document.getElementById('world')?.focus();});
  return {
    async open(){const ticket=++revision;try{
      await request('shop:energy:open',{});
      if(ticket!==revision||!getPlayer())return;
      stop();renderWallet(wallet,getPlayer());if(!dialog.open)dialog.showModal();
    }catch(e){toast(e.message);}},
    update(){if(dialog.open)renderWallet(wallet,getPlayer());},
    reset(){revision++;if(dialog.open)dialog.close();}
  };
}
