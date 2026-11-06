let nextHelpId=0;

// 설명 문자열은 그대로 보존하고, 재사용 시간 감소 옆에만 펼침 안내를 붙입니다.
export function renderEffectText(container,text){
  container.replaceChildren();
  let offset=0;
  for(const match of text.matchAll(/(?:모든 )?스킬 재사용 시간 감소 \d+%/g)){
    container.append(document.createTextNode(text.slice(offset,match.index)+match[0]));
    const button=document.createElement('button');
    button.type='button';button.className='effect-help-button';button.textContent='!';
    button.setAttribute('aria-label',match[0]+' 설명');button.setAttribute('aria-expanded','false');
    const hint=document.createElement('span');
    hint.id='effect-help-'+(++nextHelpId);hint.className='effect-help-message';hint.hidden=true;
    hint.textContent='스킬을 더 자주 사용할 수 있게 됩니다';
    button.setAttribute('aria-controls',hint.id);
    button.onclick=event=>{event.stopPropagation();hint.hidden=!hint.hidden;button.setAttribute('aria-expanded',String(!hint.hidden));};
    container.append(button,hint);offset=match.index+match[0].length;
  }
  container.append(document.createTextNode(text.slice(offset)));
}
