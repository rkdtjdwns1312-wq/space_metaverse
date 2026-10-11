import {BOSS_DIALOGUES} from '/shared/boss-dialogues.js';

export function createBossDialogueUI({getMapId,onOpen=()=>{},onClose=()=>{}}){
  const dialog=document.createElement('dialog');dialog.id='boss-dialogue';dialog.className='boss-dialogue';
  dialog.setAttribute('aria-labelledby','boss-dialogue-name');
  dialog.innerHTML='<canvas class="boss-dialogue-portrait" width="440" height="440" aria-hidden="true"></canvas><section class="boss-dialogue-panel"><h2 id="boss-dialogue-name"></h2><p class="boss-dialogue-line" aria-live="polite"></p><footer><span class="boss-dialogue-count"></span><button type="button">다음</button></footer></section>';
  document.body.append(dialog);
  const portrait=dialog.querySelector('canvas'),ctx=portrait.getContext('2d'),button=dialog.querySelector('button');
  const seen=new Set();let queue=[],current=null,index=0;
  function render(){
    const entry=BOSS_DIALOGUES[current.bossId];
    dialog.querySelector('h2').textContent=entry.name;
    dialog.querySelector('p').textContent=entry.lines[index];
    dialog.querySelector('.boss-dialogue-count').textContent=`${index+1} / ${entry.lines.length}`;
    button.textContent=index===entry.lines.length-1?'닫기':'다음';
  }
  function pump(){
    if(current||document.querySelector('dialog[open]'))return;
    queue=queue.filter(e=>e.mapId===getMapId());current=queue.shift();if(!current)return;
    index=0;render();ctx.clearRect(0,0,440,440);
    const event=current,art=BOSS_DIALOGUES[current.bossId].portrait,image=new Image();
    image.onload=()=>{if(current!==event)return;const w=image.naturalWidth/art.columns,h=image.naturalHeight/art.rows,s=Math.min(440/w,440/h);ctx.drawImage(image,0,0,w,h,(440-w*s)/2,440-h*s,w*s,h*s);};image.src=art.src;
    onOpen();dialog.showModal();button.focus();
  }
  button.addEventListener('click',()=>{if(!current)return;if(++index>=BOSS_DIALOGUES[current.bossId].lines.length)dialog.close();else render();});
  dialog.addEventListener('keydown',event=>{if(event.repeat&&['Enter',' '].includes(event.key))event.preventDefault();});
  dialog.addEventListener('close',()=>{current=null;onClose();});
  document.addEventListener('close',()=>setTimeout(pump,0),true);
  return {
    receive(event){if(!event||!BOSS_DIALOGUES[event.bossId]||typeof event.id!=='string'||event.mapId!==getMapId()||seen.has(event.id))return;
      seen.add(event.id);if(seen.size>128)seen.delete(seen.values().next().value);queue.push(event);pump();},
    update(){queue=queue.filter(e=>e.mapId===getMapId());if(current&&current.mapId!==getMapId())dialog.close();},
    reset(){queue=[];seen.clear();if(dialog.open)dialog.close();current=null;}
  };
}
