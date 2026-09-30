import {corvusSkillOf} from '/shared/character-skills.js';
import {ATTACK_VISUAL,SKILL_COOLDOWN_MS} from '/shared/combat.js';
import {isSagittarius,sagittariusSkill} from '/shared/sagittarius-skills.js';
// 버튼·키보드 모두 같은 요청 경로를 사용하며 서버 응답이 최종 기준입니다.
export function createCombatControls({getPlayer,canAct,toast,request}){
  const attack=document.getElementById('touch-attack'),skill=document.getElementById('touch-skill');
  const last={attack:-Infinity,skill:-Infinity};
  let cooldowns={},owner=null,serverOffset=0;
  function sync(data){
    owner=getPlayer()?.id;cooldowns=data.cooldowns||{};serverOffset=(data.serverNow||Date.now())-Date.now();
  }
  async function castSkill(slot=0){
    const player=getPlayer();if(!player||!canAct())return;
    if(slot!==0){toast('기존 보조 스킬은 더 이상 사용하지 않아요.');return;}
    if(player.vitals?.defeated){toast('체력을 회복하는 중이에요.');return;}
    const spec=player.avatar.constellationId==='corvus'?corvusSkillOf(player):isSagittarius(player)&&sagittariusSkill(slot);
    if(spec){
      if(player.avatar.level<spec.level){toast(`LV${spec.level}부터 사용할 수 있어요.`);return;}
      const remaining=owner===player.id?(cooldowns[slot]||0)-Date.now()-serverOffset:0;
      if(remaining>0){toast(`${Math.ceil(remaining/1000)}초 뒤에 다시 사용할 수 있어요.`);return;}
    }else{
      if(slot!==0){toast('보조 스킬은 준비 중이에요.');return;}
      if(performance.now()-last.skill<SKILL_COOLDOWN_MS)return;last.skill=performance.now();
    }
    try{const result=await request('combat:skill',{slot});if(result.ready)sync(result);else toast('전투 스킬은 준비 중이에요. 지금은 별자리 이펙트를 미리 볼 수 있어요.');}
    catch(error){toast(error.message);}
  }
  async function act(kind){
    const player=getPlayer();if(!player||!canAct())return;
    if(player.vitals?.defeated){toast('체력을 회복하는 중이에요. 잠시 기다려주세요.');return;}
    if(kind==='skill'){await castSkill(0);return;}
    const now=performance.now(),cooldown=ATTACK_VISUAL.cooldownMs;
    if(now-last[kind]<cooldown)return;last[kind]=now;
    if(player.avatar.level<2){toast('LV2부터 공격할 수 있어요.');return;}
    const power=player.combat?.attackPower;
    if(power==null){toast('이 단계의 공격력은 설정 준비 중이에요.');return;}
    try{const result=await request('combat:attack',{});if((result.targets||[result.target]).some(target=>target?.defeated))toast('별자리 몬스터를 잡았어요! 잠시 뒤 다시 나타나요.');}catch(error){toast(error.message);}
  }
  attack.onclick=()=>act('attack');skill.onclick=()=>act('skill');
  window.addEventListener('keydown',event=>{
    if(!['KeyQ','KeyE'].includes(event.code)||event.repeat||event.ctrlKey||event.altKey||event.metaKey||
      event.target.isContentEditable||['INPUT','TEXTAREA','SELECT','BUTTON'].includes(event.target.tagName)||!getPlayer()||!canAct())return;
    event.preventDefault();act(event.code==='KeyQ'?'attack':'skill');
  });
  // 숫자는 그림 위에만 겹쳐 표시해 슬롯·작은 단축키 위치는 바꾸지 않습니다.
  setInterval(()=>{
    const player=getPlayer();
    const transform=document.querySelector('[data-skill-slot="transformation"]');
    if(transform){let badge=transform.querySelector('.skill-cooldown');if(!badge){badge=document.createElement('span');badge.className='skill-cooldown';transform.append(badge);}const state=player?.transformation;const left=Math.ceil(((state?.active?state.endsAt:state?.cooldownUntil)||0)-Date.now()-serverOffset)/1000;badge.hidden=left<=0;badge.textContent=left>0?Math.ceil(left)+'':'';transform.classList.toggle('is-transforming',!!state?.active);}
    [skill].forEach((button,slot)=>{
      let badge=button.querySelector('.skill-cooldown');
      if(!badge){badge=document.createElement('span');badge.className='skill-cooldown';button.append(badge);}
      const left=owner===player?.id&&['corvus','sagittarius'].includes(player?.avatar?.constellationId)?Math.ceil(((cooldowns[slot]||0)-Date.now()-serverOffset)/1000):0;
      badge.hidden=left<=0;badge.textContent=left>0?String(left):'';
    });
  },100);
  async function transform(){if(!canAct())return;try{await request('combat:transform',{});}catch(error){toast(error.message);}}
  return {castSkill,sync,transform};
}
