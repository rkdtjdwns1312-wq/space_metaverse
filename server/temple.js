const KST = 9 * 60 * 60 * 1000;
const DATE = /^\d{4}-\d{2}-\d{2}$/;

export function koreaDay(now = Date.now()) {
  return new Date(now + KST).toISOString().slice(0, 10);
}

export function weekStart(now = Date.now()) {
  const d = new Date(now + KST);
  const day = d.getUTCDay();
  d.setUTCDate(d.getUTCDate() - (day === 0 ? 6 : day - 1));
  return d.toISOString().slice(0, 10);
}

const emptyTemple = () => ({ notices: [], timetables: [], weeks: [] });
const fail = message => { throw new Error(`Invalid temple: ${message}`); };
const validDate = (v, label) => {
  if (typeof v !== 'string' || !DATE.test(v)) fail(`${label}.date`);
  const d = new Date(`${v}T00:00:00Z`);
  if (Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== v) fail(`${label}.date`);
};
const validText = (v, label) => { if (typeof v !== 'string' || v.length > 2000) fail(`${label}.text`); };

export function validateTemple(value) {
  if (value === undefined) return emptyTemple();
  if (!value || typeof value !== 'object' || Array.isArray(value)) fail('root');
  for (const key of ['notices', 'timetables', 'weeks']) if (!Array.isArray(value[key])) fail(key);
  if (value.notices.length > 30 || value.timetables.length > 30 || value.weeks.length > 8) fail('array length');
  const out = { notices: [], timetables: [], weeks: [] };
  for (const kind of ['notices', 'timetables']) {
    const seen = new Set();
    out[kind] = value[kind].map((entry, i) => {
      if (!entry || typeof entry !== 'object' || Array.isArray(entry)) fail(`${kind}[${i}]`);
      validDate(entry.date, `${kind}[${i}]`); validText(entry.text, `${kind}[${i}]`);
      if (seen.has(entry.date)) fail(`duplicate ${kind} date`); seen.add(entry.date);
      return { date: entry.date, text: entry.text };
    });
  }
  const weeks = new Set();
  out.weeks = value.weeks.map((entry, i) => {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry) || typeof entry.week !== 'string' || !Array.isArray(entry.totals)) fail(`weeks[${i}]`);
    validDate(entry.week, `weeks[${i}]`);
    if (weekStart(Date.parse(`${entry.week}T00:00:00Z`)) !== entry.week || weeks.has(entry.week)) fail(`duplicate/invalid week ${entry.week}`);
    weeks.add(entry.week); if (entry.totals.length > 29) fail('totals length');
    const ids = new Set();
    const totals = entry.totals.map((row, j) => {
      if (!row || typeof row.playerId !== 'string' || !Number.isSafeInteger(row.total) || row.total < 0 || ids.has(row.playerId)) fail(`weeks[${i}].totals[${j}]`);
      ids.add(row.playerId); return { playerId: row.playerId, total: row.total };
    });
    return { week: entry.week, totals };
  });
  return structuredClone(out);
}

function templeOf(room) { const current = validateTemple(room.temple); room.temple = current; return current; }
export function saveDaily(room, kind, text, now = Date.now()) {
  if (kind !== 'notice' && kind !== 'timetable') throw new Error('kind must be notice or timetable');
  if (typeof text !== 'string' || text.length > 2000) throw new Error('text must be a string of at most 2000 characters');
  const date = koreaDay(now), value = text.replace(/\r\n?/g, '\n').trim();
  const list = templeOf(room)[kind === 'notice' ? 'notices' : 'timetables'];
  const index = list.findIndex(item => item.date === date);
  const item = { date, text: value }; if (index < 0) list.push(item); else list[index] = item;
  list.sort((a, b) => b.date.localeCompare(a.date)); list.splice(30);
  return { date, text: value };
}
export function readDaily(room, kind, now = Date.now()) {
  if (kind !== 'notice' && kind !== 'timetable') throw new Error('kind must be notice or timetable');
  const item = templeOf(room)[kind === 'notice' ? 'notices' : 'timetables'].find(v => v.date === koreaDay(now));
  return item ? { ...item } : { date: koreaDay(now), text: '' };
}
export function recordReward(room, playerId, amount, now = Date.now()) {
  if (typeof playerId !== 'string' || !playerId || !Number.isSafeInteger(amount)) throw new Error('invalid reward');
  if (amount <= 0) return;
  const temple = templeOf(room), week = weekStart(now); let row = temple.weeks.find(v => v.week === week);
  if (!row) { row = { week, totals: [] }; temple.weeks.unshift(row); }
  let total = row.totals.find(v => v.playerId === playerId);
  if (!total) { if (row.totals.length >= 29) throw new Error('too many reward players'); total = { playerId, total: 0 }; row.totals.push(total); }
  if (total.total > Number.MAX_SAFE_INTEGER - amount) throw new Error('reward total overflow');
  total.total += amount; temple.weeks.sort((a, b) => b.week.localeCompare(a.week)); temple.weeks.splice(8);
}
function playerEntries(players) { return players instanceof Map ? [...players.values()] : Array.isArray(players) ? players : Object.values(players || {}); }
export function weeklyRewards(room, now = Date.now()) {
  const week = weekStart(now), totals = new Map((templeOf(room).weeks.find(v => v.week === week)?.totals || []).map(v => [v.playerId, v.total]));
  const rows = playerEntries(room.players).filter(p => p && p.role !== 'teacher').map(p => ({ playerId: p.id, nickname: String(p.nickname ?? ''), total: totals.get(p.id) || 0 }));
  rows.sort((a, b) => a.nickname.localeCompare(b.nickname, 'ko', { numeric: true, sensitivity: 'base' }) || a.playerId.localeCompare(b.playerId));
  return { week, rows };
}
