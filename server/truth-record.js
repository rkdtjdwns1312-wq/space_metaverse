import {equipmentOf,equipmentBaseId} from '../shared/equipment.js';
// Successful E skill use (or Lv5 transformation) rolls once, after mana and cast checks.
const COOLDOWN_FIELD=Object.freeze({
  aquarius:'aquariusCooldownUntil',corvus:'corvusCooldownUntil',cancer:'waterCooldownUntil',
  cetus:'waterCooldownUntil',pisces:'waterCooldownUntil',cygnus:'swanCooldownUntil',
  ophiuchus:'ophiuchusCooldownUntil',gemini:'geminiCooldownUntil',aries:'ariesCooldownUntil',
  taurus:'taurusCooldownUntil',hercules:'herculesCooldownUntil',libra:'libraCooldownUntil',
  'corona-borealis':'coronaCooldownUntil',capricorn:'capricornCooldownUntil',leo:'leoCooldownUntil'
});

export function refreshTruthRecord(player,result,kind,now,random=Math.random){
  const item=equipmentOf(player?.equipmentSlots?.find(id=>equipmentBaseId(id)==='truth-record'));
  if(player?.role!=='student'||!item||!result?.ready&&kind!=='transform')return result;
  if(random()>=item.cooldownResetChance)return result;
  if(kind==='transform'){
    if(!player.transformation?.active)return result;
    player.transformation.cooldownUntil=now;
    return {...result,cooldownUntil:now,cooldownReset:true};
  }
  if(kind!=='skill')return result;
  const id=player.avatar?.constellationId;
  if(id==='sagittarius'){
    player.sagittariusCooldowns??={};
    player.sagittariusCooldowns[0]=now;
  }else if(id==='cygnus'&&player.swanAura){
    player.swanAura.cooldownMs=0;
    player.swanCooldownUntil=now;
    return {...result,cooldownReset:true};
  }else{
    const field=COOLDOWN_FIELD[id];
    if(!field)return result;
    player[field]=now;
  }
  return {...result,cooldowns:{...result.cooldowns,0:now},cooldownReset:true};
}
