function ensureStylesheet() {
  if (document.querySelector('link[data-vitals-ui-style]')) return;
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = '/vitals.css';
  link.dataset.vitalsUiStyle = 'true';
  document.head.append(link);
}

function readVital(value) {
  if (!value || !Number.isFinite(value.current) || !Number.isFinite(value.max) || value.max <= 0) {
    return null;
  }
  return { current: Math.min(Math.max(value.current, 0), value.max), max: value.max };
}

function readVitals(vitals) {
  if (!vitals || typeof vitals !== 'object') return null;
  const hp = readVital(vitals.hp);
  const mp = readVital(vitals.mp);
  return hp && mp ? { hp, mp } : null;
}

export function createVitalsUI(dock) {
  ensureStylesheet();

  const hud = document.createElement('section');
  hud.id = 'vitals-hud';
  hud.className = 'vitals-hud';
  hud.hidden = true;
  hud.setAttribute('aria-label', '체력과 마나');

  const bars = {};
  for (const [key, name] of [['hp', 'HP'], ['mp', 'MP']]) {
    const item = document.createElement('div');
    item.className = `vitals-item vitals-${key}`;

    const label = document.createElement('div');
    label.className = 'vitals-label';
    label.setAttribute('aria-live', 'polite');

    const progress = document.createElement('progress');
    progress.className = 'vitals-bar';
    progress.max = 1;
    progress.value = 0;
    progress.disabled = true;
    progress.setAttribute('aria-label', `${name}가 설정되지 않았습니다`);

    item.append(label, progress);
    hud.append(item);
    bars[key] = { label, progress, name };
  }
  dock.append(hud);

  function reset() {
    hud.hidden = true;
  }

  function update(vitals) {
    const next = readVitals(vitals);
    if (!next) {
      for (const bar of Object.values(bars)) {
        bar.label.textContent = `${bar.name}: 설정 예정`;
        bar.progress.value = 0;
        bar.progress.disabled = true;
        bar.progress.setAttribute('aria-label', `${bar.name}가 설정되지 않았습니다`);
      }
      hud.hidden = false;
      return;
    }
    for (const key of Object.keys(bars)) {
      const bar = bars[key];
      const value = next[key];
      bar.label.textContent = `${bar.name} ${value.current}/${value.max}`;
      bar.progress.max = value.max;
      bar.progress.value = value.current;
      bar.progress.disabled = false;
      bar.progress.setAttribute('aria-label', `${bar.name} ${value.current}/${value.max}`);
    }
    hud.hidden = false;
  }

  return { update, reset };
}
