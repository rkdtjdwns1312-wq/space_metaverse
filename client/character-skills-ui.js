import {SAGITTARIUS_SKILLS,isSagittarius} from '/shared/sagittarius-skills.js';
// 별자리별 설명 UI의 첫 구현. 아직 정하지 않은 별자리 칸은 빈 상태로 둡니다.
export function createCharacterSkillsUI(){
  const container=document.getElementById('self-skill-slots');
  const dialog=document.createElement('dialog');dialog.id='skill-description-dialog';
  dialog.innerHTML='<h2 id="skill-description-title"></h2><p id="skill-description-text"></p><button class="primary" type="button">닫기</button>';
  dialog.setAttribute('aria-labelledby','skill-description-title');document.body.append(dialog);
  dialog.querySelector('button').onclick=()=>dialog.close();
  let signature='';
  return {update(player){
    const next=[player?.avatar?.constellationId,player?.avatar?.level].join(':');if(next===signature)return;signature=next;
    container.replaceChildren();container.setAttribute('aria-label','별자리 스킬 4칸');
    for(const spec of SAGITTARIUS_SKILLS){
      const available=isSagittarius(player)&&player.avatar.level>=spec.level;
      const button=document.createElement('button');button.type='button';button.className='skill-placeholder';button.disabled=!available;
      button.dataset.slot=String(spec.slot);button.setAttribute('aria-label',available?`${spec.name} 설명 보기`:`LV${spec.level} 스킬 미해금`);
      if(available){const img=document.createElement('img');img.src=spec.iconUrl;img.alt=spec.name;button.append(img);}
      const label=document.createElement('span');label.textContent=available?spec.key:`LV${spec.level}`;button.append(label);
      button.onclick=()=>{
        dialog.querySelector('h2').textContent=spec.name+' · '+spec.key;
        dialog.querySelector('p').textContent=spec.description;
        window.dispatchEvent(new Event('game-ui-focus'));dialog.showModal();
      };container.append(button);
    }
  },reset(){signature='';if(dialog.open)dialog.close();}};
}
