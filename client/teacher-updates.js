// Persist opaque fingerprints only, scoped to the current classroom and teacher.
const fingerprint=value=>{let hash=2166136261;for(const char of JSON.stringify(value)){hash^=char.charCodeAt(0);hash=Math.imul(hash,16777619);}return (hash>>>0).toString(36);};
export function createTeacherUpdates(){
  let key='',seen={},current={};const bindings=new Map();
  function save(){try{localStorage.setItem(key,JSON.stringify(seen));}catch{}}
  function pending(category){const previous=new Set(Array.isArray(seen[category])?seen[category]:[]);return (current[category]||[]).some(id=>!previous.has(id));}
  function paint(){let any=false;for(const [category,buttons] of bindings){const fresh=pending(category);any||=fresh;for(const {button,badge,description} of buttons){badge.hidden=!fresh;button.dataset.hasNew=String(fresh);if(fresh)button.setAttribute('aria-describedby',description.id);else button.removeAttribute('aria-describedby');}}
    const badge=document.getElementById('teacher-activity-new');if(badge)badge.hidden=!any;
  }
  function acknowledge(category){seen[category]=current[category]||[];save();paint();}
  function bind(category,button){if(!button)return;const list=bindings.get(category)||[];const badge=document.createElement('span');badge.className='teacher-tool-new';badge.textContent='NEW';badge.hidden=true;if(category==='constellations')badge.id='teacher-constellation-new';const description=document.createElement('span');description.className='sr-only';description.id=`teacher-new-description-${category}-${list.length+1}`;description.textContent=category==='constellations'?'새 검토 요청이 있습니다.':'새 항목이 있습니다.';(button.querySelector('.teacher-tool-title')||button).append(badge);button.append(description);list.push({button,badge,description});bindings.set(category,list);button.addEventListener('click',()=>{if(button.getAttribute('aria-expanded')==='true')acknowledge(category);});}
  function update(room,selfId){
    if(room?.players.find(p=>p.id===selfId)?.role!=='teacher'){current={};paint();return;}
    const next='space-teacher-updates:'+room.code;
    if(key!==next){key=next;try{const saved=JSON.parse(localStorage.getItem(key)||'{}');seen=saved&&typeof saved==='object'&&!Array.isArray(saved)?saved:{};}catch{seen={};}}
    const activity=room.teacherActivity||{};
    current={items:(activity.items||[]).map(fingerprint),warnings:(activity.warnings||[]).map(fingerprint),tasks:(activity.tasks||[]).filter(e=>e.status==='submitted').map(fingerprint),proposals:(room.proposals||[]).map(p=>fingerprint([p.id,p.at])),constellations:(room.campaignRequests||[]).map(p=>fingerprint([p.id,p.at]))};
    // New entries stay marked until the teacher opens the matching section.
    paint();
  }
  return {bind,update,acknowledge,reset(){key='';seen={};current={};paint();}};
}
