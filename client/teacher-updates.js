// Persist opaque fingerprints only, scoped to the current classroom and teacher.
const fingerprint=value=>{let hash=2166136261;for(const char of JSON.stringify(value)){hash^=char.charCodeAt(0);hash=Math.imul(hash,16777619);}return (hash>>>0).toString(36);};
export function createTeacherUpdates(){
  let key='',seen={},current={};const bindings=new Map();
  function save(){try{localStorage.setItem(key,JSON.stringify(seen));}catch{}}
  function pending(category){const previous=new Set(Array.isArray(seen[category])?seen[category]:[]);return (current[category]||[]).some(id=>!previous.has(id));}
  function paint(){let any=false;for(const [category,buttons] of bindings){const fresh=pending(category);any||=fresh;for(const {button,badge} of buttons){badge.hidden=!fresh;button.dataset.hasNew=String(fresh);}}
    const badge=document.getElementById('teacher-activity-new');if(badge)badge.hidden=!any;
  }
  function acknowledge(category){seen[category]=current[category]||[];save();paint();}
  function bind(category,button){if(!button)return;const badge=document.createElement('span');badge.className='teacher-tool-new';badge.textContent='NEW';badge.hidden=true;button.append(badge);const list=bindings.get(category)||[];list.push({button,badge});bindings.set(category,list);button.addEventListener('click',()=>acknowledge(category));}
  function update(room,selfId){
    if(room?.players.find(p=>p.id===selfId)?.role!=='teacher'){current={};paint();return;}
    const next='space-teacher-updates:'+room.code+':'+selfId;
    if(key!==next){key=next;try{const saved=JSON.parse(localStorage.getItem(key)||'{}');seen=saved&&typeof saved==='object'&&!Array.isArray(saved)?saved:{};}catch{seen={};}}
    const activity=room.teacherActivity||{};
    current={items:(activity.items||[]).map(fingerprint),warnings:(activity.warnings||[]).map(fingerprint),tasks:(activity.tasks||[]).filter(e=>e.status==='submitted').map(fingerprint),proposals:(room.proposals||[]).map(p=>fingerprint([p.id,p.at])),constellations:(room.campaignRequests||[]).map(p=>fingerprint([p.id,p.at]))};
    // Already-open content is read as it arrives; closing a section never clears another section.
    for(const [category,buttons] of bindings)if(buttons.some(({button})=>button.getAttribute('aria-expanded')==='true'&&button.closest('dialog')?.open))seen[category]=current[category]||[];
    paint();
  }
  return {bind,update,acknowledge,reset(){key='';seen={};current={};paint();}};
}
