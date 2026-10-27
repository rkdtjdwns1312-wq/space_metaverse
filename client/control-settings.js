import {DEFAULT_CONTROL_KEYS,CONTROL_KEY_OPTIONS,controlKeyLabel,validateControlKeys} from '/shared/control-keys.js';
const STORAGE_KEY='woozooclass-control-keys-v1';
export function createControlSettings({stop,onChange=()=>{}}){
  let bindings={...DEFAULT_CONTROL_KEYS};
  try{const stored=JSON.parse(localStorage.getItem(STORAGE_KEY));if(validateControlKeys(stored))bindings=stored;}catch{}
  const dialog=document.createElement('dialog');dialog.id='control-settings-dialog';dialog.setAttribute('aria-labelledby','control-settings-title');
  dialog.innerHTML='<header><h2 id="control-settings-title">조작 키 설정</h2><button type="button" class="secondary" id="control-settings-close">닫기</button></header><p>자주 쓰는 세 가지 키를 알파벳 또는 키보드 윗줄 1~6으로 바꿔 보세요.</p><div id="control-key-fields"></div><p class="muted">이동 W·A·S·D와 파티 R은 그대로 사용해요. 1을 선택하면 별자리초월은 화면 버튼으로 사용할 수 있어요.<br>설정은 이 기기의 현재 브라우저에 저장돼요.</p><p id="control-settings-message" role="status"></p><footer><button type="button" class="secondary" id="control-settings-default">기본값 Q · E · F</button><button type="button" class="primary" id="control-settings-save">저장</button></footer>';
  document.body.append(dialog);
  const labels={attack:'기본공격',skill:'스킬',interact:'상호작용'},selects={};
  for(const [action,label] of Object.entries(labels)){
    const row=document.createElement('label');row.textContent=label;const select=document.createElement('select');select.id='control-key-'+action;
    for(const code of CONTROL_KEY_OPTIONS){const option=document.createElement('option');option.value=code;option.textContent=controlKeyLabel(code);select.append(option);}row.append(select);selects[action]=select;dialog.querySelector('#control-key-fields').append(row);
  }
  const message=dialog.querySelector('#control-settings-message'),label=action=>controlKeyLabel(bindings[action]);
  function refresh(){
    for(const [action,id] of [['attack','touch-attack'],['skill','touch-skill']]){
      const button=document.getElementById(id);button.querySelector('.combat-key-badge').textContent=label(action);
      for(const attr of ['aria-label','title']){const text=button.getAttribute(attr);if(text)button.setAttribute(attr,text.replace(/\([A-Z1-6]\)/g,'('+label(action)+')'));}
    }
    document.getElementById('interact-key').textContent=label('interact');
    document.querySelector('#interact-prompt>span').textContent=label('interact')+' 상호작용하기';
    const object=document.getElementById('interact-object').textContent||'근처 물체';document.getElementById('touch-interact').setAttribute('aria-label',object+' · '+label('interact')+' 상호작용하기');
    document.querySelector('.map-footer>span').textContent=`⌨ WASD·방향키·조이스틱 이동 / ${label('attack')} 공격·${label('skill')} 스킬·${label('interact')} 상호작용`;
  }
  function fill(value){for(const action of Object.keys(selects))selects[action].value=value[action];}
  document.getElementById('control-settings-open').onclick=()=>{stop();fill(bindings);message.textContent='';dialog.showModal();};
  dialog.querySelector('#control-settings-close').onclick=()=>dialog.close();
  dialog.querySelector('#control-settings-default').onclick=()=>{fill(DEFAULT_CONTROL_KEYS);message.textContent='저장을 누르면 기본 키로 돌아가요.';};
  dialog.querySelector('#control-settings-save').onclick=()=>{
    const next=Object.fromEntries(Object.entries(selects).map(([action,select])=>[action,select.value]));
    if(!validateControlKeys(next)){message.textContent='각 기능에 서로 다른 키를 골라 주세요.';return;}
    stop();bindings=next;let persisted=true;try{localStorage.setItem(STORAGE_KEY,JSON.stringify(next));}catch{persisted=false;}
    refresh();onChange();message.textContent=persisted?'저장했어요. 닫기를 누르고 새 키를 사용해 보세요.':'현재 창에 적용했어요. 브라우저가 저장을 차단하여 새로고침하면 초기화될 수 있어요.';
  };
  window.addEventListener('storage',event=>{if(event.key!==STORAGE_KEY)return;try{const next=event.newValue===null?DEFAULT_CONTROL_KEYS:JSON.parse(event.newValue);if(validateControlKeys(next)){bindings={...next};refresh();onChange();}}catch{}});
  refresh();return {code:action=>bindings[action],label,refresh};
}
