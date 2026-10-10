import {PROGRESSION} from '/shared/config.js';
import {constellationOf} from '/shared/constellations.js';
function replyInfo(value) {
  return value?.info && typeof value.info === 'object' ? value.info : value;
}

function ensureStylesheet() {
  if (document.querySelector('link[data-star-ui-style]')) return;
  const link = document.createElement('link');
  link.rel = 'stylesheet'; link.href = '/evolution.css'; link.dataset.starUiStyle = '';
  document.head.append(link);
}

export function createEvolutionUI({ request, stop, toast, isJoined }) {
  ensureStylesheet();
  const dialog = document.createElement('dialog');
  dialog.id = 'evolution-dialog';
  dialog.className = 'star-dialog evolution-dialog';
  dialog.setAttribute('aria-labelledby', 'evolution-title');
  dialog.innerHTML = `<header><h2 id="evolution-title">진화의 별</h2><button id="evolution-header-close" class="secondary evolution-close-allowed" type="button">닫기</button></header>
    <p id="evolution-summary"></p><p id="evolution-error" role="alert"></p>
    <section id="evolution-menu"><button id="evolution-change" class="primary" type="button">별자리 아바타 변경하기</button><button id="evolution-evolve" class="primary" type="button">별자리 아바타 진화하기</button><button id="evolution-teacher" class="primary" type="button" hidden>별자리와 단계 자유 선택</button><button id="evolution-close" class="secondary evolution-close-allowed" type="button">닫기</button></section>
    <section id="evolution-panel" hidden><h3 id="evolution-panel-title"></h3><p id="evolution-help"></p><div id="evolution-levels" hidden></div><div id="evolution-types" hidden></div><div id="evolution-grid" class="constellation-grid"></div><div class="dialog-actions"><button id="evolution-refresh" class="secondary" type="button">새로고침</button><button id="evolution-back" class="secondary" type="button">처음으로</button></div></section>
    <section id="evolution-confirm" hidden><p id="evolution-confirm-text"></p><div class="dialog-actions"><button id="evolution-no" class="secondary" type="button">아니오</button><button id="evolution-yes" class="primary" type="button">예</button></div></section>`;
  document.body.append(dialog);
  const $ = id => dialog.querySelector('#evolution-' + id);
  let info = null, mode = 'menu', selectedId = null, selectedType = null, selectedLevel = null, selectedAction = 'evolve', busy = false, revision = 0;

  const joined = () => typeof isJoined !== 'function' || isJoined();
  const active = version => version === revision && dialog.open && joined();
  function setBusy(value) {
    busy = value;
    for (const button of dialog.querySelectorAll('button:not(.evolution-close-allowed)')) button.disabled = value;
  }
  function summary() {
    if (!info) return '정보를 불러오는 중…';
    const avatar = info.avatar;
    if (info.teacherMode) return avatar.teacherPreview ? '선생님 미리보기: LV'+avatar.level+(avatar.level===5?' · 평소 LV4 모습, 변신 중 LV5 모습':' · 별자리와 단계를 자유롭게 선택할 수 있어요.') : '선생님 · 모든 별자리와 LV1~LV5 선택 가능';
    if (avatar.level >= PROGRESSION.transcendentLevel) return '현재 단계: LV5 · 변신 해금 · 평소 LV4 모습';
    return '현재 단계: LV' + avatar.level + ' · 경험치 ' + avatar.xp + ' / ' + info.requiredXp +
      ' · 별 파편 ' + info.starShards + '개';
  }
  function choiceButton(option, onChoose) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'constellation-choice';
    button.dataset.constellationId = option.id;
    button.style.setProperty('--constellation-color', option.color);
    // LV5는 선생님 미리보기에서도 평소 LV4 외형을 보여 줍니다.
    const previewLevel=Math.max(2,Math.min(4,info.teacherMode?selectedLevel:info.avatar.level));
    button.dataset.previewLevel=String(previewLevel);
    button.disabled = busy || !option.available || mode==='change'&&(option.current||info.starShards<info.changeCost);
    if (option.current) button.classList.add('current');
    const icon = document.createElement('span'); icon.className = 'constellation-icon';
    const sprite=option.legacy?null:constellationOf(option.id,previewLevel)?.sprite;
    if(sprite){const art=document.createElement('img');art.src=sprite;art.alt='';art.loading='lazy';icon.append(art);
      const type=document.createElement('small');type.className='constellation-art-type';type.textContent=option.type;icon.append(type);}
    else icon.textContent=option.icon;
    if(sprite){const level=document.createElement('small');level.className='constellation-preview-level';level.textContent=`LV${previewLevel}${(info.teacherMode?selectedLevel:info.avatar.level)>=5?' 평소 모습':''}`;icon.append(level);}
    const name = document.createElement('span'); name.className = 'constellation-name'; name.textContent = option.name;
    const count = document.createElement('span'); count.className = 'constellation-count';
    count.textContent = info.teacherMode?option.type+ (option.current&&selectedLevel===info.avatar.level?' · 현재':'') :
      (option.legacy?'이전 별자리':option.type)+' · '+(option.current ? '현재 · ' : '')+option.count+'/2명';
    button.append(icon, name, count);
    if (!option.available) button.title = '이미 두 친구가 선택했어요.';
    else if(mode==='change'&&info.starShards<info.changeCost)button.title='별 파편 '+info.changeCost+'개가 필요해요.';
    button.onclick = () => onChoose(option);
    return button;
  }
  function renderGrid(onChoose) {
    $('grid').replaceChildren(...info.options.map(option => choiceButton(option, onChoose)));
  }
  const constellationTypes = ['생산계', '제작계', '공격계', '수호계', '특수계'];
  function renderEvolutionTypes() {
    const container = $('types');
    container.hidden = false;
    container.className = 'evolution-types';
    container.replaceChildren();
    for (const type of constellationTypes) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'evolution-type-button';
      button.dataset.constellationType = type;
      button.textContent = type;
      button.disabled = busy;
      button.onclick = () => { selectedType = type; render(); };
      container.append(button);
    }
  }
  function render() {
    $('summary').textContent = summary();
    $('menu').hidden = mode !== 'menu';
    $('panel').hidden = !['change', 'evolve','teacher'].includes(mode);
    $('confirm').hidden = mode !== 'confirm';
    $('teacher').hidden = !info?.teacherMode;
    $('change').hidden = !!info?.teacherMode;
    $('evolve').hidden = !!info?.teacherMode;
    $('change').disabled = busy || !info || info.avatar.level === 1;
    $('evolve').disabled = busy || !info;
    if (!info) {
      if (mode === 'change' || mode === 'evolve') {
        $('panel-title').textContent = mode === 'change' ? '별자리 아바타 변경하기' : '별자리 아바타 진화하기';
        $('help').textContent = '서버 정보를 다시 불러와주세요.';
        $('grid').replaceChildren();
      }
      return;
    }
    if (mode === 'menu' && info?.avatar.level === 1) $('error').textContent = 'LV1은 별자리를 바로 변경할 수 없어요. 첫 진화를 할 때 별자리를 골라주세요.';
    if (mode === 'change') {
      $('panel-title').textContent = '별자리 아바타 변경하기';
      $('help').textContent = '변경 비용: 별 파편 '+info.changeCost+'개 · 보유 '+info.starShards+'개. 같은 교실에서 별자리마다 두 명까지 선택할 수 있어요.';
      renderGrid(option => showConfirmation(option.id,'change'));
    }
    if (mode === 'evolve') renderEvolutionChoice();
    if (mode === 'teacher') renderTeacherChoice();
  }
  function renderTeacherChoice() {
    $('panel-title').textContent = '선생님 자유 진화';
    $('help').textContent = selectedLevel===1 ? 'LV1 소행성으로 돌아갈 수 있어요.' :
      '별자리 인원 제한과 경험치 조건 없이 선택해요. 선생님 권한은 유지됩니다.';
    $('types').hidden=true; $('types').replaceChildren();
    const levels=$('levels'); levels.hidden=false;levels.className='evolution-levels';
    levels.replaceChildren(...[1,2,3,4,5].map(level=>{
      const button=document.createElement('button');button.type='button';button.textContent='LV'+level;
      button.className=selectedLevel===level?'primary':'secondary';button.dataset.level=String(level);
      button.onclick=()=>{selectedLevel=level;render();};return button;
    }));
    if(selectedLevel===1){
      const button=document.createElement('button');button.type='button';button.className='primary';
      button.textContent='LV1 소행성 선택';button.onclick=()=>showConfirmation(null);
      $('grid').replaceChildren(button);
    }else $('grid').replaceChildren(...info.options.filter(option=>!option.legacy).map(option=>choiceButton(option,chosen=>showConfirmation(chosen.id))));
  }
  function showConfirmation(id,action='evolve') {
    selectedId = id;selectedAction=action;
    const option = info.options.find(value => value.id === id);
    mode = 'confirm';
    $('confirm-text').textContent = info.teacherMode ? 'LV'+selectedLevel+' '+(option?.name||'소행성')+' 모습으로 바꾸시겠습니까?' :
      action==='change' ? (option?.name||'별자리')+'로 변경하시겠습니까? 별 파편 '+info.changeCost+'개가 사용됩니다.' :
      '정말 진화하시겠습니까?' + (option ? ' · ' + option.icon + ' ' + option.name : '');
    render();
  }
  function renderEvolutionChoice() {
    $('grid').replaceChildren();
    $('types').hidden = true;
    $('types').replaceChildren();
    $('panel-title').textContent = '별자리 아바타 진화하기';
    if (info.avatar.level >= PROGRESSION.transcendentLevel) {
      $('help').textContent = '최고 단계예요. 평소 LV4 모습이며 변신 버튼으로 LV5 모습을 사용할 수 있어요.';
      return;
    }
    if (!info.canEvolve) {
      $('help').textContent = '진화하려면 경험치가 ' + Math.max(0, info.requiredXp - info.avatar.xp) + ' 더 필요해요.';
      return;
    }
    if (info.avatar.level === 1) {
      $('help').textContent = '';
      if (!selectedType) {
        renderEvolutionTypes();
      } else {
        const back = document.createElement('button');
        back.type = 'button';
        back.id = 'evolution-types-back';
        back.className = 'secondary evolution-types-back';
        back.textContent = '계열 다시 고르기';
        back.disabled = busy;
        back.onclick = () => { selectedType = null; render(); };
        $('types').hidden = false;
        $('types').className = 'evolution-types';
        $('types').replaceChildren(back);
        const options = info.options.filter(option => option.type === selectedType);
        $('grid').replaceChildren(...options.map(option => choiceButton(option, chosen => showConfirmation(chosen.id))));
      }
      return;
    }
    const current = info.options.find(option => option.id === info.avatar.constellationId);
    $('help').textContent = current ? current.icon + ' ' + current.name + ' 계보를 유지해 한 단계 진화해요.' : '현재 별자리 계보를 확인해주세요.';
    if (current) showConfirmation(current.id);
  }
  async function load(nextMode = mode) {
    if (busy || !joined()) return;
    const version = revision;
    busy = true; mode = nextMode; $('error').textContent = ''; setBusy(true);
    try {
      const value = replyInfo(await request('evolution:info', {}));
      if (!active(version)) return;
      info = value; setBusy(false); render();
    } catch (error) {
      if (active(version)) { setBusy(false); $('error').textContent = error.message; render(); }
    }
  }
  async function change(constellationId) {
    if (busy || !info) return;
    const version = revision; busy = true; $('error').textContent = ''; setBusy(true);
    try {
      const value = replyInfo(await request('evolution:change', { constellationId }));
      if (!active(version)) return;
      info = value; selectedType = null; setBusy(false); mode = 'change'; render(); toast('별자리 아바타를 변경했어요.');
    } catch (error) {
      if (active(version)) { setBusy(false); $('error').textContent = error.message; render(); }
    }
  }
  async function evolve() {
    if (busy || !info || !selectedId) return;
    const version = revision, constellationId = selectedId; busy = true; $('error').textContent = ''; setBusy(true);
    try {
      const value = replyInfo(await request('evolution:evolve', { constellationId }));
      if (!active(version)) return;
      info = value; selectedId = null; selectedType = null; setBusy(false); mode = 'menu'; render(); toast('별자리 아바타가 한 단계 진화했어요.');
    } catch (error) {
      if (active(version)) { setBusy(false); mode = 'evolve'; selectedId = null; $('error').textContent = error.message; render(); }
    }
  }
  async function teacherSelect(){
    if(busy||!info?.teacherMode||!selectedLevel||(selectedLevel>=2&&!selectedId))return;
    const version=revision,level=selectedLevel,constellationId=selectedId;
    busy=true;$('error').textContent='';setBusy(true);
    try{
      const value=replyInfo(await request('evolution:teacher-select',{level,constellationId}));
      if(!active(version))return;
      info=value;selectedId=null;setBusy(false);mode='teacher';render();toast('선택한 별자리와 단계로 바꿨어요.');
    }catch(error){
      if(active(version)){setBusy(false);selectedId=null;mode='teacher';$('error').textContent=error.message;render();}
    }
  }

  $('header-close').onclick = $('close').onclick = () => dialog.close();
  $('change').onclick = () => load('change');
  $('evolve').onclick = () => load('evolve');
  $('teacher').onclick=()=>{selectedLevel=Math.max(1,Math.min(5,info?.avatar?.level||2));mode='teacher';render();};
  $('refresh').onclick = () => load(mode === 'change' ? 'change' : info?.teacherMode?'teacher':'evolve');
  $('back').onclick = () => { if (!busy) { mode = 'menu'; selectedId = null; selectedType = null; $('error').textContent = ''; render(); } };
  $('no').onclick = () => { if (!busy) { selectedId = null; selectedType = null; mode = info?.teacherMode?'teacher':selectedAction==='change'?'change':'menu'; render(); } };
  $('yes').onclick = () => info?.teacherMode?teacherSelect():selectedAction==='change'?change(selectedId):evolve();
  dialog.addEventListener('close', () => { if(dialog.open)return;revision++; busy = false; info = null; selectedId = null; selectedType = null; mode = 'menu'; });

  return {
    open() {
      if (!joined()) return;
      stop(); revision++; busy = false; info = null; selectedId = null; selectedType = null; mode = 'menu';
      $('error').textContent = ''; $('summary').textContent = '정보를 불러오는 중…';
      if (!dialog.open) dialog.showModal();
      load('menu');
    },
    reset() { revision++; busy = false; info = null; selectedId = null; selectedType = null; if (dialog.open) dialog.close(); }
  };
}
