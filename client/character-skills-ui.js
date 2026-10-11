import {characterAbilities} from '/shared/character-skills.js';

export function createCharacterSkillsUI(){
  const container=document.getElementById('self-skill-slots');
  const dialog=document.createElement('dialog');dialog.id='skill-description-dialog';
  const title=document.createElement('h2');title.id='skill-description-title';
  const description=document.createElement('p');description.id='skill-description-text';
  const close=document.createElement('button');close.type='button';close.className='primary';close.textContent='닫기';
  dialog.setAttribute('aria-labelledby',title.id);dialog.append(title,description,close);document.body.append(dialog);
  close.onclick=()=>dialog.close();
  let signature='',openSlot=null;
  dialog.addEventListener('close',()=>{openSlot=null;});
  return {update(player){
    const next=[player?.avatar?.constellationId,player?.avatar?.level,player?.transformation?.active,...(player?.equipmentSlots||[])].join(':');
    if(next===signature)return;signature=next;
    const specs=characterAbilities(player);
    if(dialog.open){
      const current=specs.find(spec=>spec.slot===openSlot);
      if(current&&player?.avatar?.level>=current.level){title.textContent=current.name+' · '+current.key;description.textContent=current.description;}
      else dialog.close();
    }
    container.replaceChildren();container.setAttribute('aria-label','일반 공격·일반 스킬·별자리초월');
    for(const spec of specs){
      const unlocked=Number.isFinite(player?.avatar?.level)&&player.avatar.level>=spec.level;
      const button=document.createElement('button');button.type='button';button.className='skill-placeholder';
      button.disabled=!unlocked;
      button.dataset.slot=String(spec.slot);
      button.setAttribute('aria-label',unlocked?`${spec.name} 설명 보기`:`LV${spec.level} ${spec.slot==='attack'?'일반 공격':spec.slot==='skill'?'일반 스킬':'별자리초월'} 미해금`);
      if(unlocked){
        if(spec.iconUrl){const img=document.createElement('img');img.src=spec.iconUrl;img.alt=spec.name;button.append(img);}
        else{const icon=document.createElement('span');icon.textContent='✧';icon.setAttribute('aria-hidden','true');button.append(icon);}
        button.onclick=()=>{
          openSlot=spec.slot;
          title.textContent=spec.name+' · '+spec.key;
          description.textContent=spec.description;
          window.dispatchEvent(new Event('game-ui-focus'));dialog.showModal();
        };
      }
      const label=document.createElement('span');label.textContent=unlocked?spec.key:`LV${spec.level}`;button.append(label);container.append(button);
    }
  },reset(){signature='';if(dialog.open)dialog.close();}};
}
