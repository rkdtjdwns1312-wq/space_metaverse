// Procedural audio only: no downloaded samples, external services, or licensed assets.
const STORAGE_KEY = 'space-classroom-audio-v1';
const MAP_THEMES = {
  plaza: { notes: [60, 64, 67, 71, 67, 64, 62, 65, 69, 72, 69, 65], bass: [36, 43, 40, 35] },
  street: { notes: [62, 65, 69, 74, 72, 69, 65, 67, 71, 74, 71, 67], bass: [38, 45, 41, 36] },
  planet: { notes: [57, 60, 64, 69, 67, 64, 60, 62, 65, 69, 72, 69], bass: [33, 40, 36, 31] },
  temple: { notes: [55, 59, 62, 67, 65, 62, 59, 60, 64, 67, 71, 67], bass: [31, 38, 35, 30] },
  blackhole: { notes: [53, 57, 60, 65, 64, 60, 57, 55, 59, 62, 67, 62], bass: [29, 36, 33, 28] },
  default: { notes: [60, 64, 67, 72, 69, 67, 64, 62, 65, 69, 74, 69], bass: [36, 43, 40, 35] }
};
const clamp = (n, min, max) => Math.min(max, Math.max(min, Number(n) || 0));
/** Create a self-contained game audio controller. Call resume() from a user gesture to unlock playback. */
export function createAudio({ storage = globalThis.localStorage, contextFactory } = {}) {
  let settings;
  try {
    const saved = JSON.parse(storage?.getItem(STORAGE_KEY) || '{}');
    settings = { muted: Boolean(saved.muted), volume: clamp(saved.volume ?? 0.35, 0, 1) };
  } catch { settings = { muted: false, volume: 0.35 }; }
  const AudioContextClass = globalThis.AudioContext || globalThis.webkitAudioContext;
  let context = null, master = null, timer = null, theme = MAP_THEMES.default, step = 0, currentMap='';
  let started = false;

  function ensureContext() {
    if (context) return context;
    try {
      context = contextFactory ? contextFactory() : AudioContextClass ? new AudioContextClass() : null;
      if (!context) return null;
      master = context.createGain(); master.gain.value = settings.muted ? 0 : settings.volume; master.connect(context.destination);
      return context;
    } catch { context = null; return null; }
  }
  function persist() {
    try { storage?.setItem(STORAGE_KEY, JSON.stringify(settings)); } catch { /* Private browsing may deny storage. */ }
  }
  function tone(midi, duration = 0.28, { wave = 'sine', gain = 0.12, delay = 0, detune = 0 } = {}) {
    const ctx = ensureContext(); if (!ctx || !master) return;
    const at = ctx.currentTime + delay, osc = ctx.createOscillator(), amp = ctx.createGain();
    osc.type = wave; osc.frequency.setValueAtTime(440 * 2 ** ((midi - 69) / 12), at); osc.detune.value = detune;
    amp.gain.setValueAtTime(0.0001, at); amp.gain.exponentialRampToValueAtTime(Math.max(0.0002, gain), at + 0.025);
    amp.gain.exponentialRampToValueAtTime(0.0001, at + duration);
    osc.connect(amp); amp.connect(master); osc.start(at); osc.stop(at + duration + 0.03);
  }
  function scheduleStep() {
    if (!started || !context || context.state !== 'running') return;
    const i = step++ % theme.notes.length;
    tone(theme.notes[i], 0.42, { wave: 'triangle', gain: 0.045 });
    tone(theme.notes[i]+12, 0.19, { wave: 'sine', gain: 0.025, delay: .004 });
    if (i % 3 === 0) tone(theme.notes[i] - 12, 0.62, { wave: 'triangle', gain: 0.03, delay: 0.015 });
    if (i % 4 === 0) tone(theme.bass[(i / 3 | 0) % theme.bass.length], 0.78, { wave: 'sine', gain: 0.055 });
  }
  async function resume() {
    const ctx = ensureContext(); if (!ctx) return false;
    try { if (ctx.state !== 'running') await ctx.resume(); return ctx.state === 'running'; } catch { return false; }
  }
  async function playBgm(mapId = 'default') {
    const id = String(mapId || 'default').toLowerCase();
    if(currentMap!==id){
      const base=MAP_THEMES[id] || (id.includes('street') ? MAP_THEMES.street : id.includes('plaza') ? MAP_THEMES.plaza : id.includes('black') ? MAP_THEMES.blackhole : id.includes('temple')||id.includes('valley') ? MAP_THEMES.temple : id.includes('planet') ? MAP_THEMES.planet : MAP_THEMES.default);
      const hash=[...id].reduce((value,char)=>(value*31+char.charCodeAt(0))>>>0,17);
      // 각 맵은 같은 조성 안에서 고유한 음 순서와 음역을 갖습니다.
      const rotate=hash%base.notes.length,octave=(hash%3)-1;
      theme={notes:base.notes.map((_,i)=>base.notes[(i+rotate)%base.notes.length]+octave*2),bass:base.bass};
      currentMap=id;step=0;
    }
    if (!started) { started = true; step = 0; timer = setInterval(scheduleStep, 520); }
    await resume(); if(step===0)scheduleStep();
    return true;
  }
  function stopBgm() { started = false; if (timer !== null) clearInterval(timer); timer = null; }
  function setMuted(muted) { settings.muted = Boolean(muted); persist(); if (master) master.gain.setTargetAtTime(settings.muted ? 0 : settings.volume, context.currentTime, 0.025); }
  function setVolume(volume) { settings.volume = clamp(volume, 0, 1); persist(); if (master && !settings.muted) master.gain.setTargetAtTime(settings.volume, context.currentTime, 0.025); }
  function playSfx(name, detail = {}) {
    const type = String(name || 'ui').toLowerCase();
    const sfx = {
      q: [[64, 0], [72, 0.07]], e: [[69, 0], [76, 0.09], [81, 0.18]],
      attack: [[48, 0], [55, 0.055]], monster: [[45, 0], [40, 0.08], [36, 0.16]],
      buy: [[67, 0], [72, 0.08], [76, 0.16]], sell: [[76, 0], [72, 0.08], [67, 0.16]],
      arcade: [[72, 0], [79, 0.065]], arcadeMatch: [[67, 0], [74, 0.07], [79, 0.14]],
      arcadeWin: [[60, 0], [64, 0.08], [67, 0.16], [72, 0.24]], arcadeLose: [[60, 0], [57, 0.12], [53, 0.24]],
      ui: [[72, 0]], confirm: [[72, 0], [79, 0.07]], error: [[55, 0], [52, 0.1]]
    };
    let key = type;
    if (type === 'constellation' || type === 'skill') key = String(detail.key || detail.slot || 'q').toLowerCase() === 'e' ? 'e' : 'q';
    if (type === 'monster-attack' || type === 'monster_attack') key = 'monster';
    if (type === 'shop-buy' || type === 'shop_buy') key = 'buy';
    if (type === 'shop-sell' || type === 'shop_sell') key = 'sell';
    if (type.startsWith('arcade')) key = detail.result === 'win' ? 'arcadeWin' : detail.result === 'lose' ? 'arcadeLose' : type.includes('match') ? 'arcadeMatch' : 'arcade';
    const notes = sfx[key] || (type === 'ui-error' ? sfx.error : type === 'ui-confirm' ? sfx.confirm : sfx.ui);
    const identity=String(detail.constellationId||detail.monsterId||detail.gameId||'');
    const variation=[...identity].reduce((value,char)=>value+char.charCodeAt(0),0)%7-3;
    const gameVariation=detail.gameId==='memory'?2:detail.gameId==='baseball'?-2:detail.gameId==='stars'?5:detail.gameId==='sudoku'?0:detail.gameId==='dodge'?-4:0;
    const wave = key === 'monster' || key === 'attack' ? 'triangle' : 'sine';
    for (const [note, delay] of notes) tone(note+variation+gameVariation, 0.19, { wave, gain: 0.07, delay });
  }
  function dispose() { stopBgm(); if (context) { try { context.close(); } catch { /* Best effort cleanup. */ } } context = master = null; }
  return { resume, playBgm, stopBgm, playSfx, setMuted, setVolume, dispose,
    get muted() { return settings.muted; }, get volume() { return settings.volume; } };
}
