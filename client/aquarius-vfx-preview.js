/* Standalone asset preview: no connection to game state or server. */
(() => {
  'use strict';
  const assets = [
    ['attack', '물방울 공격', 0.5],
    ['skill-lv2', 'LV2 · 샘솟는 물병', 0.75],
    ['skill-lv3', 'LV3 · 거대한 샘물', 0.75],
    ['skill-lv4', 'LV4 · 천공의 물결', 0.75],
  ];
  const base = 'assets/skills/aquarius/';
  const play = document.getElementById('play');
  const scrub = document.getElementById('scrub');
  const status = document.getElementById('status');
  const guides = document.getElementById('guides');
  const loopOnly = document.getElementById('loopOnly');
  let running = true;
  let elapsed = 0;
  let previous = performance.now();
  function frameAt(ms) {
    if (ms < 500) return Math.min(5, Math.floor(ms * 6 / 500));
    if (ms < 4500) return 6 + Math.floor(((ms - 500) % 1000) * 12 / 1000);
    return Math.min(23, 18 + Math.floor((ms - 4500) * 6 / 500));
  }
  const views = assets.map(([kind, label, ay]) => {
    const figure = document.createElement('figure');
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 256;
    canvas.dataset.kind = kind;
    canvas.setAttribute('aria-label', label + ' 프레임 재생');
    const caption = document.createElement('figcaption');
    caption.textContent = label;
    figure.append(canvas, caption);
    document.getElementById('sheets').append(figure);
    const apngFigure = document.createElement('figure');
    const apng = new Image(256, 256);
    apng.className = 'apng';
    apng.alt = label + ' 5초 APNG';
    apng.dataset.kind = kind;
    apng.src = base + kind + '-preview.png';
    apngFigure.append(apng, caption.cloneNode(true));
    document.getElementById('apngs').append(apngFigure);
    const sheet = new Image();
    sheet.src = base + kind + '.png';
    sheet.onerror = () => { status.textContent = kind + ' 이미지를 불러오지 못했습니다'; };
    return { canvas, context: canvas.getContext('2d'), sheet, ay };
  });
  function draw() {
    const ms = loopOnly.checked ? 500 + (elapsed % 1000) : elapsed % 5000;
    const frame = frameAt(ms);
    for (const {canvas, context, sheet, ay} of views) {
      context.clearRect(0, 0, 256, 256);
      if (sheet.complete && sheet.naturalWidth) {
        context.drawImage(sheet, (frame % 6) * 256, Math.floor(frame / 6) * 256,
                          256, 256, 0, 0, 256, 256);
      }
      if (guides.checked) {
        context.strokeStyle = '#ff638d';
        context.lineWidth = 1;
        context.beginPath();
        context.moveTo(119, ay * 256 + 0.5); context.lineTo(137, ay * 256 + 0.5);
        context.moveTo(128.5, ay * 256 - 9); context.lineTo(128.5, ay * 256 + 9);
        context.stroke();
      }
      canvas.dataset.frame = String(frame);
    }
    scrub.value = String(Math.floor(ms));
    status.textContent = `${(ms / 1000).toFixed(2)}초 · ${frame + 1}/24`;
    document.body.dataset.frame = String(frame);
  }
  play.addEventListener('click', () => {
    running = !running;
    play.textContent = running ? '일시정지' : '재생';
  });
  scrub.addEventListener('input', () => {
    running = false;
    loopOnly.checked = false;
    play.textContent = '재생';
    elapsed = Number(scrub.value);
    draw();
  });
  document.getElementById('background').addEventListener('change', event => {
    document.documentElement.style.setProperty('--stage', event.target.value);
  });
  function tick(now) {
    if (running) elapsed += Math.min(now - previous, 200);
    previous = now;
    draw();
    requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
})();
