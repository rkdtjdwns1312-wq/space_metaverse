import {MUSIC_TRACKS} from './audio.js';
import {pinDialogHeader} from './dialog-layout.js';

export function createLifeStarUI({audio,request,stop,toast,onClose=()=>{}}){
  const dialog=document.createElement('dialog');dialog.id='life-star-dialog';dialog.setAttribute('aria-labelledby','life-star-title');
  dialog.innerHTML=`<header><h2 id="life-star-title">생명의별</h2><button type="button" class="secondary" data-close>닫기</button></header>
    <section class="life-star-options"><button type="button" data-recover>회복하기</button><button type="button" data-music>노래듣기</button></section>
    <section class="life-star-music" hidden>
      <p class="muted">우리 우주의 배경음악을 골라 들어요. 창을 닫으면 현재 장소의 음악으로 돌아가요.</p>
      <p class="life-star-status" role="status" aria-live="polite">곡을 선택해 주세요.</p>
      <div class="life-star-controls"><button type="button" class="secondary" data-stop>정지</button><button type="button" class="secondary" data-repeat aria-pressed="true">반복 켜짐</button><button type="button" class="secondary" data-back>돌아가기</button></div>
      <ul class="life-star-tracks" aria-label="게임 배경음악"></ul>
    </section>`;
  document.body.append(dialog);pinDialogHeader(dialog);
  const find=selector=>dialog.querySelector(selector),options=find('.life-star-options'),music=find('.life-star-music'),status=find('.life-star-status');
  let musicOpen=false,repeat=true,revision=0,mapId=null,recovering=false;
  function clearSelection(){for(const button of dialog.querySelectorAll('[data-track]'))button.setAttribute('aria-pressed','false');}
  function finishMusic(restore=true){++revision;if(musicOpen){musicOpen=false;void audio.endMusic({restore});}clearSelection();}
  function showOptions(){finishMusic();music.hidden=true;options.hidden=false;find('h2').textContent='생명의별';find('[data-music]').focus();}
  find('[data-close]').onclick=()=>dialog.close();
  dialog.addEventListener('close',()=>{finishMusic();onClose();});
  find('[data-recover]').onclick=async()=>{
    if(recovering)return;recovering=true;const button=find('[data-recover]'),token=revision;button.disabled=true;
    try{const result=await request('life-star:recover',{});if(token===revision){toast(result.message);dialog.close();}}
    catch(error){if(token===revision)toast(error.message);}
    finally{recovering=false;button.disabled=false;}
  };
  find('[data-music]').onclick=()=>{
    ++revision;musicOpen=true;options.hidden=true;music.hidden=false;find('h2').textContent='생명의별 · 노래듣기';status.textContent='곡을 선택해 주세요.';
    audio.beginMusic({onEnded:()=>{clearSelection();status.textContent='재생이 끝났어요.';}});find('[data-track]').focus();
  };
  find('[data-back]').onclick=showOptions;
  find('[data-stop]').onclick=()=>{++revision;audio.stopMusic();clearSelection();status.textContent='재생을 멈췄어요.';};
  find('[data-repeat]').onclick=()=>{
    repeat=!repeat;audio.setMusicRepeat(repeat);find('[data-repeat]').setAttribute('aria-pressed',String(repeat));find('[data-repeat]').textContent=repeat?'반복 켜짐':'반복 꺼짐';
  };
  for(const track of MUSIC_TRACKS){
    const li=document.createElement('li'),button=document.createElement('button');button.type='button';button.className='secondary';button.dataset.track=track.id;button.setAttribute('aria-pressed','false');button.setAttribute('aria-label',track.name+' 재생');
    const name=document.createElement('span'),action=document.createElement('span');name.textContent=track.name;action.textContent='재생';action.className='life-star-play';button.append(name,action);
    button.onclick=async()=>{
      const token=++revision;clearSelection();button.setAttribute('aria-pressed','true');status.textContent=track.name+' · 불러오는 중…';
      const playing=await audio.playMusic(track.id,{repeat});
      if(token!==revision||!musicOpen)return;
      status.textContent=playing?track.name+' · 재생 중':'재생하지 못했어요. 곡을 다시 눌러 주세요.';if(!playing)clearSelection();
    };
    li.append(button);find('ul').append(li);
  }
  function reset(){finishMusic(false);mapId=null;if(dialog.open)dialog.close();}
  return {
    open(currentMap){stop();mapId=currentMap;++revision;music.hidden=true;options.hidden=false;find('h2').textContent='생명의별';if(!dialog.open)dialog.showModal();find('[data-recover]').focus();},
    updateMap(currentMap){if(dialog.open&&mapId!==currentMap)reset();},reset
  };
}
