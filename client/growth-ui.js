function replyInfo(value) {
  return value?.info && typeof value.info === 'object' ? value.info : value;
}

function ensureStylesheet() {
  if (document.querySelector('link[data-star-ui-style]')) return;
  const link = document.createElement('link');
  link.rel = 'stylesheet'; link.href = '/evolution.css'; link.dataset.starUiStyle = '';
  document.head.append(link);
}

export function createGrowthUI({ request, stop, toast, isJoined }) {
  ensureStylesheet();
  const dialog = document.createElement('dialog');
  dialog.id = 'growth-dialog';
  dialog.className = 'star-dialog growth-dialog';
  dialog.setAttribute('aria-labelledby', 'growth-title');
  dialog.innerHTML = `<header><h2 id="growth-title">성장의 별</h2><button id="growth-header-close" class="secondary growth-close-allowed" type="button">닫기</button></header>
    <p>별 파편 1개로 경험치 1을 살 수 있어요. 경험치가 가득 차도 자동으로 진화하지 않아요.</p>
    <div id="growth-info" class="growth-info"></div><p id="growth-error" role="alert"></p>
    <label for="growth-amount">구매할 경험치</label><input id="growth-amount" type="number" min="1" step="1" inputmode="numeric">
    <div class="dialog-actions"><button id="growth-max" class="secondary" type="button">최대 구매</button><button id="growth-buy" class="primary" type="button">구매</button><button id="growth-close" class="secondary growth-close-allowed" type="button">닫기</button></div>`;
  document.body.append(dialog);
  const $ = id => dialog.querySelector('#growth-' + id);
  let info = null, busy = false, revision = 0;
  const joined = () => typeof isJoined !== 'function' || isJoined();
  const active = version => version === revision && dialog.open && joined();

  function clamp() {
    if (!info || info.maxBuy < 1) { $('amount').value = ''; return; }
    const raw = Number($('amount').value);
    const amount = Number.isFinite(raw) ? Math.trunc(raw) : 1;
    $('amount').value = String(Math.max(1, Math.min(info.maxBuy, amount)));
  }
  function render() {
    if (!info) return;
    const top = info.avatar.level >= 6;
    $('info').replaceChildren();
    const rows = [
      ['현재 단계', top ? '초월체' : 'LV' + info.avatar.level],
      ['현재 경험치', top ? '최고 단계' : info.avatar.xp + ' / ' + info.requiredXp],
      ['별 파편 잔액', info.starShards + '개'],
      ['구매 가능', info.maxBuy + ' XP']
    ];
    for (const [label, value] of rows) {
      const row = document.createElement('p'), strong = document.createElement('strong'), span = document.createElement('span');
      strong.textContent = label; span.textContent = value; row.append(strong, span); $('info').append(row);
    }
    $('amount').max = String(info.maxBuy);
    const disabled = busy || !info.canBuy || info.maxBuy < 1;
    $('amount').disabled = $('max').disabled = $('buy').disabled = disabled;
    if (disabled) $('amount').value = '';
    else { if (!$('amount').value) $('amount').value = '1'; clamp(); }
    if (!busy && info.maxBuy === 0 && !top) {
      $('error').textContent = info.remainingXp === 0 ? '현재 단계의 경험치를 모두 채웠어요. 진화의 별로 가주세요.' : '별 파편이 부족해요.';
    } else if (!busy && top) $('error').textContent = '초월체는 경험치를 더 살 수 없어요.';
  }
  function setBusy(value) {
    busy = value;
    $('amount').disabled = $('max').disabled = $('buy').disabled = value || !info?.canBuy;
  }
  async function load() {
    if (busy || !joined()) return;
    const version = revision; setBusy(true); $('error').textContent = '';
    try {
      const value = replyInfo(await request('growth:info', {}));
      if (!active(version)) return;
      info = value; busy = false; render();
    } catch (error) {
      if (active(version)) { busy = false; $('error').textContent = error.message; }
    }
  }
  async function buy() {
    if (busy || !info?.canBuy) return;
    clamp(); const amount = Number($('amount').value), version = revision;
    setBusy(true); $('error').textContent = '';
    try {
      const value = replyInfo(await request('growth:buy', { amount }));
      if (!active(version)) return;
      info = value; busy = false; $('amount').value = ''; render(); toast('경험치 ' + amount + '을 구매했어요.');
    } catch (error) {
      if (active(version)) { busy = false; $('error').textContent = error.message; render(); }
    }
  }

  $('amount').oninput = clamp;
  $('max').onclick = () => { if (info?.maxBuy) $('amount').value = String(info.maxBuy); };
  $('buy').onclick = buy;
  $('header-close').onclick = $('close').onclick = () => dialog.close();
  dialog.addEventListener('close', () => { revision++; busy = false; info = null; });
  return {
    open() {
      if (!joined()) return;
      stop(); revision++; busy = false; info = null; $('error').textContent = ''; $('info').textContent = '정보를 불러오는 중…'; $('amount').value = '';
      if (!dialog.open) dialog.showModal();
      load();
    },
    reset() { revision++; busy = false; info = null; if (dialog.open) dialog.close(); }
  };
}
