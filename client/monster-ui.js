import {drawMonster} from './monster-art.js';
import {mapOf} from '/shared/config.js';

export function createMonsterUI({request,stop,toast,isJoined}){
  const dialog=document.createElement('dialog');dialog.id='monster-dialog';dialog.setAttribute('aria-labelledby','monster-title');
  dialog.innerHTML='<h2 id="monster-title">별자리 몬스터</h2><canvas id="monster-picture" width="300" height="180" aria-label="별자리 모습"></canvas><div class="monster-menu"><button id="monster-info" type="button" class="secondary" aria-expanded="false">정보 보기</button><section id="monster-details" hidden><p id="monster-description"></p><p id="monster-map"></p><p>1초마다 방향을 골라 천천히 산책해요.</p></section><button id="monster-hunt" type="button" disabled>사냥하기 · 준비 중</button><p class="muted">사냥과 경험치 보상은 아직 열리지 않았어요.</p><button id="monster-close" type="button" class="secondary">닫기</button></div>';
  document.body.append(dialog);const $=id=>dialog.querySelector('#monster-'+id);let revision=0;
  $('close').onclick=()=>dialog.close();
  dialog.addEventListener('close',()=>{revision++;document.getElementById('world').focus();});
  $('info').onclick=()=>{const open=$('details').hidden;$('details').hidden=!open;$('info').setAttribute('aria-expanded',String(open));};
  return {
    async open(id){
      stop();const version=++revision;
      try{
        const result=await request('monster:info',{monsterId:id});
        if(version!==revision||!isJoined()||document.querySelector('dialog[open]'))return;
        const m=result.monster;$('title').textContent=m.name;$('description').textContent=m.description;$('map').textContent='만나는 곳: '+mapOf(m.mapId).name;
        $('details').hidden=true;$('info').setAttribute('aria-expanded','false');
        const ctx=$('picture').getContext('2d');ctx.fillStyle='#12112a';ctx.fillRect(0,0,300,180);drawMonster(ctx,{...m,x:150,y:90,radius:65},0);
        dialog.showModal();
      }catch(error){if(version===revision&&isJoined())toast(error.message);}
    },
    reset(){revision++;if(dialog.open)dialog.close();}
  };
}
