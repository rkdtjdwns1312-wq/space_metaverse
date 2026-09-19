import {ATTACK_VISUAL,SKILL_COOLDOWN_MS} from '/shared/combat.js';
// Q의 대상·피해는 서버가 결정합니다. W의 전투 스킬은 아직 준비 중입니다.
export function createCombatControls({getPlayer,canAct,toast,request}){
  const attack=document.getElementById('touch-attack'),skill=document.getElementById('touch-skill');
  const last={attack:-Infinity,skill:-Infinity};
  async function act(kind){
    const player=getPlayer();if(!player||!canAct())return;
    if(player.vitals?.defeated){toast('체력을 회복하는 중이에요. 잠시 기다려주세요.');return;}
    const now=performance.now(),cooldown=kind==='attack'?ATTACK_VISUAL.cooldownMs:SKILL_COOLDOWN_MS;
    if(now-last[kind]<cooldown)return;last[kind]=now;
    if(kind==='skill'){
      try{await request('combat:skill',{});toast('전투 스킬은 준비 중이에요. 마지막 이동 방향으로 사용돼요.');}catch(error){toast(error.message);}return;
    }
    if(player.avatar.level<2){toast('LV2부터 공격할 수 있어요.');return;}
    const power=player.combat?.attackPower;
    if(power==null){toast('이 단계의 공격력은 설정 준비 중이에요.');return;}
    try{const result=await request('combat:attack',{});if(result.target?.defeated)toast('별자리 몬스터를 잡았어요! 잠시 뒤 다시 나타나요.');}catch(error){toast(error.message);}
  }
  attack.onclick=()=>act('attack');skill.onclick=()=>act('skill');
  window.addEventListener('keydown',event=>{
    if(!['KeyQ','KeyW'].includes(event.code)||event.repeat||event.ctrlKey||event.altKey||event.metaKey||
      event.target.isContentEditable||['INPUT','TEXTAREA','SELECT'].includes(event.target.tagName)||!getPlayer()||!canAct())return;
    event.preventDefault();act(event.code==='KeyQ'?'attack':'skill');
  });
}
