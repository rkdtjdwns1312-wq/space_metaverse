import {formatCurrency} from '/shared/economy.js';

const walletStylesheet='/wallet.css';
let stylesheetPromise;

function ensureStylesheet(){
  if(stylesheetPromise)return stylesheetPromise;
  const existing=[...document.querySelectorAll('link[rel="stylesheet"]')]
    .find(link=>new URL(link.href,document.baseURI).pathname===walletStylesheet);
  if(existing){
    stylesheetPromise=existing.sheet?Promise.resolve(existing):new Promise(resolve=>{
      existing.addEventListener('load',()=>resolve(existing),{once:true});
      existing.addEventListener('error',()=>resolve(existing),{once:true});
    });
  }else{
    const link=document.createElement('link');
    link.rel='stylesheet';
    link.href=walletStylesheet;
    link.dataset.currencyWalletStyles='';
    stylesheetPromise=new Promise(resolve=>{
      link.addEventListener('load',()=>resolve(link),{once:true});
      link.addEventListener('error',()=>resolve(link),{once:true});
      document.head.append(link);
    });
  }
  return stylesheetPromise;
}

function makeChip(key,label,iconPath,id){
  const chip=document.createElement('span');
  chip.className='currency-chip';
  chip.dataset.currency=key;

  const icon=document.createElement('img');
  icon.className='currency-icon';
  icon.src=iconPath;
  icon.alt='';
  icon.setAttribute('aria-hidden','true');

  const name=document.createElement('span');
  name.className='currency-label';
  name.textContent=label;

  const amount=document.createElement('span');
  amount.className='currency-amount';
  amount.dataset.currency=key;
  if(id)amount.id=id;
  chip.append(icon,name,amount);
  return chip;
}

function amountText(player,key){
  return formatCurrency(player,key);
}

export function renderWallet(container,player,{shardsId,energyId}={}){
  if(!container||typeof container.append!=='function')throw new TypeError('통화 지갑을 표시할 컨테이너가 필요합니다.');
  ensureStylesheet();
  container.classList.add('currency-wallet');

  let amounts=container.querySelectorAll(':scope > .currency-chip > .currency-amount');
  const valid=container.dataset.currencyWalletReady==='true'
    &&amounts.length===2
    &&amounts[0].dataset.currency==='cosmicEnergy'
    &&amounts[1].dataset.currency==='starShards';
  if(!valid){
    const energy=makeChip('cosmicEnergy','우주에너지','/assets/currencies/cosmic-energy.svg',energyId);
    const shards=makeChip('starShards','별 파편','/assets/currencies/star-shards.svg',shardsId);
    container.replaceChildren(energy,shards);
    container.dataset.currencyWalletReady='true';
    amounts=container.querySelectorAll(':scope > .currency-chip > .currency-amount');
  }else{
    if(energyId)amounts[0].id=energyId;
    if(shardsId)amounts[1].id=shardsId;
  }

  const entries=[['cosmicEnergy',amountText(player,'cosmicEnergy')],['starShards',amountText(player,'starShards')]];
  entries.forEach(([key,value],index)=>{
    const amount=amounts[index];
    if(amount.textContent!==value)amount.textContent=value;
    const label=amount.parentElement.querySelector('.currency-label')?.textContent||key;
    amount.parentElement.setAttribute('aria-label',`${label}: ${value}`);
  });
  return container;
}
