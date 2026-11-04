import {STUDENT_REMINDERS} from '/shared/student-reminders.js';
export function createStudentReminders({hud,request,stop,toast}){
 const style=document.createElement('link');style.rel='stylesheet';style.href='/student-reminders.css';document.head.append(style);
 const host=document.createElement('div');host.id='student-reminders';host.hidden=true;
 const toggle=document.createElement('button');toggle.type='button';toggle.id='student-reminders-toggle';toggle.textContent='⚠';toggle.title='아직 하지 않은 일';toggle.setAttribute('aria-label','아직 하지 않은 일');toggle.setAttribute('aria-expanded','false');
 const list=document.createElement('div');list.id='student-reminders-list';list.hidden=true;list.setAttribute('aria-label','아직 하지 않은 일');toggle.setAttribute('aria-controls',list.id);
 host.append(toggle,list);hud.prepend(host);let keys=[],pending=false;
 const close=()=>{list.hidden=true;toggle.setAttribute('aria-expanded','false');};
 toggle.onclick=()=>{list.hidden=!list.hidden;toggle.setAttribute('aria-expanded',String(!list.hidden));};
 host.onkeydown=e=>{if(e.key==='Escape'){close();toggle.focus();e.stopPropagation();}};
 document.addEventListener('pointerdown',e=>{if(!host.contains(e.target))close();});
 function update(player,ids=[]){
  const next=player?.role==='student'?ids.filter(id=>Object.hasOwn(STUDENT_REMINDERS,id)):[];
  host.hidden=!next.length;if(host.hidden)close();
  if(keys.join()===next.join())return;keys=next;list.replaceChildren();
  for(const id of keys){const button=document.createElement('button');button.type='button';button.dataset.reminder=id;button.textContent=STUDENT_REMINDERS[id].label;button.disabled=pending;
   button.onclick=async()=>{if(pending)return;pending=true;stop();for(const b of list.children)b.disabled=true;
    try{await request('map:fast-travel',{reminder:id});close();toast('해당 시설 앞으로 이동했어요.');}catch(e){toast(e.message);}finally{pending=false;for(const b of list.children)b.disabled=false;}};list.append(button);}
 }
 return {update,reset:()=>update(null)};
}
