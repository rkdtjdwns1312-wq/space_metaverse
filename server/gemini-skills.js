import {avatarSizeOf} from '../shared/avatar-size.js';
import {attackPowerOf,attackGeometryOf} from '../shared/combat.js';
import {geminiSkillOf} from '../shared/gemini-skills.js';
import {launchProjectiles} from './projectiles.js';
import {ensureVitals,playerVitals} from './vitals.js';
import {ensure} from './rooms.js';

const eligible=p=>p?.connected&&!p.away&&!p.avatar?.blackStar&&ensureVitals(p).hp>0;
export const geminiCooldowns=p=>({0:p.geminiCooldownUntil||0});

export function castGemini(room,player,now,{basic=false}={}){
  ensure(player?.avatar?.constellationId==='gemini'&&player.avatar.level>=2,'LV2 쌍둥이자리부터 사용할 수 있어요.');
  ensure(eligible(player),'지금은 스킬을 사용할 수 없어요.');
  const spec=geminiSkillOf(player),vitals=ensureVitals(player);
  if(!basic){
    ensure(now>=(player.geminiCooldownUntil||0),'쌍별 스킬을 다시 쓰려면 조금 기다려주세요.');
    ensure(vitals.mp>=spec.mana,'마나가 부족해요.');
    vitals.mp-=spec.mana;player.geminiCooldownUntil=now+spec.cooldownMs;
  }
  const size=avatarSizeOf(player),facing=player.facing||{x:0,y:1};
  const length=Math.hypot(facing.x,facing.y)||1,dx=facing.x/length,dy=facing.y/length;
  const power=attackPowerOf(player.avatar.level,'gemini',player);
  const base={x:player.x,y:player.y,dx,dy,size,range:size*4,width:size*.13,
    power:basic?power:Math.round(power*spec.multiplier*spec.effectAmount),basic,
    piercing:!basic,kind:basic?'gemini-attack':'gemini-skill',
    vfxId:basic?'attack':`skill-lv${spec.stage}`,
    originOffset:attackGeometryOf(player).originOffset,durationMs:basic?650:900};
  const projectiles=launchProjectiles(room,player,base,now,basic?1:spec.hits);
  return {ready:true,target:null,targets:[],playerTargets:[],vitals:playerVitals(player),
    cooldowns:geminiCooldowns(player),serverNow:now,
    hit:{...base,playerId:player.id,mapId:player.mapId,projectiles}};
}
