import {PROGRESSION} from '/shared/config.js';
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
    <p class="temporary-art-note">별자리 그림과 성격을 보고 아바타를 골라요. 선택한 그림으로 진화해요.</p>
    <p id="evolution-summary"></p><p id="evolution-error" role="alert"></p>
    <section id="evolution-menu"><button id="evolution-change" class="primary" type="button">별자리 아바타 변경하기</button><button id="evolution-evolve" class="primary" type="button">별자리 아바타 진화하기</button><button id="evolution-close" class="secondary evolution-close-allowed" type="button">닫기</button></section>
    <section id="evolution-panel" hidden><h3 id="evolution-panel-title"></h3><p id="evolution-help"></p><div id="evolution-grid" class="constellation-grid"></div><div class="dialog-actions"><button id="evolution-refresh" class="secondary" type="button">새로고침</button><button id="evolution-back" class="secondary" type="button">처음으로</button></div></section>
    <section id="evolution-confirm" hidden><p id="evolution-confirm-text"></p><div class="dialog-actions"><button id="evolution-no" class="secondary" type="button">아니오</button><button id="evolution-yes" class="primary" type="button">예</button></div></section>`;
  document.body.append(dialog);
  const $ = id => dialog.querySelector('#evolution-' + id);
  let info = null, mode = 'menu', selectedId = null, busy = false, revision = 0;

  const joined = () => typeof isJoined !== 'function' || isJoined();
  const active = version => version === revision && dialog.open && joined();
  function setBusy(value) {
    busy = value;
    for (const button of dialog.querySelectorAll('button:not(.evolution-close-allowed)')) button.disabled = value;
  }
  function summary() {
    if (!info) return '정보를 불러오는 중…';
    const avatar = info.avatar;
    if (avatar.level >= PROGRESSION.transcendentLevel) return '현재 단계: LV5 초월체 · 경험치 최고 단계';
    return '현재 단계: LV' + avatar.level + ' · 경험치 ' + avatar.xp + ' / ' + info.requiredXp;
  }
  function choiceButton(option, onChoose) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'constellation-choice';
    button.dataset.constellationId = option.id;
    button.style.setProperty('--constellation-color', option.color);
    button.disabled = busy || !option.available;
    if (option.current) button.classList.add('current');
    const icon = document.createElement('span'); icon.className = 'constellation-icon';
    if(option.art){const art=document.createElement('img');art.src=option.art;art.alt='';art.loading='lazy';icon.append(art);
      const type=document.createElement('small');type.className='constellation-art-type';type.textContent=option.type;icon.append(type);}
    else icon.textContent=option.icon;
    const name = document.createElement('span'); name.className = 'constellation-name'; name.textContent = option.name;
    const count = document.createElement('span'); count.className = 'constellation-count';
    count.textContent = (option.legacy?'이전 별자리':option.type)+' · '+(option.current ? '현재 · ' : '')+option.count+'/2명';
    button.append(icon, name, count);
    if (!option.available) button.title = '이미 두 친구가 선택했어요.';
    button.onclick = () => onChoose(option);
    return button;
  }
  function renderGrid(onChoose) {
    $('grid').replaceChildren(...info.options.map(option => choiceButton(option, onChoose)));
  }
  function render() {
    $('summary').textContent = summary();
    $('menu').hidden = mode !== 'menu';
    $('panel').hidden = !['change', 'evolve'].includes(mode);
    $('confirm').hidden = mode !== 'confirm';
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
      $('help').textContent = '같은 교실에서 별자리마다 LV2 이상 친구 두 명까지 선택할 수 있어요.';
      renderGrid(option => change(option.id));
    }
    if (mode === 'evolve') renderEvolutionChoice();
  }
  function showConfirmation(id) {
    selectedId = id;
    const option = info.options.find(value => value.id === id);
    mode = 'confirm';
    $('confirm-text').textContent = '정말 진화하시겠습니까?' + (option ? ' · ' + option.icon + ' ' + option.name : '');
    render();
  }
  function renderEvolutionChoice() {
    $('grid').replaceChildren();
    $('panel-title').textContent = '별자리 아바타 진화하기';
    if (info.avatar.level >= PROGRESSION.transcendentLevel) {
      $('help').textContent = '이미 최고 단계인 초월체예요.';
      return;
    }
    if (!info.canEvolve) {
      $('help').textContent = '진화하려면 경험치가 ' + Math.max(0, info.requiredXp - info.avatar.xp) + ' 더 필요해요.';
      return;
    }
    if (info.avatar.level === 1) {
      $('help').textContent = '첫 진화에 사용할 별자리 계보를 골라주세요.';
      renderGrid(option => showConfirmation(option.id));
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
      info = value; setBusy(false); mode = 'change'; render(); toast('별자리 아바타를 변경했어요.');
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
      info = value; selectedId = null; setBusy(false); mode = 'menu'; render(); toast('별자리 아바타가 한 단계 진화했어요.');
    } catch (error) {
      if (active(version)) { setBusy(false); mode = 'evolve'; selectedId = null; $('error').textContent = error.message; render(); }
    }
  }

  $('header-close').onclick = $('close').onclick = () => dialog.close();
  $('change').onclick = () => load('change');
  $('evolve').onclick = () => load('evolve');
  $('refresh').onclick = () => load(mode === 'change' ? 'change' : 'evolve');
  $('back').onclick = () => { if (!busy) { mode = 'menu'; selectedId = null; $('error').textContent = ''; render(); } };
  $('no').onclick = () => { if (!busy) { selectedId = null; mode = 'menu'; render(); } };
  $('yes').onclick = evolve;
  dialog.addEventListener('close', () => { revision++; busy = false; info = null; selectedId = null; mode = 'menu'; });

  return {
    open() {
      if (!joined()) return;
      stop(); revision++; busy = false; info = null; selectedId = null; mode = 'menu';
      $('error').textContent = ''; $('summary').textContent = '정보를 불러오는 중…';
      if (!dialog.open) dialog.showModal();
      load('menu');
    },
    reset() { revision++; busy = false; info = null; selectedId = null; if (dialog.open) dialog.close(); }
  };
}
