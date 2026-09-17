import {randomUUID} from 'node:crypto';
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

export const TIMETABLE = Object.freeze({days:['월','화','수','목','금'],periods:6,maxSubjectLength:20});
const emptySchedule=()=>Array.from({length:TIMETABLE.periods},()=>Array(TIMETABLE.days.length).fill(''));
const emptyTemple = () => ({ notices: [], timetables: [], weeks: [], schedule:emptySchedule(), assignments:[] });
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
  const out = { notices: [], timetables: [], weeks: [], schedule:validateSchedule(value.schedule??emptySchedule()), assignments:[] };
  for (const kind of ['notices', 'timetables']) {
    const seen = new Set();
    out[kind] = value[kind].map((entry, i) => {
      if (!entry || typeof entry !== 'object' || Array.isArray(entry)) fail(`${kind}[${i}]`);
      validDate(entry.date, `${kind}[${i}]`); validText(entry.text, `${kind}[${i}]`);
      if (seen.has(entry.date)) fail(`duplicate ${kind} date`); seen.add(entry.date);
      const taskLines=kind==='notices'?(entry.taskLines??[]):[];
      if(!Array.isArray(taskLines)||taskLines.some(line=>!line||!Number.isInteger(line.lineIndex)||line.lineIndex<0||typeof line.assignmentId!=='string')||
        new Set(taskLines.map(line=>line.lineIndex)).size!==taskLines.length)fail(`${kind}[${i}].taskLines`);
      return kind==='notices'?{date:entry.date,text:entry.text,taskLines:structuredClone(taskLines)}:{date:entry.date,text:entry.text};
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
  const assignments=value.assignments??[];
  if(!Array.isArray(assignments)||assignments.length>1000)fail('assignments');
  const assignmentIds=new Set();
  out.assignments=assignments.map((entry,i)=>{
    if(!entry||typeof entry.id!=='string'||!entry.id||assignmentIds.has(entry.id)||typeof entry.text!=='string'||!entry.text.trim()||entry.text.length>2000||
      !Number.isInteger(entry.lineIndex)||entry.lineIndex<0||entry.lineIndex>2000||!Number.isSafeInteger(entry.at)||entry.at<0||
      !Array.isArray(entry.completedIds)||entry.completedIds.length>29||entry.completedIds.some(id=>typeof id!=='string')||
      new Set(entry.completedIds).size!==entry.completedIds.length)fail(`assignments[${i}]`);
    validDate(entry.sourceDate,`assignments[${i}].sourceDate`);validDate(entry.week,`assignments[${i}].week`);
    if(weekStart(Date.parse(`${entry.sourceDate}T00:00:00Z`))!==entry.week)fail(`assignments[${i}].week`);
    assignmentIds.add(entry.id);return structuredClone(entry);
  });
  if(out.notices.some(notice=>notice.taskLines.some(line=>!assignmentIds.has(line.assignmentId))))fail('notice assignment reference');
  return structuredClone(out);
}

function templeOf(room) { const current = validateTemple(room.temple); room.temple = current; return current; }
export function validateSchedule(cells){
  if(!Array.isArray(cells)||cells.length!==TIMETABLE.periods||cells.some(row=>
    !Array.isArray(row)||row.length!==TIMETABLE.days.length||row.some(cell=>typeof cell!=='string'||cell.length>TIMETABLE.maxSubjectLength||[...cell].some(ch=>{const c=ch.codePointAt(0);return c<32||c===127;}))))
    fail('schedule');
  const normalized=cells.map(row=>row.map(cell=>cell.normalize('NFKC').trim()));
  if(normalized.some(row=>row.some(cell=>cell.length>TIMETABLE.maxSubjectLength)))fail('schedule');
  return normalized;
}
export function readTimetable(room){return {cells:structuredClone(templeOf(room).schedule)};}
export function saveTimetable(room,cells){
  const schedule=validateSchedule(cells),temple=templeOf(room);temple.schedule=schedule;
  return {cells:structuredClone(schedule)};
}
function pruneAssignments(room,temple,now){
  const oldest=new Date(Date.parse(weekStart(now)+'T00:00:00Z')-14*86400000).toISOString().slice(0,10);
  const players=room.players instanceof Map?[...room.players.values()]:Array.isArray(room.players)?room.players:[];
  const needed=new Set(players.flatMap(player=>(player.tasks||[]).map(task=>task.assignmentId)));
  temple.assignments=temple.assignments.filter(assignment=>assignment.week>=oldest||needed.has(assignment.id));
  const kept=new Set(temple.assignments.map(assignment=>assignment.id));
  for(const notice of temple.notices)notice.taskLines=notice.taskLines.filter(line=>kept.has(line.assignmentId));
}
export function saveNotice(room,text,taskLineIndexes=[],now=Date.now()){
  if(typeof text!=='string'||text.length>2000)fail('notice text');
  const value=text.replace(/\r\n?/g,'\n').trim(),lines=value.split('\n');
  if(!Array.isArray(taskLineIndexes)||taskLineIndexes.some(index=>!Number.isInteger(index)||index<0||index>=lines.length||!lines[index].trim())||
    new Set(taskLineIndexes).size!==taskLineIndexes.length)fail('notice task lines');
  const temple=templeOf(room),date=koreaDay(now),week=weekStart(now),taskLines=[];
  pruneAssignments(room,temple,now);
  for(const lineIndex of taskLineIndexes){
    const subject=lines[lineIndex].trim();
    let assignment=temple.assignments.find(a=>a.sourceDate===date&&a.lineIndex===lineIndex&&a.text===subject);
    if(!assignment){
      if(temple.assignments.length>=1000)fail('assignments full');
      assignment={id:randomUUID(),sourceDate:date,week,lineIndex,text:subject,at:now,completedIds:[]};
      temple.assignments.push(assignment);
    }
    taskLines.push({lineIndex,assignmentId:assignment.id});
  }
  taskLines.sort((a,b)=>a.lineIndex-b.lineIndex);
  const index=temple.notices.findIndex(item=>item.date===date),item={date,text:value,taskLines};
  if(index<0)temple.notices.push(item);else temple.notices[index]=item;
  temple.notices.sort((a,b)=>b.date.localeCompare(a.date));temple.notices.splice(30);
  return structuredClone(item);
}
export function assignmentById(room,id){return templeOf(room).assignments.find(a=>a.id===id)||null;}
export function markAssignmentDone(room,id,studentId){
  const temple=templeOf(room),assignment=temple.assignments.find(a=>a.id===id);
  if(!assignment)fail('assignment not found');
  if(!assignment.completedIds.includes(studentId))assignment.completedIds.push(studentId);
}
export function recentAssignments(room,now=Date.now()){
  const temple=templeOf(room),first=weekStart(now),weeks=Array.from({length:3},(_,i)=>new Date(Date.parse(first+'T00:00:00Z')-i*7*86400000).toISOString().slice(0,10));
  return {weeks:weeks.map((week,index)=>({week,label:index===0?'이번 주':index===1?'지난주':'2주 전',
    assignments:temple.assignments.filter(a=>a.week===week).map(a=>({id:a.id,text:a.text,sourceDate:a.sourceDate,
      completed:[...room.players.values()].filter(p=>a.completedIds.includes(p.id)).map(p=>p.nickname).sort((a,b)=>a.localeCompare(b,'ko',{numeric:true,sensitivity:'base'}))}))}))};
}
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
  return item ? structuredClone(item) : kind==='notice'?{date:koreaDay(now),text:'',taskLines:[]}:{date:koreaDay(now),text:''};
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
