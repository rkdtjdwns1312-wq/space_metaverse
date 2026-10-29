export function createTeacherGhostUI({hud,request,toast}){
  const style=document.createElement('link');style.rel='stylesheet';style.href='/teacher-ghost.css';document.head.append(style);
  const button=document.createElement('button');button.id='teacher-ghost-toggle';button.type='button';button.hidden=true;
  let player=null,pending=false;
  function update(next){
    player=next;button.hidden=next?.role!=='teacher';button.disabled=pending;
    const active=next?.teacherGhost===true;
    button.textContent=active?'고스트 모드 ON':'고스트 모드 OFF';button.setAttribute('aria-pressed',String(active));
    button.title=active?'학생들에게 선생님이 보이지 않아요.':'학생들에게 선생님이 보여요.';
  }
  button.onclick=async()=>{
    if(player?.role!=='teacher'||pending)return;
    pending=true;update(player);
    try{const result=await request('teacher:ghost',{enabled:!player.teacherGhost});if(player?.role==='teacher')update({...player,teacherGhost:result.teacherGhost});}
    catch(error){toast(error.message);}
    finally{pending=false;update(player);}
  };
  hud.append(button);return {update,reset:()=>update(null)};
}
